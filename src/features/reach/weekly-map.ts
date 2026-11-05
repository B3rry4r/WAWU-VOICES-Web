import type { PollResults, WeeklyReport } from "@/lib/api/reach";

/** What the report's untyped pollSummary may carry: the headline percent, its sentence, and the poll to show in full (id and question). */
export interface PollSummaryView {
  pct: number;
  text: string;
  pollId: string | null;
  /** The poll's question, when the report carries it (PollResults has no title). */
  title: string | null;
}

/** pollSummary is untyped in the contract. Reads {pct, text, pollId}, or a {line} such as "41% A stable naira led the vote". Null when nothing usable. */
export function readPollSummary(v: unknown): PollSummaryView | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const pollId = typeof o.pollId === "string" ? o.pollId : null;
  const title = typeof o.title === "string" && o.title ? o.title : null;
  let pct = typeof o.pct === "number" ? o.pct : NaN;
  let text = typeof o.text === "string" ? o.text : "";
  if (typeof o.line === "string" && (Number.isNaN(pct) || !text)) {
    const m = /^\s*(\d{1,3})\s*%\s*(.*)$/.exec(o.line);
    if (m) {
      if (Number.isNaN(pct)) pct = Number(m[1]);
      if (!text) text = m[2];
    }
  }
  if (Number.isNaN(pct) || !text) return null;
  return { pct: Math.round(pct), text, pollId, title };
}

/** themes is untyped: [{label, count}]. Anything else is dropped. */
export function readThemes(v: unknown): { text: string; voices: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { text: string; voices: number }[] = [];
  for (const t of v) {
    if (t && typeof t === "object") {
      const o = t as Record<string, unknown>;
      if (typeof o.label === "string" && o.label) out.push({ text: o.label, voices: Number(o.count ?? 0) || 0 });
    }
  }
  return out.slice(0, 3);
}

/** Mood rows: name, percent, change in points on last week. */
export function moodRows(r: Pick<WeeklyReport, "emotions">): { label: string; pct: number; delta: number }[] {
  return r.emotions.map((e) => ({ label: e.name, pct: Math.round(e.share), delta: Math.round(e.change) }));
}

/** The three rows the weekly share card draws: the poll's top three when the poll is known, else the top three moods. */
export function cardRows(r: WeeklyReport, poll: PollResults | null): { label: string; pct: number }[] {
  if (poll && poll.totalVotes > 0) {
    return [...poll.options]
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .slice(0, 3)
      .map((o) => ({ label: o.label, pct: Math.round(((o.votes ?? 0) * 100) / poll.totalVotes) }));
  }
  return [...r.emotions].sort((a, b) => b.share - a.share).slice(0, 3).map((e) => ({ label: e.name, pct: Math.round(e.share) }));
}
