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

import { sessionStorage } from "@/lib/auth/session-storage";
import type { TagChoice } from "@/features/news/tag-choice";

/** Who is signed in, read from the token's subject (only to match a draft, never trusted for anything else). */
export function currentOwner(): string | null {
  const t = sessionStorage.getToken();
  if (!t) return null;
  try {
    const b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = (JSON.parse(atob(b + "=".repeat((4 - (b.length % 4)) % 4))) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
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
export async function saveDraft(input: Draft): Promise<boolean> {
  const d: Draft = { ...input, owner: currentOwner() };
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
export async function loadDraft(): Promise<Draft | null> {
  const d = await rawLoad();
  if (!d) return null;
  const me = currentOwner();
  const owner = d.owner ?? null;
  if (owner === me) return d;
  if (owner === null && me !== null) {
    const claimed = { ...d, owner: me };
    memory = claimed;
    try { await run("readwrite", (s) => s.put(claimed, ID)); } catch { /* memory copy serves */ }
    return claimed;
  }
  if (me !== null) await clearDraft(); // someone else's recording on this browser
  return null;
}

export async function clearDraft(): Promise<void> {
  memory = null;
  try {
    await run("readwrite", (s) => s.delete(ID));
  } catch {
    /* nothing to clear */
  }
}

/** A waiting voice reply is a promise made to the person: a plain take on the record screen never overwrites it. Returns false when it held back. */
export async function saveDraftKeepingReply(input: Draft): Promise<boolean> {
  const cur = await loadDraft();
  if (cur?.reply && cur.key !== input.key) return false;
  return saveDraft(input);
}
