/**
 * A guest's recording lives in this browser only (V-19, no server drafts). IndexedDB holds the audio across the
 * sign-in round trip and the payment round trip. One draft at a time. When IndexedDB is blocked the draft lives in memory.
 */
export interface Draft {
  /** The WAWU ID subject of the person it belongs to; null for a guest's recording, which goes to whoever signs in next, once. */
  owner?: string | null;
  questionId: string;
  blob: Blob;
  mime: string;
  seconds: number;
  peaks: number[];
  /** Stays the same for this recording so a retried post cannot post twice. */
  key: string;
  savedAt: number;
  /** When the recording was made (savedAt moves each time the draft is written again). The 7 day limit counts from here. */
  recordedAt?: number;
  /** The person tapped Send and it could not go (offline): it is offered for sending when the connection is back (V-FIX-D). */
  queued?: boolean;
  /** "Post without my name" and the mood word as they stood when Send was tapped, so a later send says the same. */
  anonymous?: boolean;
  mood?: string | null;
  /** The share link this recording came from, so the post can be counted as published from it (V-FIX-D). */
  shareCode?: string | null;
  /** Set when this recording is a voice reply, not an answer: the parent answer and the stance it was sent with. It is sent as that same reply. */
  reply?: { answerId: string; stance: "AGREE" | "DISAGREE" | "EXPERIENCE" };
  /** V-FIX-B round 2: the tag chosen so far (and the source named for a Verified News request) survives signing in. */
  tag?: TagChoice;
}

/** A saved recording is removed after 7 days (addendum 7.7). */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const draftIsStale = (d: Draft, now = Date.now()): boolean => now - (d.recordedAt ?? d.savedAt) > DRAFT_MAX_AGE_MS;
export const STALE_NOTE = "A recording you saved more than 7 days ago was removed.";

import { onOwnTokenWrite, sessionStorage } from "@/lib/auth/session-storage";
import type { TagChoice } from "@/features/news/tag-choice";

/** Who is signed in, read from the token's subject (only to match a draft, never trusted for anything else). */
export function currentOwner(): string | null {
  return subOf(sessionStorage.getToken());
}

function subOf(t: string | null | undefined): string | null {
  if (!t) return null;
  try {
    const b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = (JSON.parse(atob(b + "=".repeat((4 - (b.length % 4)) % 4))) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** The person a screen was opened for: their WAWU ID subject, or null for a guest. */
export type Owner = string | null;

/** Shown when a screen was opened for one person and another person is now signed in on this browser (another tab). */
export const OTHER_TAB_NOTE = "You are signed in as someone else in another tab. Nothing was saved. Reload to carry on.";

/**
 * The person THIS tab is for, for the life of the page. The sign-in is shared by every tab of the browser, so reading the token
 * when a screen mounts would hand a screen opened later in this tab (record, voice reply, the box) to whoever signed in on another tab.
 *  - It follows who is signed in until another tab writes the session (the `storage` event, which a tab only gets for OTHER tabs'
 *    writes). That first event pins the person this tab had, taken from the event's old value.
 *  - It is never let go because the session went away (a sign-out in another tab, or a session that ran out): a tab opened for A
 *    stays A's, so a recording made while nobody is signed in is kept under A and only A gets it back.
 *  - It changes only by something done in THIS tab: a sign-in here when no session was there, or `leaveTab()` from the sign-out here.
 *    A tab that was a guest when it loaded stays a guest until a sign-in here, so the guest claim works as before.
 * Every write, restore and clear also compares this person with who is signed in right then (`signedInAsSomeoneElse`), so a missed
 * event cannot let the wrong person through: the event only decides who the tab is for, the comparison decides what is allowed.
 */
let person: Owner = typeof window === "undefined" ? null : currentOwner();
let pinned = false;
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== "voices-web-session" || pinned) return;
    pinned = true;
    try {
      const before = subOf((JSON.parse(e.oldValue ?? "null") as { accessToken?: string } | null)?.accessToken);
      if (before !== null) person = before; // no session before: the tab keeps who it already was (a guest stays a guest)
    } catch { /* keeps what it knew */ }
  });
  // Tokens written by THIS tab (a sign-in here, or a refresh here).
  onOwnTokenWrite((access, hadSession) => {
    const s = subOf(access);
    // A refresh of someone else's session (the stored refresh token is theirs) never changes whose tab this is.
    if (!hadSession || person === null || s === person) { person = s; pinned = false; }
  });
}
export function openedFor(): Owner {
  const now = currentOwner();
  if (!pinned && now !== null) person = now;
  return person;
}
/** The sign-out done in this tab: the tab is nobody's again. */
export function leaveTab(): void {
  person = null;
  pinned = false;
}

