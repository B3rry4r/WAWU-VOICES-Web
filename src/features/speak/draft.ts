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
  /** V-FIX-B round 2: the tag chosen so far (and the source named for a Verified News request) survives signing in. */
  tag?: TagChoice;
}

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

export async function saveDraft(input: Draft): Promise<void> {
  const d: Draft = { ...input, owner: currentOwner() };
  memory = d;
  try {
    await run("readwrite", (s) => s.put(d, ID));
  } catch {
    /* blocked storage: the memory copy still serves this page */
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
