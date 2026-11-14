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