/**
 * True when someone is signed in here who is not `owner`. A screen opened for A must then keep, restore, clear and send
 * nothing: the kept recording is A's, and the person now signed in is not. Nobody signed in (a session that ended) is not a
 * different person, so that case behaves as it always did.
 */
export function signedInAsSomeoneElse(owner: Owner): boolean {
  const me = currentOwner();
  return me !== null && me !== owner;
}

const DB = "voices-speak";
const STORE = "drafts";
const ID = "current";
let memory: Draft | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB"));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const r = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error ?? new Error("indexedDB"));
      tx.onabort = () => reject(tx.error ?? new Error("indexedDB"));
    });
  } finally {
    db.close();
  }
}

/** True when the recording is really kept on this device. False means only this page holds it (storage blocked or full). */
export async function saveDraft(input: Draft, owner: Owner): Promise<boolean> {
  if (signedInAsSomeoneElse(owner)) return false; // refused: nothing is written; the caller says why with signedInAsSomeoneElse()
  const d: Draft = { ...input, owner }; // always the person the screen was opened for, even when the session has ended meanwhile
  memory = d;
  try {
    await run("readwrite", (s) => s.put(d, ID));
    return true;
  } catch {
    /* blocked or full storage: the memory copy still serves this page, and the caller says so */
    return false;
  }
}

async function rawLoad(): Promise<Draft | null> {
  try {
    const d = await run<Draft | undefined>("readonly", (s) => s.get(ID));
    if (d && d.blob instanceof Blob) return d;
  } catch {
    /* fall through to memory */
  }
  return memory;
}

/** The kept recording for this person. A guest's recording is handed to the first person who signs in, once; another person's is never shown and is removed. */
export async function loadDraft(owner: Owner): Promise<Draft | null> {
  if (signedInAsSomeoneElse(owner)) return null; // refused: nothing is returned and nothing is removed
  const d = await rawLoad();
  if (!d) return null;
  const me = currentOwner();
  const stored = d.owner ?? null;
  if (stored === owner) return d;
  if (stored === null && owner !== null && me === owner) {
    const claimed = { ...d, owner };
    memory = claimed;
    try { await run("readwrite", (s) => s.put(claimed, ID)); } catch { /* memory copy serves */ }
    return claimed;
  }
  if (me !== null) await wipeIfStill(d); // someone else's recording on this browser
  return null;
}

/** Removes the kept recording only if it is still the very one that was read: a recording kept by someone else a moment later is never swept away with it. */
async function wipeIfStill(seen: Draft): Promise<void> {
  if (memory && memory.key === seen.key && memory.owner === seen.owner) memory = null;
  try {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const g = tx.objectStore(STORE).get(ID);
        g.onsuccess = () => {
          const cur = g.result as Draft | undefined;
          if (cur && cur.key === seen.key && (cur.owner ?? null) === (seen.owner ?? null)) tx.objectStore(STORE).delete(ID);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("indexedDB"));
        tx.onabort = () => reject(tx.error ?? new Error("indexedDB"));
      });
    } finally {
      db.close();
    }
  } catch {
    /* nothing to clear */
  }
}

export async function clearDraft(owner: Owner): Promise<void> {
  if (signedInAsSomeoneElse(owner)) return; // refused: not this person's to clear
  await wipeDraft();
}

/** Removes the kept recording whoever it belongs to. Only for sign-out, which ends the session for every tab, and for removing a recording that is not the signed-in person's. */
export async function wipeDraft(): Promise<void> {
  memory = null;
  try {
    await run("readwrite", (s) => s.delete(ID));
  } catch {
    /* nothing to clear */
  }
}

/** A waiting voice reply is a promise made to the person: a plain take on the record screen never overwrites it. Returns false when it held back. */
export async function saveDraftKeepingReply(input: Draft, owner: Owner): Promise<boolean> {
  if (signedInAsSomeoneElse(owner)) return false;
  const cur = await loadDraft(owner);
  if (cur?.reply && cur.key !== input.key) return false;
  return saveDraft(input, owner);
}
