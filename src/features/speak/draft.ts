/**
 * A guest's recording lives in this browser only (V-19, no server drafts). IndexedDB holds the audio across the
 * sign-in round trip and the payment round trip. One draft at a time. When IndexedDB is blocked the draft lives in memory.
 */
export interface Draft {
  questionId: string;
  blob: Blob;
  mime: string;
  seconds: number;
  peaks: number[];
  /** Stays the same for this recording so a retried post cannot post twice. */
  key: string;
  savedAt: number;
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

export async function saveDraft(d: Draft): Promise<void> {
  memory = d;
  try {
    await run("readwrite", (s) => s.put(d, ID));
  } catch {
    /* blocked storage: the memory copy still serves this page */
  }
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const d = await run<Draft | undefined>("readonly", (s) => s.get(ID));
    if (d && d.blob instanceof Blob) return d;
  } catch {
    /* fall through to memory */
  }
  return memory;
}

export async function clearDraft(): Promise<void> {
  memory = null;
  try {
    await run("readwrite", (s) => s.delete(ID));
  } catch {
    /* nothing to clear */
  }
}

/** A payment sent away to checkout: where to come back and which payment to verify. */
const PAY = "voices-speak-pending-payment";
export interface PendingPayment { paymentId: string; questionId: string; key: string }
export function setPendingPayment(p: PendingPayment): void {
  try { window.localStorage.setItem(PAY, JSON.stringify(p)); } catch { /* ignore */ }
}
export function getPendingPayment(): PendingPayment | null {
  try { const v = JSON.parse(window.localStorage.getItem(PAY) ?? "null"); return v && typeof v.paymentId === "string" ? v : null; } catch { return null; }
}
export function clearPendingPayment(): void {
  try { window.localStorage.removeItem(PAY); } catch { /* ignore */ }
}
