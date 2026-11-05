import type { Answer } from "@/lib/api/feed";

/** "9h", "2 days", "45 min": time left until an ISO instant. */
export function closesIn(endsAt: string | null | undefined, now = Date.now()): string | undefined {
  if (!endsAt) return undefined;
  const ms = Date.parse(endsAt) - now;
  if (!(ms > 0)) return undefined;
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day" : `${d} days`;
}

/** "2h", "3d", "just now": time since an ISO instant. */
export function ago(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)}d`;
}

export function voicesLabel(n: number): string {
  return `${n.toLocaleString("en-NG")} ${n === 1 ? "voice" : "voices"}`;
}

export function weekMeta(t: { weekNumber: number; questionCount: number }, pollOpen: boolean): string {
  return `Week ${t.weekNumber} · ${t.questionCount} ${t.questionCount === 1 ? "question" : "questions"}${pollOpen ? " · Poll open" : ""}`;
}

const EMOJI: Record<string, string> = {
  POWERFUL: "🔥", WILD: "💀", RELATABLE: "❤️", FUNNY: "😂", SURPRISING: "😮", SAD: "😢", WELL_SAID: "👏", THOUGHT_PROVOKING: "🤔", EXACTLY: "💯", DISAGREE: "👎",
};
const LABEL: Record<string, string> = {
  TRENDING: "Trending", MOST_RELATABLE: "Most Relatable", MOST_THOUGHT_PROVOKING: "Most Thought-provoking", MOST_DEBATED: "Most Debated", MOST_SUPPORTED: "Most Supported", MOST_SURPRISING: "Most Surprising",
};
const NEWS = { VERIFIED_NEWS: "verified", UNVERIFIED_NEWS: "unverified", GOSSIP: "gossip" } as const;

/** Props for the design system's AnswerCard from an API Answer. */
export function answerCardProps(a: Answer) {
  const secs = a.clip?.durationMs ? Math.max(1, Math.round(a.clip.durationMs / 1000)) : 0;
  const seed = a.id.split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 997, 7);
  const label = a.labels.find((l) => l !== "TRENDING") ?? a.labels[0];
  return {
    author: a.author ? { handle: `@${a.author.handle}`, name: a.author.displayName ?? a.author.handle } : { name: "Anonymous" },
    time: ago(a.createdAt),
    place: a.author?.state ?? undefined,
    text: a.kind === "TEXT" ? (a.body ?? undefined) : undefined,
    voice: a.kind === "VOICE" && a.clip ? { duration: secs, seed, transcript: a.clip.transcript?.text ?? undefined } : undefined,
    likes: a.likeCount,
    liked: a.iLiked,
    replies: a.replyCount,
    reactions: a.reactionCount ? { top: a.reactionBreakdown.slice(0, 3).map((r) => EMOJI[r.kind] ?? "").filter(Boolean), total: a.reactionCount } : undefined,
    label: label ? LABEL[label] : undefined,
    tag: a.news ? NEWS[a.news.tag] : undefined,
  };
}
