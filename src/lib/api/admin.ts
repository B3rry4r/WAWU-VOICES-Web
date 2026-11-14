import { apiBlob, apiFetch } from "./client";
import type { components } from "./types";

type S = components["schemas"];

export type Role = S["Role"];
export type AdminToday = S["AdminToday"];
export type AdminTopicList = S["AdminTopicList"];
export type CalendarWeek = S["CalendarWeek"];
export type AdminTopic = S["AdminTopic"];
export type AdminQuestion = S["AdminQuestion"];
export type TopicStatus = S["TopicStatus"];
export type AdminQuestionPool = S["AdminQuestionPool"];
export type BulkQuestionsResult = S["BulkQuestionsResult"];
export type MoveQuestionResult = S["MoveQuestionResult"];
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
export type AdminSummary = S["AdminSummary"];
export type SavedSummary = S["SavedSummary"];
export type SummaryDraft = S["SummaryDraft"];
export type SummaryEditRequest = S["SummaryEditRequest"];
export type AdminProposalQuestion = S["AdminProposalQuestion"];
export type AdminProposals = S["AdminProposals"];
export type AdminProposalItem = S["AdminProposalItem"];
export type AdminUser = S["AdminUser"];
export type AdminUserPage = S["AdminUserPage"];
export type AdminRoleGrant = S["AdminRoleGrant"];
export type AdminRoleGrantPage = S["AdminRoleGrantPage"];
export type Emotion = S["Emotion"];

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
export const updateQuestion = (id: string, body: { kind: S["QuestionKind"]; text: string; scheduledFor?: string; pinned?: boolean; categoryId?: string; status?: S["QuestionStatus"] }) =>
  apiFetch<unknown>(`/admin/questions/${enc(id)}`, { ...A, method: "PATCH", body });
/** K5: a spare question for a week (no day; held for follow-ups and flash polls). */
export const addSpareQuestion = (topicId: string, text: string) =>
  apiFetch<AdminQuestion>("/admin/questions", { ...A, method: "POST", body: { topicId, kind: "DAILY", isSpare: true, text } });

// Question pool (V-42)
/** K1: questions with no week and no day, newest first. */
export const listQuestionPool = (o: { cursor?: string | null; limit?: number } = {}) =>
  apiFetch<AdminQuestionPool>(`/admin/questions${qs({ pool: 1, cursor: o.cursor, limit: o.limit })}`, A);
/** K2: many questions at once, one per line. A refused line is named by its number; the rest are kept. */
export const addPoolQuestions = (body: { kind: "DAILY" | "FLASH"; categoryId?: string; lines: string[] }) =>
  apiFetch<BulkQuestionsResult>("/admin/questions/bulk", { ...A, method: "POST", body });
/** K3: put a pool question on a day. A taken day answers 409 DAY_TAKEN until replace is true. */
export const schedulePoolQuestion = (id: string, day: string, replace = false) =>
  apiFetch<MoveQuestionResult>(`/admin/questions/${enc(id)}/schedule`, { ...A, method: "POST", body: { day, ...(replace ? { replace: true } : {}) } });

// What Next? summary (V-FIX-C)
export const getSummary = (topicId: string) => apiFetch<AdminSummary>(`/admin/topics/${enc(topicId)}/summary`, A);
/** A draft from the week's data; with ai true and a key set on the server, written by the AI. Nothing is saved. */
export const draftSummary = (topicId: string, ai = false) => apiFetch<SummaryDraft>(`/admin/topics/${enc(topicId)}/summary/draft`, { ...A, method: "POST", body: { ai } });
export const saveSummary = (topicId: string, body: SummaryEditRequest) => apiFetch<S["EditorialSummary"]>(`/admin/topics/${enc(topicId)}/summary`, { ...A, method: "PUT", body });

// Grouping ideas on What Next? (V-FIX-C)
export const listProposalQuestions = () => apiFetch<{ items: AdminProposalQuestion[] }>("/admin/proposal-questions", A);
export const listProposals = (questionId: string) => apiFetch<AdminProposals>(`/admin/proposals${qs({ questionId })}`, A);
export const confirmGroup = (title: string, proposalIds: string[]) => apiFetch<S["ProposalGroup"]>("/admin/proposal-groups", { ...A, method: "POST", body: { title, proposalIds } });

export const removeGroup = (groupId: string) => apiFetch<{ id: string; released: number }>(`/admin/proposal-groups/${enc(groupId)}`, { ...A, method: "DELETE" });

// People and roles (V-FIX-C)
export const findPeople = (q: string) => apiFetch<AdminUserPage>(`/admin/users${qs({ q: q.trim().replace(/^@/, ''), limit: 20 })}`, A);
export const listStaff = (cursor?: string | null) => apiFetch<AdminRoleGrantPage>(`/admin/roles${qs({ cursor, limit: 50 })}`, A);
export const setRoles = (userId: string, roles: Role[], reason: string) => apiFetch<AdminRoleGrant>(`/admin/users/${enc(userId)}/roles`, { ...A, method: "PUT", body: { roles, reason } });

// Override
/** RW6: put a scheduled question on another day of its week. A taken day swaps the two (one transaction). */
export const moveQuestion = (id: string, day: string) => apiFetch<S["MoveQuestionResult"]>(`/admin/questions/${enc(id)}/move`, { ...A, method: "POST", body: { day } });
/** RW5: open a held FLASH question as a flash poll that starts now. The API allows one open flash poll at a time (409). */
export const startFlashPoll = (body: S["UpsertPollRequest"]) => apiFetch<S["Poll"]>("/admin/polls", { ...A, method: "POST", body });
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
export const editWeekly = (id: string, body: { cardTitle?: string; editorNote?: string; headline?: string; mood?: string; summary?: string; emotions?: Emotion[] }) =>
  apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}`, { ...A, method: "PATCH", body });
export const approveWeekly = (id: string, publishAt: string) => apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}/approve`, { ...A, method: "POST", body: { publishAt } });
/** LCH-13: the Instagram pictures of a published report (carousel and Story) as one zip. Nothing is posted. */
export const weeklyInstagramZip = (id: string) => apiBlob(`/admin/weekly-reports/${enc(id)}/instagram`, A);
export const holdWeekly = (id: string, reason: string) => apiFetch<AdminWeeklyReport>(`/admin/weekly-reports/${enc(id)}/hold`, { ...A, method: "POST", body: { reason } });

// Ads
export const listAds = (status?: string) => apiFetch<AdminAdPage>(`/admin/ads${qs({ status })}`, A);
export const createAd = (body: UpsertAdRequest) => apiFetch<AdminAd>("/admin/ads", { ...A, method: "POST", body });
export const updateAd = (id: string, body: Partial<UpsertAdRequest>) => apiFetch<AdminAd>(`/admin/ads/${enc(id)}`, { ...A, method: "PATCH", body });
export const decideAd = (id: string, body: AdDecision) => apiFetch<AdminAd>(`/admin/ads/${enc(id)}/decision`, { ...A, method: "POST", body });
