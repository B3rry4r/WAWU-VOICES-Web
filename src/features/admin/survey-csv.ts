import type { SurveyReport } from "@/lib/api/admin-surveys";

/** One CSV cell. Quotes are doubled; a cell that a spreadsheet could read as a formula gets a leading apostrophe. */
export function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEAD = ["Section", "Question", "Answer", "Count", "Share (%)", "Seconds"] as const;

/**
 * The brand's results as a CSV, built only from the report body the API returned (the same numbers the page shows).
 * No id and no time is written. A hidden option has an empty count and share; below the minimum only views, starts and skips appear.
 */
export function reportToCsv(r: SurveyReport): string {
  const rows: (string | number | null)[][] = [];
  const row = (section: string, question = "", answer: string | number | null = "", count: number | null = null, share: number | null = null, seconds: number | null = null) =>
    rows.push([section, question, answer, count, share, seconds]);
  row("Survey", "", `${r.survey.brandName}: ${r.survey.title}`);
  row("Totals", "", "Views", r.totals.views);
  row("Totals", "", "Started", r.totals.starts);
  row("Totals", "", "Skipped", r.totals.skips);
  if (r.belowMinimum) {
    row("Note", "", r.note);
  } else {
    row("Totals", "", "Answers", r.totals.responses);
    row("Totals", "", "Completion rate (%)", r.totals.completionRate);
    for (const q of r.questions) {
      if (q.kind === "SINGLE_CHOICE") {
        for (const o of q.options) row("Choice", q.prompt, o.label, o.hidden ? null : o.count, o.hidden ? null : o.share);
      } else if (q.kind === "TEXT") {
        for (const t of q.texts) row("Free answer", q.prompt, t);
      } else {
        for (const v of q.voices) row("Voice answer", q.prompt, v.transcript, null, null, v.seconds);
      }
    }
    for (const s of r.byState) row("State", "", s.state, s.responses, s.share);
    for (const a of r.byAgeBand) row("Age band", "", a.ageBand, a.responses, a.share);
    if (r.note) row("Note", "", r.note);
  }
  return "﻿" + [CSV_HEAD.map((h) => cell(h)).join(","), ...rows.map((x) => x.map((v) => cell(v)).join(","))].join("\r\n") + "\r\n";
}

/** "survey-results-zobo-fresh-power-and-light.csv" */
export function csvFileName(r: SurveyReport): string {
  const slug = `${r.survey.brandName} ${r.survey.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `survey-results-${slug || "export"}.csv`;
}
