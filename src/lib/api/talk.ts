import type { components } from "./types";
import { apiFetch } from "./client";
import { guestId } from "./feed";
import { visitorId } from "./visitor";

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
export type TextFixResult = S["TextFixResult"];
export type TextFixChange = S["TextFixChange"];
export type AnswerSort = "TOP" | "NEW" | "DEBATED";

const guestHeaders = () => {
  const g = guestId();
  return g ? { "X-Guest-Id": g } : undefined;
};
const read = () => ({ authed: true, headers: guestHeaders() }) as const;
/** A listen report also carries the browser's visitor id (cookie), so a guest counts once per voice. The server ignores it for a signed-in person. */
const listenHeaders = () => {
  const v = visitorId();
  return { ...guestHeaders(), ...(v ? { "X-Visitor-Id": v } : {}) };
};

function qs(p: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}
const id = encodeURIComponent;

export const getQuestion = (qid: string) => apiFetch<Question>(`/questions/${id(qid)}`, read());
export const listAnswers = (qid: string, sort: AnswerSort, cursor?: string, mood?: S["Mood"]) =>
  apiFetch<AnswerPage>(`/questions/${id(qid)}/answers${qs({ sort, cursor, limit: 10, mood })}`, read());
export const getAnswer = (aid: string) => apiFetch<Answer>(`/answers/${id(aid)}`, read());
export const listReplies = (aid: string, stance?: ReplyStance, cursor?: string) =>
  apiFetch<ReplyPage>(`/answers/${id(aid)}/replies${qs({ stance, cursor, limit: 20 })}`, read());
export const getAllowance = () => apiFetch<Allowances>("/me/allowance", { authed: true });
/** LCH-12: the AI fixes spelling, typos and grammar. 5 tokens, charged once per key and only when a fix comes back. */
export const fixText = (text: string, key: string) => apiFetch<TextFixResult>("/text/fix", { method: "POST", authed: true, idempotencyKey: key, body: { text } });
export const listReactionKinds = () => apiFetch<{ items: ReactionKindInfo[] }>("/reactions");

export const likeAnswer = (aid: string) => apiFetch<LikeState>(`/answers/${id(aid)}/like`, { method: "PUT", ...read() });
export const unlikeAnswer = (aid: string) => apiFetch<LikeState>(`/answers/${id(aid)}/like`, { method: "DELETE", ...read() });
export const setReaction = (aid: string, kind: ReactionKind, key: string) =>
  apiFetch<ReactionState>(`/answers/${id(aid)}/reaction`, { method: "PUT", authed: true, body: { kind }, idempotencyKey: key });
export const removeReaction = (aid: string) => apiFetch<ReactionState>(`/answers/${id(aid)}/reaction`, { method: "DELETE", authed: true });

export interface NewsInput { isNews: boolean; newsTag?: NewsTag }
/** `mood` is the one word of a mood question (LCH-02); an ordinary question sends none. */
export const createAnswer = (qid: string, body: string, news: NewsInput, key: string, mood?: S["Mood"] | null, anonymous = false) =>
  apiFetch<PostReceipt>(`/questions/${id(qid)}/answers`, {
    method: "POST",
    authed: true,
    idempotencyKey: key,
    body: { kind: "TEXT", body, ...(news.isNews ? { isNews: true, newsTag: news.newsTag } : {}), ...(mood ? { mood } : {}), ...(anonymous ? { anonymous: true } : {}) },
  });
/** `anonymous` is "Post without my name" (V-FIX-D): sent only when on, so a named reply sends exactly what it always did. */
export const createReply = (aid: string, stance: ReplyStance, body: string, key: string, anonymous = false) =>
  apiFetch<ReplyReceipt>(`/answers/${id(aid)}/replies`, { method: "POST", authed: true, idempotencyKey: key, body: { stance, kind: "TEXT", body, ...(anonymous ? { anonymous: true } : {}) } });
/** A voice reply: the clip is already uploaded and READY. Charged and limited like a voice answer (the server decides). */
export const createVoiceReply = (aid: string, stance: ReplyStance, clipId: string, key: string, extraVoiceTokenId?: string, anonymous = false) =>
  apiFetch<ReplyReceipt>(`/answers/${id(aid)}/replies`, { method: "POST", authed: true, idempotencyKey: key, body: { stance, kind: "VOICE", clipId, ...(extraVoiceTokenId ? { extraVoiceTokenId } : {}), ...(anonymous ? { anonymous: true } : {}) } });
/** PATCH /answers/{id}: text answers only, inside the server's edit window. Returns the answer as it now reads. */
export const editAnswer = (aid: string, body: string) => apiFetch<Answer>(`/answers/${id(aid)}`, { method: "PATCH", authed: true, body: { body } });
export const deleteAnswer = (aid: string) => apiFetch<void>(`/answers/${id(aid)}`, { method: "DELETE", authed: true });
export const deleteReply = (rid: string) => apiFetch<void>(`/replies/${id(rid)}`, { method: "DELETE", authed: true });
export const markHelpful = (aid: string) => apiFetch<void>(`/answers/${id(aid)}/helpful`, { method: "PUT", authed: true });
export const unmarkHelpful = (aid: string) => apiFetch<void>(`/answers/${id(aid)}/helpful`, { method: "DELETE", authed: true });

export const saveQuestion = (qid: string) => apiFetch<void>(`/questions/${id(qid)}/save`, { method: "PUT", authed: true });
export const unsaveQuestion = (qid: string) => apiFetch<void>(`/questions/${id(qid)}/save`, { method: "DELETE", authed: true });

export const createReport = (body: { targetType: ReportTargetType; targetId: string; reason: ReportReason; note?: string; alsoBlock?: boolean }) =>
  apiFetch<ReportReceipt>("/reports", { method: "POST", authed: true, body });
/** POST /appeals (RW2): one note, up to 500 characters. A suspended or banned person may still send it. */
export const createAppeal = (body: { targetType: ReportTargetType; targetId: string; note: string }) =>
  apiFetch<S["AppealReceipt"]>("/appeals", { method: "POST", authed: true, body });
export const blockUser = (uid: string) => apiFetch<void>(`/me/blocks/${id(uid)}`, { method: "PUT", authed: true });
export const unblockUser = (uid: string) => apiFetch<void>(`/me/blocks/${id(uid)}`, { method: "DELETE", authed: true });

export const createShareLink = (objectType: "QUESTION" | "ANSWER", objectId: string) =>
  apiFetch<ShareLink>("/share/links", { method: "POST", authed: true, body: { objectType, objectId } });
export const shareEvent = (code: string, kind: string) =>
  apiFetch<void>(`/share/${id(code)}/events`, { method: "POST", authed: true, body: { kind } }).catch(() => undefined);

export const getPlayUrl = (clipId: string) => apiFetch<{ url: string; expiresAt: string; mime: string }>(`/voice-clips/${id(clipId)}/play`, read());
export const countListen = (aid: string) =>
  apiFetch<void>(`/answers/${id(aid)}/listen`, { method: "POST", body: { completed: false, positionMs: 0 }, authed: true, headers: listenHeaders() }).catch(() => undefined);
/** LISTEN-1: how much of the clip this person has played. Fire and forget: a failure is silent and nothing waits for it. */
export const reportListen = (aid: string, p: { secondsPlayed: number; finished: boolean }, leaving = false) =>
  apiFetch<void>(`/answers/${id(aid)}/listen`, { method: "POST", body: p, authed: true, headers: listenHeaders(), keepalive: leaving }).catch(() => undefined);
