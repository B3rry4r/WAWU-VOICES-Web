import type { components } from "./types";
import { apiFetch } from "./client";
import { guestId } from "./feed";

type S = components["schemas"];
export type Poll = S["Poll"];
export type VoteReceipt = S["VoteReceipt"];
export type Allowances = S["Allowances"];
export type AdPlacement = S["AdPlacement"];

const guestHeaders = () => {
  const g = guestId();
  return g ? { "X-Guest-Id": g } : undefined;
};

/** The open flash polls, newest first. Guests and signed-in people read the same list; `myVote` is theirs. */
export const getFlashPolls = () => apiFetch<S["PollList"]>("/polls/flash", { authed: true });

/** One vote per account. The key makes a double tap one vote. */
export const castVote = (pollId: string, optionId: string, idempotencyKey: string) =>
  apiFetch<VoteReceipt>(`/polls/${encodeURIComponent(pollId)}/votes`, { method: "POST", authed: true, idempotencyKey, body: { optionIds: [optionId] } });

/** What a vote costs this person right now (free votes left today, the price after). Signed in with a finished profile only. */
export const getVoteAllowance = () => apiFetch<Allowances>("/me/allowance?action=VOTE", { authed: true });

/** The approved ad for a slot, or null where none may show. */
export const getAdPlacement = async (kind = "FEED_CARD", categoryId?: string): Promise<AdPlacement | null> => {
  const q = new URLSearchParams({ kind });
  if (categoryId) q.set("categoryId", categoryId);
  const r = await apiFetch<S["AdPlacementResponse"]>(`/ads/placement?${q}`, { authed: true, headers: guestHeaders() });
  return r.ad;
};

export const recordAdEvent = (adId: string, kind: S["AdEventKind"]) =>
  apiFetch<void>(`/ads/${encodeURIComponent(adId)}/events`, { method: "POST", authed: true, headers: guestHeaders(), body: { kind } });
