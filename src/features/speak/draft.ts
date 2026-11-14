/**
 * A guest's recording lives in this browser only (V-19, no server drafts). IndexedDB holds the audio across the
 * sign-in round trip and the payment round trip. One draft at a time for each person. When IndexedDB is blocked the draft lives in memory.
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

import { sessionStorage } from "@/lib/auth/session-storage";
import type { TagChoice } from "@/features/news/tag-choice";

/** The person a token belongs to, read from its subject (only to match a draft, never trusted for anything else). */
export function ownerOfToken(t: string | null): string | null {
  if (!t) return null;
  try {
    const b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = (JSON.parse(atob(b + "=".repeat((4 - (b.length % 4)) % 4))) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** Who is signed in. */
export const currentOwner = (): string | null => ownerOfToken(sessionStorage.getToken());

const DB = "voices-speak";
const STORE = "drafts";
/** A guest's recording, and the one slot older versions used for everybody. Each signed-in person has a slot of their own beside it. */
const GUEST = "current";
const slotOf = (owner: string | null): string => (owner ? `u:${owner}` : GUEST);
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

async function put(slot: string, d: Draft): Promise<boolean> {
  memory.set(slot, d);
  try {
    await run("readwrite", (s) => s.put(d, slot));
    return true;
  } catch {
    /* blocked or full storage: the memory copy still serves this page, and the caller says so */
    return false;
  }
}

async function drop(slot: string): Promise<void> {
  memory.delete(slot);
  try {
    await run("readwrite", (s) => s.delete(slot));
  } catch {
    /* nothing to clear */
  }
}

/** True when the recording is really kept on this device. False means only this page holds it (storage blocked or full). */
export async function saveDraft(input: Draft): Promise<boolean> {
  const owner = currentOwner();
  return put(slotOf(owner), { ...input, owner });
}

async function rawLoad(slot: string): Promise<Draft | null> {
  try {
    const d = await run<Draft | undefined>("readonly", (s) => s.get(slot));
    if (d && d.blob instanceof Blob) return d;
  } catch {
    /* fall through to memory */
  }
  return memory.get(slot) ?? null;
}

/**
 * The kept recording for this person. A guest's recording is handed to the first person who signs in, once. Another person's is never
 * shown and never sent, and it is not removed: it stays in its own slot for them until they send it, discard it, or it is 7 days old.
 */
export async function loadDraft(): Promise<Draft | null> {
  const me = currentOwner();
  const old = await rawLoad(GUEST);
  if (me === null) return old && (old.owner ?? null) === null ? old : null;
  const mine = await rawLoad(slotOf(me));
  if (old) {
    const owner = old.owner ?? null;
    if (owner === null || owner === me) {
      // A guest's recording (or this person's, kept by an older version) moves to this person's own slot, unless one is already there.
      if (!mine) {
        const claimed = { ...old, owner: me };
        await put(slotOf(me), claimed);
        await drop(GUEST);
        return claimed;
      }
      if (owner === me) await drop(GUEST); // an older copy of this person's own, already replaced
    } else if (draftIsStale(old)) {
      await drop(GUEST); // someone else's, past the age limit
    }
  }
  return mine;
}

/** Removes this person's kept recording (the signed-in person by default; pass the person who made it when they have just signed out). Nobody else's is touched. */
export async function clearDraft(owner: string | null = currentOwner()): Promise<void> {
  await drop(slotOf(owner));
  if (owner) {
    const old = await rawLoad(GUEST);
    if (old && old.owner === owner) await drop(GUEST);
  }
}

/** A waiting voice reply is a promise made to the person: a plain take on the record screen never overwrites it. Returns false when it held back. */
export async function saveDraftKeepingReply(input: Draft): Promise<boolean> {
  const cur = await loadDraft();
  if (cur?.reply && cur.key !== input.key) return false;
  return saveDraft(input);
}
