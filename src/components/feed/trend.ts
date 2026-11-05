import type { Question } from "@/lib/api/feed";

/** Rows for the design system's TrendingList: question, voices, category, and the conversation it opens. */
export function trendItems(qs: Question[]) {
  return qs.map((q) => ({ question: q.text, voices: q.voiceCount, category: q.category?.name, href: `/q/${q.id}` }));
}
