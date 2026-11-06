import type { Question } from "@/lib/api/feed";
import { voicesOf } from "@/lib/feed-format";

/** Rows for the design system's TrendingList: question, voices, category, and the conversation it opens. */
export function trendItems(qs: Question[]) {
  return qs.map((q) => ({ question: q.text, voices: voicesOf(q), category: q.category?.name, href: `/q/${q.id}` }));
}
