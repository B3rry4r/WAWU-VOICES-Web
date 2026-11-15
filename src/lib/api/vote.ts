import { apiFetch } from "./client";
import type { components } from "./types";

type S = components["schemas"];
export type Question = S["Question"];
export type Poll = S["Poll"];
export type PollResults = S["PollResults"];
export type VoteReceipt = S["VoteReceipt"];
export type Allowances = S["Allowances"];
export type PublicConfig = S["PublicConfig"];
export type WhatNext = S["WhatNext"];
export type Proposal = S["Proposal"];
export type ProposalPage = S["ProposalPage"];
export type ProposalGroup = S["ProposalGroup"];
export type ProposalReceipt = S["ProposalReceipt"];
export type PostReceipt = S["PostReceipt"];
export type EditorialSummary = S["EditorialSummary"];
export type ProposalSort = "SUPPORT" | "NEW";

const GUEST_KEY = "voices-guest-id";

/** A guest's reads carry a client-made id (X-Guest-Id), kept in the browser (V-15). */
function guestHeaders(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(GUEST_KEY, id);
    }
    return { "X-Guest-Id": id };
  } catch {
    return undefined;
  }
}

const read = () => ({ authed: true, headers: guestHeaders() }) as const;
const enc = encodeURIComponent;

/** One idempotency key per tap on a paid or posting action; a retry of the same tap reuses it. */
export function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const getQuestion = (id: string) => apiFetch<Question>(`/questions/${enc(id)}`, read());
export const listQuestionPolls = (questionId: string) => apiFetch<S["PollList"]>(`/questions/${enc(questionId)}/polls`, read());
export const getPoll = (pollId: string) => apiFetch<Poll>(`/polls/${enc(pollId)}`, read());
export const getPollResults = (pollId: string) => apiFetch<PollResults>(`/polls/${enc(pollId)}/results`, read());
export const getPublicConfig = () => apiFetch<PublicConfig>("/config/public");
/** What the person can do now and what it costs: free votes left today, balance, costs (GET /me/allowance). */
export const getVoteAllowance = () => apiFetch<Allowances>("/me/allowance", { authed: true });

/** The paid action: the key makes a repeat of the same tap safe. A 402 or 409 comes back as an ApiError. */
export const castVote = (pollId: string, optionIds: string[], idempotencyKey: string) =>
  apiFetch<VoteReceipt>(`/polls/${enc(pollId)}/votes`, { method: "POST", authed: true, idempotencyKey, body: { optionIds } });

/**
 * `mood` is the one word of a mood question (LCH-02): its explanations are answers and carry one. `questionId` is the
 * question the person came from (H2): a weekly poll has none of its own, so the reason is posted under the question
 * whose words they were shown.
 */
export const explainMyVote = (pollId: string, body: string, idempotencyKey: string, mood?: S["Mood"] | null, questionId?: string) =>
  apiFetch<PostReceipt>(`/polls/${enc(pollId)}/explanation`, { method: "POST", authed: true, idempotencyKey, body: { kind: "TEXT", body, ...(mood ? { mood } : {}), ...(questionId ? { questionId } : {}) } });

/** Explain my vote by voice: the clip (purpose VOTE_EXPLANATION) is already uploaded and READY. Free, like the written reason. */
export const explainMyVoteByVoice = (pollId: string, clipId: string, idempotencyKey: string, mood?: S["Mood"] | null, questionId?: string, expectSubject?: string) =>
  apiFetch<PostReceipt>(`/polls/${enc(pollId)}/explanation`, { method: "POST", authed: true, expectSubject, idempotencyKey, body: { kind: "VOICE", clipId, ...(mood ? { mood } : {}), ...(questionId ? { questionId } : {}) } });

export const getWhatNext = (questionId: string, sort: ProposalSort = "SUPPORT") =>
  apiFetch<WhatNext>(`/questions/${enc(questionId)}/what-next?sort=${sort}`, read());

export const listProposals = (questionId: string, sort: ProposalSort, cursor?: string | null) =>
  apiFetch<ProposalPage>(`/questions/${enc(questionId)}/proposals?sort=${sort}&limit=20${cursor ? `&cursor=${enc(cursor)}` : ""}`, read());

export const similarProposals = (questionId: string, text: string) =>
  apiFetch<S["ProposalList"]>(`/questions/${enc(questionId)}/proposals/similar?text=${enc(text)}`, read());

export const createProposal = (questionId: string, body: string, idempotencyKey: string, improvesId?: string) =>
  apiFetch<ProposalReceipt>(`/questions/${enc(questionId)}/proposals`, {
    method: "POST",
    authed: true,
    idempotencyKey,
    body: { kind: "TEXT", body, ...(improvesId ? { improvesId } : {}) },
  });

export const setStance = (proposalId: string, kind: "SUPPORT" | "CHALLENGE") =>
  apiFetch<Proposal>(`/proposals/${enc(proposalId)}/stance`, { method: "PUT", authed: true, body: { kind } });
export const removeStance = (proposalId: string) => apiFetch<Proposal>(`/proposals/${enc(proposalId)}/stance`, { method: "DELETE", authed: true });

export type AdPlacement = S["AdPlacement"];
/** The approved banner for this question, or null where no ad may show. */
export const getBannerAd = async (questionId: string): Promise<AdPlacement | null> =>
  (await apiFetch<S["AdPlacementResponse"]>(`/ads/placement?kind=BANNER&questionId=${enc(questionId)}`, read())).ad ?? null;
export const recordAdEvent = (adId: string, kind: "IMPRESSION" | "TAP") =>
  apiFetch<void>(`/ads/${enc(adId)}/events`, { method: "POST", authed: true, headers: guestHeaders(), body: { kind } });

export type Topic = S["Topic"];
export const getTopic = (topicId: string) => apiFetch<Topic>(`/topics/${enc(topicId)}`, read());

/** Every poll on a question's conversation: the week's poll of its topic first, then polls made for the question itself. */
export async function loadQuestionPolls(question: Question): Promise<Poll[]> {
  const [own, topic] = await Promise.all([listQuestionPolls(question.id), question.topicId ? getTopic(question.topicId).catch(() => null) : Promise.resolve(null)]);
  const weeklyId = topic?.weeklyPollId ?? null;
  const weekly = weeklyId && !own.items.some((p) => p.id === weeklyId) ? await getPoll(weeklyId).catch(() => null) : null;
  return weekly ? [weekly, ...own.items] : own.items;
}
