/* A held draft (V-19): the words a person wrote when they ran out of free posts and units. They stay in this browser
 * (no server drafts) and post after a successful purchase. The Write screen saves a draft with `saveDraft` and opens the
 * out-of-posts sheet on a 402 FREE_POSTS_EXHAUSTED or INSUFFICIENT_UNITS; the tokens return page posts it. */

import { currentOwner, draftIsStale, signedInAsSomeoneElse, type Owner } from "@/features/speak/draft";

const STORE = "voices-held-drafts"; // main's table: no person on it
const STORE_V2 = "voices-held-v2"; // one table per person: { [personId | "guest"]: { [questionId]: HeldDraft } }

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

/**
 * Every function takes the person the screen was opened for as an optional last argument. Given, the draft lives in that person's own
 * table: nobody else's draft is ever shown, blocks, overwrites or clears it, and nothing is read or written while someone else is
 * signed in. A guest's drafts are the ones in main's table (no person); the person who signs in takes a question's guest draft, once,
 * when they open that question (the guest claim). Not given: main's table, exactly as before.
 */
const allowed = (person: Owner | undefined): boolean => person === undefined || !signedInAsSomeoneElse(person);
const pk = (o: Owner): string => o ?? "guest";

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

type People = Record<string, Table>;
const memory2: People = {};
let blocked2 = false;
function readPeople(): People {
  try {
    const raw = window.localStorage.getItem(STORE_V2);
    if (!raw) return blocked2 ? JSON.parse(JSON.stringify(memory2)) : {};
    const t = JSON.parse(raw) as People;
    return t && typeof t === "object" ? t : {};
  } catch {
    blocked2 = true;
    return JSON.parse(JSON.stringify(memory2)) as People;
  }
}
function writePeople(t: People): void {
  Object.keys(memory2).forEach((k) => delete memory2[k]);
  Object.assign(memory2, t);
  try {
    window.localStorage.setItem(STORE_V2, JSON.stringify(t));
  } catch {
    blocked2 = true; // the draft survives this page only
  }
}

/** The table to work on. No person, or a guest: main's table. A person: their own table, after taking this question's draft from main's table if it has one (the first person to open the question gets it, once). */
function open(person: Owner | undefined, questionId?: string): { t: Table; commit: () => void } {
  // No person, or a guest: main's table (a guest's drafts are exactly the ones that have no person).
  if (person === undefined || person === null) { const t = read(); return { t, commit: () => write(t) }; }
  const all = readPeople();
  const mine = (all[pk(person)] ??= {});
  if (questionId !== undefined && currentOwner() === person) {
    const legacy = read();
    if (legacy[questionId] && !mine[questionId]) {
      mine[questionId] = legacy[questionId]; delete legacy[questionId]; write(legacy);
      writePeople(all);
    }
  }
  return { t: mine, commit: () => writePeople(all) };
}

function key(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** The draft still held for a question (not one that already posted). */
export function getDraft(questionId: string, person?: Owner): HeldDraft | undefined {
  if (!allowed(person)) return undefined;
  const d = open(person, questionId).t[questionId];
  return d && !d.posted ? d : undefined;
}

/** The record for a question including a draft that already posted. */
export function getRecord(questionId: string, person?: Owner): HeldDraft | undefined {
  if (!allowed(person)) return undefined;
  return open(person, questionId).t[questionId];
}

/** The draft posted for this payment: keep the record, stop waiting. */
export function markPosted(questionId: string, paymentId: string, person?: Owner): void {
  if (!allowed(person)) return;
  const { t, commit } = open(person, questionId);
  if (t[questionId]) {
    t[questionId] = { ...t[questionId], awaitingUnits: false, posted: paymentId };
    commit();
  }
}

/** Save the words for a question. Keeps the same post key for the same text, so a retry stays one post. */
export function saveDraft(questionId: string, body: string, now = Date.now(), person?: Owner): HeldDraft | undefined {
  if (!allowed(person)) return undefined;
  const text = body.trim();
  const { t, commit } = open(person, questionId);
  if (!text) {
    delete t[questionId];
    commit();
    return undefined;
  }
  const prev = t[questionId];
  const live = prev && !prev.posted ? prev : undefined;
  const d: HeldDraft = { questionId, body: text, key: live && live.body === text ? live.key : key(), savedAt: now, awaitingUnits: live?.awaitingUnits ?? false };
  t[questionId] = d;
  commit();
  return d;
}

/** The server refused the draft's key as spent: the same words get a new key, and stay held (with their waiting state). */
export function renewDraftKey(questionId: string, person?: Owner): void {
  if (!allowed(person)) return;
  const { t, commit } = open(person, questionId);
  const d = t[questionId];
  if (d && !d.posted) {
    t[questionId] = { ...d, key: key() };
    commit();
  }
}

export function setAwaiting(questionId: string, awaiting: boolean, person?: Owner): void {
  if (!allowed(person)) return;
  const { t, commit } = open(person, questionId);
  if (t[questionId]) {
    t[questionId] = { ...t[questionId], awaitingUnits: awaiting };
    commit();
  }
}

export function clearDraft(questionId: string, person?: Owner): void {
  if (!allowed(person)) return;
  const { t, commit } = open(person, questionId);
  delete t[questionId];
  commit();
}

/** The drafts waiting for units to arrive, newest first. A person sees their own, and main's (no person) ones, which they take when they open that question. */
export function awaitingDrafts(person?: Owner): HeldDraft[] {
  if (!allowed(person)) return [];
  const own = person === undefined || person === null ? {} : open(person).t;
  return [...Object.values(own), ...Object.values(read())]
    .filter((d) => d.awaitingUnits && !d.posted)
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** The question whose held draft was posted by this payment's units, if any (a second tab or browser reads this). */
export function findPostedFor(paymentId: string, person?: Owner): string | undefined {
  if (!allowed(person)) return undefined;
  const own = person === undefined || person === null ? {} : open(person).t;
  return [...Object.values(own), ...Object.values(read())].find((d) => d.posted === paymentId)?.questionId;
}

/** App start: any held draft kept more than 7 days is removed, whoever's it is. */
export function sweepOldHeld(now = Date.now()): void {
  const old = (d: HeldDraft) => draftIsStale({ savedAt: d.savedAt } as never, now);
  const legacy = read();
  let ch = false;
  for (const q of Object.keys(legacy)) if (old(legacy[q])) { delete legacy[q]; ch = true; }
  if (ch) write(legacy);
  const all = readPeople();
  ch = false;
  for (const k of Object.keys(all)) {
    for (const q of Object.keys(all[k])) if (old(all[k][q])) { delete all[k][q]; ch = true; }
    if (!Object.keys(all[k]).length) delete all[k];
  }
  if (ch) writePeople(all);
}
