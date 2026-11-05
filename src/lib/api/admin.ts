import { apiFetch } from "./client";
import type { components } from "./types";

type S = components["schemas"];

export type Role = S["Role"];
export type AdminToday = S["AdminToday"];
export type AdminTopicList = S["AdminTopicList"];
export type CalendarWeek = S["CalendarWeek"];
export type AdminTopic = S["AdminTopic"];
export type AdminQuestion = S["AdminQuestion"];
export type TopicStatus = S["TopicStatus"];
export type UpsertTopicRequest = S["UpsertTopicRequest"];
export type CreateOverrideRequest = S["CreateOverrideRequest"];
export type OverridePreview = S["OverridePreview"];
export type AdminOverride = S["AdminOverride"];
export type AdminOverridePage = S["AdminOverridePage"];
export type ModerationPage = S["ModerationPage"];
export type ModerationItem = S["ModerationItem"];
export type ModerationItemDetail = S["ModerationItemDetail"];
export type ModerationActionKind = S["ModerationActionKind"];
export type ModerationQueue = S["ModerationQueue"];
export type AdminNewsPage = S["AdminNewsPage"];
export type AdminNewsItem = S["AdminNewsItem"];
export type NewsDecision = S["NewsDecision"];
export type AdminResultPage = S["AdminResultPage"];
export type AdminResultPost = S["AdminResultPost"];
export type ResultThread = S["ResultThread"];
export type AdminWeeklyReport = S["AdminWeeklyReport"];
export type AdminWeeklyReportPage = S["AdminWeeklyReportPage"];
export type AdminAd = S["AdminAd"];
export type AdminAdPage = S["AdminAdPage"];
export type AdDecision = S["AdDecision"];
export type UpsertAdRequest = S["UpsertAdRequest"];
export type AuditLine = S["AuditLine"];

const A = { authed: true } as const;
const enc = encodeURIComponent;

function qs(o: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? "?" + s : "";
}

/** The signed-in person's roles come from GET /me. */
export const getAdminToday = () => apiFetch<AdminToday>("/admin/today", A);

// Calendar
export const listTopics = (o: { status?: string; sensitive?: boolean; q?: string; cursor?: string | null; limit?: number } = {}) =>
  apiFetch<AdminTopicList>(`/admin/topics${qs({ status: o.status, sensitive: o.sensitive ? true : undefined, q: o.q, cursor: o.cursor, limit: o.limit })}`, A);
export const getTopic = (id: string) => apiFetch<AdminTopic>(`/admin/topics/${enc(id)}`, A);
export const createTopic = (body: UpsertTopicRequest) => apiFetch<AdminTopic>("/admin/topics", { ...A, method: "POST", body });
export const updateTopic = (id: string, body: Partial<UpsertTopicRequest>) => apiFetch<AdminTopic>(`/admin/topics/${enc(id)}`, { ...A, method: "PATCH", body });
export const updateQuestion = (id: string, body: { kind: S["QuestionKind"]; text: string; scheduledFor?: string; pinned?: boolean }) => apiFetch<unknown>(`/admin/questions/${enc(id)}`, { ...A, method: "PATCH", body });

// Override
export const listOverrides = () => apiFetch<AdminOverridePage>("/admin/overrides", A);
export const previewOverride = (body: CreateOverrideRequest) => apiFetch<OverridePreview>("/admin/overrides/preview", { ...A, method: "POST", body });
export const createOverride = (body: CreateOverrideRequest) => apiFetch<AdminOverride>("/admin/overrides", { ...A, method: "POST", body });
export const cancelOverride = (id: string, reason: string) => apiFetch<AdminOverride>(`/admin/overrides/${enc(id)}/cancel`, { ...A, method: "POST", body: { reason } });

// Moderation
export const listModeration = (o: { queue?: string; cursor?: string | null } = {}) => apiFetch<ModerationPage>(`/admin/moderation/items${qs({ queue: o.queue, cursor: o.cursor })}`, A);
export const getModerationItem = (id: string) => apiFetch<ModerationItemDetail>(`/admin/moderation/items/${enc(id)}`, A);
export const moderationAction = (id: string, action: ModerationActionKind, reason: string) =>
  apiFetch<unknown>(`/admin/moderation/items/${enc(id)}/action`, { ...A, method: "POST", body: { action, reason } });

// News
export const listNews = (o: { tab?: string; cursor?: string | null } = {}) => apiFetch<AdminNewsPage>(`/admin/news/items${qs({ tab: o.tab, cursor: o.cursor })}`, A);
export const decideNews = (answerId: string, body: NewsDecision) => apiFetch<unknown>(`/admin/news/${enc(answerId)}/decision`, { ...A, method: "POST", body });

// Results
export const listResultThreads = () => apiFetch<{ items: ResultThread[] }>("/admin/results/threads", A);
export const listResultPostsAdmin = (o: { threadId?: string; status?: string; cursor?: string | null } = {}) =>
  apiFetch<AdminResultPage>(`/admin/results/posts${qs({ threadId: o.threadId, status: o.status, cursor: o.cursor })}`, A);
export const decideResult = (postId: string, decision: "VERIFIED" | "NOT_VERIFIED" | "SEND_TO_MODERATION", note?: string) =>
  apiFetch<unknown>(`/admin/results/posts/${enc(postId)}/decision`, { ...A, method: "POST", body: { decision, ...(note ? { note } : {}) } });

// Weekly
export const listWeekly = (status?: string) => apiFetch<AdminWeeklyReportPage>(`/admin/weekly-reports${qs({ status })}`, A);
export const getWeekly = (id: string) => apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}`, A);
export const editWeekly = (id: string, body: { cardTitle?: string; editorNote?: string; headline?: string; mood?: string; summary?: string }) =>
  apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}`, { ...A, method: "PATCH", body });
export const approveWeekly = (id: string, publishAt: string) => apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}/approve`, { ...A, method: "POST", body: { publishAt } });
export const holdWeekly = (id: string, reason: string) => apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}/hold`, { ...A, method: "POST", body: { reason } });

// Ads
export const listAds = (status?: string) => apiFetch<AdminAdPage>(`/admin/ads${qs({ status })}`, A);
export const createAd = (body: UpsertAdRequest) => apiFetch<AdminAd>("/admin/ads", { ...A, method: "POST", body });
export const decideAd = (id: string, body: AdDecision) => apiFetch<AdminAd>(`/admin/ads/${enc(id)}/decision`, { ...A, method: "POST", body });
