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
 * The person THIS tab is for, for the life of the page.
 *  - A real person A stays A whatever other tabs do (signed out elsewhere, or someone else signed in elsewhere). Only a sign-in or
 *    sign-out done in THIS tab, or a page load, changes it (`onOwnTokenWrite`, `leaveTab`).
 *  - A GUEST tab follows: when a session appears, here or in another tab, the tab becomes that person's tab, and what the guest kept
 *    moves to that person (the guest claim).
 * Before every write, restore and clear the person is compared with who is signed in right then (`signedInAsSomeoneElse`); a missed
 * `storage` event can therefore never let the wrong person through.
 */
let person: Owner = typeof window === "undefined" ? null : currentOwner();
if (typeof window !== "undefined") {
  // Tokens written by THIS tab (a sign-in here, or a refresh here).
  onOwnTokenWrite((access, hadSession) => {
    const s = subOf(access);
    // A refresh of someone else's session (the stored refresh token is theirs) never changes whose tab this is.
    if (!hadSession || person === null || s === person) person = s;
  });
}
export function openedFor(): Owner {
  const now = currentOwner();
  if (person === null && now !== null) person = now; // a guest tab follows the person who signed in
  return person;
}
/** The sign-out done in this tab: the tab is nobody's again. */
export function leaveTab(): void {
  person = null;
}

/**
 * True when someone is signed in here who is not `owner`. A screen opened for A must then keep, restore, clear and send
 * nothing: the kept recording is A's, and the person now signed in is not. Nobody signed in (a session that ended) is not a
 * different person, and a guest (null) is never "someone else" of a person who signed in: it follows them.
 */
export function signedInAsSomeoneElse(owner: Owner): boolean {
  const me = currentOwner();
  return me !== null && owner !== null && me !== owner;
}

const DB = "voices-speak";
const STORE = "drafts";
const LEGACY_ID = "current"; // main's one slot, with an `owner` inside
/** Each person's kept recording lives under their own key; a guest's under `rec:guest`. Nothing is written under another person's key. */
const keyOf = (o: Owner): string => `rec:${o ?? "guest"}`;
const memory = new Map<string, Draft>();

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

const isDraft = (d: unknown): d is Draft => !!d && (d as Draft).blob instanceof Blob;
async function idbGet(key: string): Promise<Draft | undefined> {
  try { const d = await run<unknown>("readonly", (s) => s.get(key)); return isDraft(d) ? d : undefined; } catch { return memory.get(key); }
}
/** True when it is really on the device; false when only this page holds it (storage blocked or full). */
async function idbPut(key: string, d: Draft): Promise<boolean> {
  memory.set(key, d);
  try { await run("readwrite", (s) => s.put(d, key)); lastPutFailed = false; return true; } catch { lastPutFailed = true; return false; }
}
let lastPutFailed = false;
/** True when the last write could not reach the device's storage (blocked, missing or full): the take is held by this page only. */
export const keepFailed = (): boolean => lastPutFailed;
async function idbDel(key: string): Promise<void> {
  memory.delete(key);
  try { await run("readwrite", (s) => s.delete(key)); } catch { /* nothing to clear */ }
}
async function idbKeys(): Promise<string[]> {
  try { return (await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys())).map(String); } catch { return [...memory.keys()]; }
}

/** What main kept (one slot, `current`, with an owner inside) goes to its owner's key, once. */
let migrated: Promise<void> | null = null;
function migrate(): Promise<void> {
  return (migrated ??= (async () => {
    const old = await idbGet(LEGACY_ID);
    if (!old) return;
    const k = keyOf(old.owner ?? null);
    if (!(await idbGet(k))) await idbPut(k, { ...old, owner: old.owner ?? null });
    await idbDel(LEGACY_ID);
  })().catch(() => undefined));
}

/** The guest claim: what a guest kept moves to the person who is now signed in, unless that person already has a recording of their own. */
async function claimGuest(me: Owner): Promise<void> {
  if (me === null || currentOwner() !== me) return;
  const g = await idbGet(keyOf(null));
  if (!g) return;
  if (!(await idbGet(keyOf(me)))) await idbPut(keyOf(me), { ...g, owner: me });
  else return;
  await idbDel(keyOf(null));
}

/** True when the recording is really kept on this device. False means only this page holds it (storage blocked or full), or it was refused (see signedInAsSomeoneElse). */
export async function saveDraft(input: Draft, owner: Owner): Promise<boolean> {
  if (signedInAsSomeoneElse(owner)) return false; // refused: nothing is written
  await migrate();
  await claimGuest(owner);
  return idbPut(keyOf(owner), { ...input, owner });
}

/** The kept recording for this person. A guest's is handed to the person who signs in, once. Another person's is never shown; on a shared browser a signed-in person's load removes recordings other people left behind (as before). */
export async function loadDraft(owner: Owner): Promise<Draft | null> {
  if (signedInAsSomeoneElse(owner)) return null; // refused: nothing is returned and nothing is removed
  await migrate();
  const me = currentOwner();
  await claimGuest(owner);
  const d = (await idbGet(keyOf(owner))) ?? null;
  if (me !== null) {
    // Only while the person this pass began for is still the one signed in: someone who signed in meanwhile (another tab) keeps theirs.
    for (const k of await idbKeys()) { if (currentOwner() !== me) break; if (k.startsWith("rec:") && k !== keyOf(me) && k !== keyOf(null)) await idbDel(k); }
  }
  return d;
}

export async function clearDraft(owner: Owner): Promise<void> {
  if (signedInAsSomeoneElse(owner)) return; // refused: not this person's to clear
  await migrate();
  await claimGuest(owner);
  await idbDel(keyOf(owner));
}

/** After a sign-out done in this tab: the tab is nobody's, and that person's kept recording is removed (typed words and held posts stay under their own key). */
export async function afterSignOut(tokenBefore: string | null): Promise<void> {
  const who = subOf(tokenBefore) ?? person;
  leaveTab();
  if (who !== null) await idbDel(keyOf(who));
}

/** App start: any recording kept more than 7 days is removed, whoever's it is, without reading the audio. */
export async function sweepOldRecordings(now = Date.now()): Promise<void> {
  await migrate();
  for (const k of await idbKeys()) {
    if (!k.startsWith("rec:")) continue;
    const d = await idbGet(k);
    if (d && draftIsStale(d, now)) await idbDel(k);
  }
}

/** A waiting voice reply is a promise made to the person: a plain take on the record screen never overwrites it. Returns false when it held back. */
export async function saveDraftKeepingReply(input: Draft, owner: Owner): Promise<boolean> {
  if (signedInAsSomeoneElse(owner)) return false;
  const cur = await loadDraft(owner);
  if (cur?.reply && cur.key !== input.key) return false;
  return saveDraft(input, owner);
}
