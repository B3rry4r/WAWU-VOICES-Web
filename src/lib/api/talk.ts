import type { components } from "./types";
import { apiFetch } from "./client";
import { guestId } from "./feed";

type S = components["schemas"];
export type Question = S["Question"];
export type Answer = S["Answer"];
export type AnswerPage = S["AnswerPage"];
export type Reply = S["Reply"];
export type ReplyPage = S["ReplyPage"];
export type Allowances = S["Allowances"];
export type ReactionKindInfo = S["ReactionKindInfo"];
export type ReactionKind = S["ReactionKind"];
export type ReactionState = S["ReactionState"];
export type LikeState = S["LikeState"];
export type PostReceipt = S["PostReceipt"];
export type ReplyReceipt = S["ReplyReceipt"];
export type ReportReceipt = S["ReportReceipt"];
export type ReportReason = S["ReportReason"];
export type ReportTargetType = S["ReportTargetType"];
export type ShareLink = S["ShareLink"];
export type ReplyStance = S["ReplyStance"];
export type NewsTag = S["NewsTag"];
export type AnswerSort = "TOP" | "NEW" | "DEBATED";

const guestHeaders = () => {
  const g = guestId();
  return g ? { "X-Guest-Id": g } : undefined;
};
const read = () => ({ authed: true, headers: guestHeaders() }) as const;

function qs(p: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}
const id = encodeURIComponent;

export const getQuestion = (qid: string) => apiFetch<Question>(`/questions/${id(qid)}`, read());
export const listAnswers = (qid: string, sort: AnswerSort, cursor?: string) =>
  apiFetch<AnswerPage>(`/questions/${id(qid)}/answers${qs({ sort, cursor, limit: 10 })}`, read());
export const getAnswer = (aid: string) => apiFetch<Answer>(`/answers/${id(aid)}`, read());
export const listReplies = (aid: string, stance?: ReplyStance, cursor?: string) =>
  apiFetch<ReplyPage>(`/answers/${id(aid)}/replies${qs({ stance, cursor, limit: 20 })}`, read());
/** GET /me/allowance is not served yet (SHARED-1a wires it); GET /wallet carries the same Allowances object. Move to /me/allowance once served. */
export const getAllowance = async () => (await apiFetch<{ allowances: Allowances }>("/wallet", { authed: true })).allowances;
export const listReactionKinds = () => apiFetch<{ items: ReactionKindInfo[] }>("/reactions");

export const likeAnswer = (aid: string) => apiFetch<LikeState>(`/answers/${id(aid)}/like`, { method: "PUT", ...read() });
export const unlikeAnswer = (aid: string) => apiFetch<LikeState>(`/answers/${id(aid)}/like`, { method: "DELETE", ...read() });
export const setReaction = (aid: string, kind: ReactionKind, key: string) =>
  apiFetch<ReactionState>(`/answers/${id(aid)}/reaction`, { method: "PUT", authed: true, body: { kind }, idempotencyKey: key });
export const removeReaction = (aid: string) => apiFetch<ReactionState>(`/answers/${id(aid)}/reaction`, { method: "DELETE", authed: true });

export interface NewsInput { isNews: boolean; newsTag?: NewsTag }
export const createAnswer = (qid: string, body: string, news: NewsInput, key: string) =>
  apiFetch<PostReceipt>(`/questions/${id(qid)}/answers`, {
    method: "POST",
    authed: true,
    idempotencyKey: key,
    body: { kind: "TEXT", body, ...(news.isNews ? { isNews: true, newsTag: news.newsTag } : {}) },
  });
export const createReply = (aid: string, stance: ReplyStance, body: string, key: string) =>
  apiFetch<ReplyReceipt>(`/answers/${id(aid)}/replies`, { method: "POST", authed: true, idempotencyKey: key, body: { stance, kind: "TEXT", body } });
export const deleteReply = (rid: string) => apiFetch<void>(`/replies/${id(rid)}`, { method: "DELETE", authed: true });
export const markHelpful = (aid: string) => apiFetch<void>(`/answers/${id(aid)}/helpful`, { method: "PUT", authed: true });
export const unmarkHelpful = (aid: string) => apiFetch<void>(`/answers/${id(aid)}/helpful`, { method: "DELETE", authed: true });

export const saveQuestion = (qid: string) => apiFetch<void>(`/questions/${id(qid)}/save`, { method: "PUT", authed: true });
export const unsaveQuestion = (qid: string) => apiFetch<void>(`/questions/${id(qid)}/save`, { method: "DELETE", authed: true });

export const createReport = (body: { targetType: ReportTargetType; targetId: string; reason: ReportReason; note?: string; alsoBlock?: boolean }) =>
  apiFetch<ReportReceipt>("/reports", { method: "POST", authed: true, body });
export const blockUser = (uid: string) => apiFetch<void>(`/me/blocks/${id(uid)}`, { method: "PUT", authed: true });
export const unblockUser = (uid: string) => apiFetch<void>(`/me/blocks/${id(uid)}`, { method: "DELETE", authed: true });

export const createShareLink = (objectType: "QUESTION" | "ANSWER", objectId: string) =>
  apiFetch<ShareLink>("/share/links", { method: "POST", authed: true, body: { objectType, objectId } });
export const shareEvent = (code: string, kind: string) =>
  apiFetch<void>(`/share/${id(code)}/events`, { method: "POST", authed: true, body: { kind } }).catch(() => undefined);

export const getPlayUrl = (clipId: string) => apiFetch<{ url: string; expiresAt: string; mime: string }>(`/voice-clips/${id(clipId)}/play`, read());
export const countListen = (aid: string) =>
  apiFetch<void>(`/answers/${id(aid)}/listen`, { method: "POST", body: { completed: false, positionMs: 0 }, ...read() }).catch(() => undefined);
