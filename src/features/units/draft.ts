/* A held draft (V-19): the words a person wrote when they ran out of free posts and units. They stay in this browser
 * (no server drafts) and post after a successful purchase. The Write screen saves a draft with `saveDraft` and opens the
 * out-of-posts sheet on a 402 FREE_POSTS_EXHAUSTED or INSUFFICIENT_UNITS; the tokens return page posts it. */

const STORE = "voices-held-drafts";

export interface HeldDraft {
  questionId: string;
  body: string;
  /** Idempotency-Key for the post: a refresh never posts the draft twice. */
  key: string;
  savedAt: number;
  /** The person tapped "Get tokens": post this draft when the units arrive. */
  awaitingUnits: boolean;
  /** The id of the payment whose units posted this draft. A posted draft is kept as a record (a second tab shows the right banner) and is never posted again. */
  posted?: string;
}

/** A draft older than this is never posted on its own, only offered (the words may no longer be the person's mind). */
export const AUTO_POST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Table = Record<string, HeldDraft>;
const memory: Table = {};
let blocked = false; // storage threw once: this page keeps its own copy

function read(): Table {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return blocked ? { ...memory } : {};
    const t = JSON.parse(raw) as Table;
    return t && typeof t === "object" ? t : {};
  } catch {
    blocked = true;
    return { ...memory };
  }
}

function write(t: Table): void {
  Object.keys(memory).forEach((k) => delete memory[k]);
  Object.assign(memory, t);
  try {
    window.localStorage.setItem(STORE, JSON.stringify(t));
  } catch {
    blocked = true; // the draft survives this page only
  }
}

function key(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** The draft still held for a question (not one that already posted). */
export function getDraft(questionId: string): HeldDraft | undefined {
  const d = read()[questionId];
  return d && !d.posted ? d : undefined;
}

/** The record for a question including a draft that already posted. */
export function getRecord(questionId: string): HeldDraft | undefined {
  return read()[questionId];
}

/** The draft posted for this payment: keep the record, stop waiting. */
export function markPosted(questionId: string, paymentId: string): void {
  const t = read();
  if (t[questionId]) {
    t[questionId] = { ...t[questionId], awaitingUnits: false, posted: paymentId };
    write(t);
  }
}

/** Save the words for a question. Keeps the same post key for the same text, so a retry stays one post. */
export function saveDraft(questionId: string, body: string, now = Date.now()): HeldDraft | undefined {
  const text = body.trim();
  const t = read();
  if (!text) {
    delete t[questionId];
    write(t);
    return undefined;
  }
  const prev = t[questionId];
  const live = prev && !prev.posted ? prev : undefined;
  const d: HeldDraft = { questionId, body: text, key: live && live.body === text ? live.key : key(), savedAt: now, awaitingUnits: live?.awaitingUnits ?? false };
  t[questionId] = d;
  write(t);
  return d;
}

export function setAwaiting(questionId: string, awaiting: boolean): void {
  const t = read();
  if (t[questionId]) {
    t[questionId] = { ...t[questionId], awaitingUnits: awaiting };
    write(t);
  }
}

export function clearDraft(questionId: string): void {
  const t = read();
  delete t[questionId];
  write(t);
}

/** The drafts waiting for units to arrive, newest first. */
export function awaitingDrafts(): HeldDraft[] {
  return Object.values(read())
    .filter((d) => d.awaitingUnits && !d.posted)
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** The question whose held draft was posted by this payment's units, if any (a second tab or browser reads this). */
export function findPostedFor(paymentId: string): string | undefined {
  return Object.values(read()).find((d) => d.posted === paymentId)?.questionId;
}
