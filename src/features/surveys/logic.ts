import { currentOwner } from "@/features/speak/draft";
import { SURVEY_KEEP_PREFIX } from "@/lib/auth/survey-keeps";
import type { SurveyAnswerInput, SurveyQuestionView } from "@/lib/api/surveys";

/** "About 1 min": about three questions a minute, never less than one. The API carries no time, so this is counted here. */
export function aboutMinutes(questions: number): number {
  return Math.max(1, Math.ceil(questions / 3));
}

/** One answer the person has given, kept on the page until the last question is sent. */
export type Given =
  | { kind: "choice"; optionId: string; label: string }
  | { kind: "text"; text: string }
  | { kind: "voice"; clipId: string; seconds: number };

export type GivenByQuestion = Record<string, Given>;

/** The body line for the answers, in question order. A skipped question is left out. */
export function toInputs(questions: SurveyQuestionView[], given: GivenByQuestion): SurveyAnswerInput[] {
  const out: SurveyAnswerInput[] = [];
  for (const q of questions) {
    const g = given[q.id];
    if (!g) continue;
    if (g.kind === "choice") out.push({ questionId: q.id, optionId: g.optionId });
    else if (g.kind === "text") out.push({ questionId: q.id, text: g.text.trim() });
    else out.push({ questionId: q.id, clipId: g.clipId });
  }
  return out;
}

/** "0:12" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The one place a person's own wording goes for the recap: what they chose, wrote or said. */
export function recapLine(g: Given): string {
  if (g.kind === "choice") return g.label;
  if (g.kind === "text") return g.text.trim();
  return `Voice answer, ${clock(g.seconds)}`;
}

/** Text answers are at most 500 characters (the API refuses 501). */
export const TEXT_MAX = 500;

// ---- What the page keeps for one survey in this tab (sessionStorage; every call is wrapped, a blocked store means nothing is kept) ----

// Every key carries the person's id (the token's subject) and the survey id, so another person on the same tab never finds it, shows it, sends it or deletes it.
// Signing out clears nothing: what a person kept is theirs and is there when they sign in again. The screen passes the person it was loaded for as `owner`
// (a stale tab must never write under whoever is signed in now); without it the person signed in now is used.
const keyFor = (id: string, what: "started" | "draft" | "skipped", owner?: string) => `${SURVEY_KEEP_PREFIX}${owner ?? currentOwner() ?? "unknown"}.${id}.${what}`;
const startedKey = (id: string, owner?: string) => keyFor(id, "started", owner);
const draftKey = (id: string, owner?: string) => keyFor(id, "draft", owner);
const skippedKey = (id: string, owner?: string) => keyFor(id, "skipped", owner);

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** True once START has gone for this survey in this tab. One START per person per survey: a reload or a second open does not send it again. */
export function wasStarted(id: string, owner?: string): boolean {
  try {
    return store()?.getItem(startedKey(id, owner)) === "1";
  } catch {
    return false;
  }
}
export function markStarted(id: string, owner?: string): void {
  try {
    store()?.setItem(startedKey(id, owner), "1");
  } catch {
    /* nothing kept */
  }
}

/** True once a SKIP has gone for this survey by this person in this tab. A SKIP goes at most once. */
export function wasSkipped(id: string, owner?: string): boolean {
  try {
    return store()?.getItem(skippedKey(id, owner)) === "1";
  } catch {
    return false;
  }
}
export function markSkipped(id: string, owner?: string): void {
  try {
    store()?.setItem(skippedKey(id, owner), "1");
  } catch {
    /* nothing kept */
  }
}

/** What a reload brings back: the position, the answers (voice clip ids too) and the sharing choices. */
export interface Draft {
  idx: number;
  given: GivenByQuestion;
  anonymous: boolean;
  shareState: boolean;
  ageBand: string;
}

export function saveDraft(id: string, d: Draft, owner?: string): void {
  try {
    const s = store();
    if (!s) return;
    if (Object.keys(d.given).length === 0 && d.idx === 0 && !d.anonymous && !d.shareState && !d.ageBand) s.removeItem(draftKey(id, owner));
    else s.setItem(draftKey(id, owner), JSON.stringify(d));
  } catch {
    /* nothing kept */
  }
}

export function clearDraft(id: string, owner?: string): void {
  try {
    store()?.removeItem(draftKey(id, owner));
  } catch {
    /* nothing kept */
  }
}

/** The saved draft for this survey, or null. Anything that does not fit the survey as it is now (a question or choice that is gone) is dropped. */
export function loadDraft(id: string, questions: SurveyQuestionView[], ageBands: string[], owner?: string): Draft | null {
  try {
    const raw = store()?.getItem(draftKey(id, owner));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    const given: GivenByQuestion = {};
    for (const q of questions) {
      const g = d.given?.[q.id] as Given | undefined;
      if (!g) continue;
      if (g.kind === "choice" && q.kind === "SINGLE_CHOICE" && q.options.some((o) => o.id === g.optionId)) given[q.id] = g;
      else if (g.kind === "text" && q.kind === "TEXT" && typeof g.text === "string") given[q.id] = { kind: "text", text: g.text.slice(0, TEXT_MAX) };
      else if (g.kind === "voice" && q.kind === "VOICE" && typeof g.clipId === "string" && g.clipId) given[q.id] = { kind: "voice", clipId: g.clipId, seconds: Number(g.seconds) || 0 };
    }
    const idx = Number.isInteger(d.idx) ? Math.min(Math.max(d.idx as number, 0), questions.length - 1) : 0;
    const band = typeof d.ageBand === "string" && ageBands.includes(d.ageBand) ? d.ageBand : "";
    return { idx, given, anonymous: d.anonymous === true, shareState: d.shareState === true, ageBand: band };
  } catch {
    return null;
  }
}
