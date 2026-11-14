import { tokensLabel } from "@/lib/shared/text-price";
import type { Answer } from "@/lib/api/feed";
import { countdown, dayKey, longDay } from "@/lib/format/date";

/** "9h", "2 days", "45 min": time left until an ISO instant (the shared countdown). */
export function closesIn(endsAt: string | null | undefined, now = Date.now()): string | undefined {
  if (!endsAt) return undefined;
  return countdown(Date.parse(endsAt) - now);
}

/** "2h", "3d", "just now": time since an ISO instant. */
export function ago(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)}d`;
}

/** 12.4K, 21.4K, 8,200: the compact count the boards use on tiles and chips. */
export function shortCount(n: number): string {
  if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`;
  if (n >= 1e4) return `${Math.round(n / 100) / 10}K`;
  return n.toLocaleString("en-NG");
}

/** "8,200 voices", "12.4K voices": the voice count as the boards write it. */
export function voicesShort(n: number): string {
  return `${shortCount(n)} ${n === 1 ? "voice" : "voices"}`;
}

/** Open for answers and votes: not closed, and inside its window (V-27). */
export function isOpen(q: { status: string; startsAt: string | null; endsAt: string | null }, now = Date.now()): boolean {
  if (q.status === "CLOSED" || q.status === "DRAFT") return false;
  if (q.startsAt && Date.parse(q.startsAt) > now) return false;
  if (q.endsAt && Date.parse(q.endsAt) <= now) return false;
  return true;
}

/** V-PRELAUNCH: scheduled and not yet inside its window. The API says SCHEDULED for such a question; the date decides the rest. */
export function notOpenYet(q: { status: string; startsAt: string | null }, now = Date.now()): boolean {
  return q.status === "SCHEDULED" && !!q.startsAt && Date.parse(q.startsAt) > now;
}

/** "Opens Sunday 15 November" (the Lagos day of `startsAt`). */
export function opensLabel(q: { startsAt: string | null }): string | undefined {
  return q.startsAt ? `Opens ${longDay(q.startsAt)}` : undefined;
}

/** The label to give a card for a question that has not opened (undefined once it has): the card then shows no counts and no actions. */
export function comingUp(q: { status: string; startsAt: string | null }, now = Date.now()): string | undefined {
  return notOpenYet(q, now) ? opensLabel(q) : undefined;
}

/** A topic whose week has not begun: the API says SCHEDULED, and its first day is after today (Lagos). */
export function topicNotStarted(t: { status: string; startsOn: string }, now = Date.now()): boolean {
  return t.status === "SCHEDULED" && t.startsOn > dayKey(now);
}

/** "Starts Monday 16 November": `startsOn` is a Lagos calendar day. */
export function startsLabel(t: { startsOn: string }): string {
  return `Starts ${longDay(`${t.startsOn}T12:00:00+01:00`)}`;
}

/** "0.2 tokens", "1 token", "16.67 tokens": tokens from milli-tokens. */
export function unitsLabel(milli: number): string {
  return `${tokensLabel(milli)} ${milli === 1000 ? "token" : "tokens"}`;
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
    author: a.author ? { handle: `@${a.author.handle}`, name: a.author.displayName ?? a.author.handle, verified: a.author.verified === true } : { name: "Anonymous" },
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

/** lead ruling WF, 6 Nov (A-L5): an avatar stack never shows the same person twice. Keeps the first of each handle. */
export function uniqueVoices<T extends { handle: string }>(voices: T[]): T[] {
  const seen = new Set<string>();
  return voices.filter((v) => (seen.has(v.handle) ? false : (seen.add(v.handle), true)));
}

/** The one voices count (lead ruling WF, 6 Nov, RW1): top-level answers, voice or text. voiceCount stays the number of voice clips and is never shown as "voices". */
export function voicesOf(x: { voicesCount?: number | null; answerCount?: number; voiceCount: number }): number {
  return x.voicesCount ?? x.answerCount ?? x.voiceCount;
}
