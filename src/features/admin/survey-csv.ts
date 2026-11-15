import { TOO_FEW_LEFT, choiceShown, listHidden, otherShown, underFloor } from "./survey-floor";
import type { SurveyReport } from "@/lib/api/admin-surveys";

/** One CSV cell. Quotes are doubled; a cell that a spreadsheet could read as a formula gets a leading apostrophe. */
export function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A second check on a free answer or transcript after the server's own: an email, a link, an @handle or a long run of digits is replaced.
 * The server removes these by pattern; this is only for the case where one slipped through. It cannot find a name typed in plain words.
 */
export function scrub(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[removed]")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[removed]")
    .replace(/(^|[\s(])@\w{2,}/g, "$1[removed]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[removed]");
}

export const CSV_HEAD = ["Section", "Question", "Answer", "Count", "Share (%)", "Seconds"] as const;

/** A released report has its totals; one that is still running or in review does not, and there is nothing to save. */
export function isReleased(r: SurveyReport): boolean {
  return r.released === true && r.stage === "RELEASED" && !!r.totals;
}

/** Whether the per-person parts (choices, free answers, breakdowns) may be shown. Never below the floor, whatever the flag says. */
export function showsPeople(r: SurveyReport): boolean {
  const floor = r.minGroupSize ?? 20;
  return !!r.totals && r.belowMinimum !== true && (r.totals.responses ?? 0) >= floor;
}

/**
 * The brand's results as a CSV, built only from the released report body the API returned (the same numbers the page shows).
 * No id and no time is written. A hidden option says "hidden" in the Count column; the hidden choices together are one "Other" line.
 * Below the minimum only views, starts and skips appear.
 */
export function reportToCsv(r: SurveyReport): string {
  const rows: (string | number | null)[][] = [];
  const row = (section: string, question = "", answer: string | number | null = "", count: number | string | null = null, share: number | null = null, seconds: number | null = null) =>
    rows.push([section, question, answer, count, share, seconds]);
  row("Survey", "", `${r.survey.brandName}: ${r.survey.title}`);
  const t = r.totals;
  if (t) {
    row("Totals", "", "Views", t.views);
    row("Totals", "", "Started", t.starts);
    row("Totals", "", "Skipped", t.skips);
  }
  if (!t || !showsPeople(r)) {
    row("Note", "", r.note);
  } else {
    row("Totals", "", "Answers", t.responses);
    row("Totals", "", "Completion rate (%)", t.completionRate);
    for (const q of r.questions ?? []) {
      if (q.answered === null || q.answered === undefined) {
        row("Note", q.prompt, "Too few answers to show");
      } else if (q.kind === "SINGLE_CHOICE") {
        for (const o of q.options) { const on = choiceShown(o, r.minGroupSize ?? 20); row("Choice", q.prompt, o.label, on ? o.count : "hidden", on ? o.share : null); }
        if (q.other && otherShown(q.other, r.minGroupSize ?? 20)) row("Choice", q.prompt, q.other.label, q.other.count, q.other.share);
      } else if (listHidden(q)) {
        row("Note", q.prompt, TOO_FEW_LEFT);
      } else if (q.kind === "TEXT") {
        for (const x of q.texts) row("Free answer", q.prompt, scrub(x));
      } else {
        for (const v of q.voices) row("Voice answer", q.prompt, scrub(v.transcript), null, null, v.seconds);
      }
    }
    const st = underFloor(r.byState ?? [], r.byStateOther, r.minGroupSize ?? 20);
    for (const s of st.rows) row("State", "", s.state, s.responses, s.share);
    if (st.other) row("State", "", "Other", st.other.responses, st.other.share);
    const ag = underFloor(r.byAgeBand ?? [], r.byAgeBandOther, r.minGroupSize ?? 20);
    for (const a of ag.rows) row("Age band", "", a.ageBand, a.responses, a.share);
    if (ag.other) row("Age band", "", "Other", ag.other.responses, ag.other.share);
    if (r.note) row("Note", "", r.note);
  }
  return "﻿" + [CSV_HEAD.map((h) => cell(h)).join(","), ...rows.map((x) => x.map((v) => cell(v)).join(","))].join("\r\n") + "\r\n";
}

/** "survey-results-zobo-fresh-power-and-light.csv" */
export function csvFileName(r: SurveyReport): string {
  const slug = `${r.survey.brandName} ${r.survey.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `survey-results-${slug || "export"}.csv`;
}
