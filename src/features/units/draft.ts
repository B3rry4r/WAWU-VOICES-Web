/* A held draft (V-19): the words a person wrote when they ran out of free posts and units. They stay in this browser
 * (no server drafts) and post after a successful purchase. The Write screen saves a draft with `saveDraft` and opens the
 * out-of-posts sheet on a 402 FREE_POSTS_EXHAUSTED or INSUFFICIENT_UNITS; the Voice Units return page posts it. */

const STORE = "voices-held-drafts";

export interface HeldDraft {
  questionId: string;
  body: string;
  /** Idempotency-Key for the post: a refresh never posts the draft twice. */
  key: string;
  savedAt: number;
  /** The person tapped "Get Voice Units": post this draft when the units arrive. */
  awaitingUnits: boolean;
}

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

export function getDraft(questionId: string): HeldDraft | undefined {
  return read()[questionId];
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
  const d: HeldDraft = { questionId, body: text, key: prev && prev.body === text ? prev.key : key(), savedAt: now, awaitingUnits: prev?.awaitingUnits ?? false };
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
    .filter((d) => d.awaitingUnits)
    .sort((a, b) => b.savedAt - a.savedAt);
}
