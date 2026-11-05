import { apiFetch } from "./client";
import type { components } from "./types";

export type NewsTag = components["schemas"]["NewsTag"];
export type NewsAnswer = components["schemas"]["Answer"];
export type NewsPostPage = components["schemas"]["NewsPostPage"];
export type TagInfo = components["schemas"]["TagInfo"];
export type NewsReply = components["schemas"]["Reply"];
export type ReplyPage = components["schemas"]["ReplyPage"];
export type LikeState = components["schemas"]["LikeState"];
export type ReactionState = components["schemas"]["ReactionState"];
export type ReactionKind = components["schemas"]["ReactionKind"];
export type PlayUrl = components["schemas"]["PlayUrl"];

const GUEST_KEY = "voices-guest-id";

/** A guest's likes need a client-made id (X-Guest-Id). Kept in the browser; falls back to a fresh id per call when storage is blocked. */
export function guestId(): string {
  const fresh = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000000");
  if (typeof window === "undefined") return fresh();
  try {
    const have = window.localStorage.getItem(GUEST_KEY);
    if (have) return have;
    const id = fresh();
    window.localStorage.setItem(GUEST_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

export function listNews(o: { tag?: NewsTag | null; cursor?: string | null; limit?: number } = {}): Promise<NewsPostPage> {
  const q = new URLSearchParams();
  if (o.tag) q.set("tag", o.tag);
  if (o.cursor) q.set("cursor", o.cursor);
  if (o.limit) q.set("limit", String(o.limit));
  const qs = q.toString();
  return apiFetch<NewsPostPage>(`/news${qs ? "?" + qs : ""}`, { authed: true });
}

export function listNewsTags(): Promise<{ items: TagInfo[] }> {
  return apiFetch<{ items: TagInfo[] }>("/news/tags", { authed: true });
}

export function getNewsPost(answerId: string): Promise<NewsAnswer> {
  return apiFetch<NewsAnswer>(`/news/${encodeURIComponent(answerId)}`, { authed: true });
}

export function listReplies(answerId: string, o: { cursor?: string | null; limit?: number } = {}): Promise<ReplyPage> {
  const q = new URLSearchParams();
  if (o.cursor) q.set("cursor", o.cursor);
  if (o.limit) q.set("limit", String(o.limit));
  const qs = q.toString();
  return apiFetch<ReplyPage>(`/answers/${encodeURIComponent(answerId)}/replies${qs ? "?" + qs : ""}`, { authed: true });
}

export function setTagFollows(tags: NewsTag[]): Promise<{ tags: NewsTag[] }> {
  return apiFetch<{ tags: NewsTag[] }>("/me/tag-follows", { method: "PUT", authed: true, body: { tags } });
}

/** Flag a news post's tag as misleading. An editor reviews every flag. */
export function flagNewsTag(answerId: string, note?: string): Promise<{ id: string; status: string; blocked: boolean }> {
  return apiFetch(`/news/${encodeURIComponent(answerId)}/flag`, { method: "POST", authed: true, body: note ? { note } : {} });
}

export function likeAnswer(answerId: string, on: boolean, signedIn: boolean): Promise<LikeState> {
  return apiFetch<LikeState>(`/answers/${encodeURIComponent(answerId)}/like`, {
    method: on ? "PUT" : "DELETE",
    authed: signedIn,
    headers: signedIn ? undefined : { "X-Guest-Id": guestId() },
  });
}

export function setReaction(answerId: string, kind: ReactionKind | null, idempotencyKey: string): Promise<ReactionState> {
  const path = `/answers/${encodeURIComponent(answerId)}/reaction`;
  return kind
    ? apiFetch<ReactionState>(path, { method: "PUT", authed: true, body: { kind }, idempotencyKey })
    : apiFetch<ReactionState>(path, { method: "DELETE", authed: true });
}

export function getPlayUrl(clipId: string): Promise<PlayUrl> {
  return apiFetch<PlayUrl>(`/voice-clips/${encodeURIComponent(clipId)}/play`, { authed: true });
}
