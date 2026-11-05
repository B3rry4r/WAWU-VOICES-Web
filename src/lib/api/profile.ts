import { apiFetch } from "./client";
import type { components } from "./types";

/* me-profile group (A1), people, media presign, reports. Every call is a contract path under /api/v1 (API_BASE). */
type S = components["schemas"];
export type Me = S["Me"];
export type Profile = S["Profile"];
export type PublicProfile = S["PublicProfile"];
export type Answer = S["Answer"];
export type Reply = S["Reply"];
export type Settings = S["Settings"];
export type Category = S["Category"];
export type CategoryFollow = S["CategoryFollow"];
export type BlockedUser = S["BlockedUser"];
export type SavedItem = S["SavedItem"];
export type DataExport = S["DataExport"];
export type VoiceClip = S["VoiceClip"];
export type UpdateProfileRequest = S["UpdateProfileRequest"];
export type UpdateSettingsRequest = S["UpdateSettingsRequest"];
export type ReportReason = S["ReportReason"];

export interface Page<T> { items: T[]; nextCursor: string | null }

const q = (p: Record<string, string | number | undefined>) => {
  const s = Object.entries(p).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  return s ? `?${s}` : "";
};

export const getMe = () => apiFetch<Me>("/me", { authed: true });
export const updateProfile = (body: UpdateProfileRequest) => apiFetch<Profile>("/me/profile", { method: "PATCH", authed: true, body });
export const checkHandle = (handle: string) => apiFetch<S["HandleCheck"]>(`/me/handle-check${q({ handle })}`, { authed: true });
export const getSettings = () => apiFetch<Settings>("/me/settings", { authed: true });
export const updateSettings = (body: UpdateSettingsRequest) => apiFetch<Settings>("/me/settings", { method: "PATCH", authed: true, body });
export const getFollowedCategories = () => apiFetch<S["CategoryFollowList"]>("/me/categories", { authed: true });
export const setFollowedCategories = (categories: CategoryFollow[]) => apiFetch<S["SetCategoriesRequest"]>("/me/categories", { method: "PUT", authed: true, body: { categories } });
export const listCategories = () => apiFetch<S["CategoryList"]>("/categories");
export const listMyAnswers = (cursor?: string) => apiFetch<Page<S["AnswerOrAd"]>>(`/me/answers${q({ cursor, limit: 20 })}`, { authed: true });
export const listSaved = (cursor?: string) => apiFetch<Page<SavedItem>>(`/me/saved${q({ cursor, limit: 20 })}`, { authed: true });
export const listBlocks = (cursor?: string) => apiFetch<Page<BlockedUser>>(`/me/blocks${q({ cursor, limit: 50 })}`, { authed: true });
export const blockUser = (userId: string) => apiFetch<void>(`/me/blocks/${userId}`, { method: "PUT", authed: true });
export const unblockUser = (userId: string) => apiFetch<void>(`/me/blocks/${userId}`, { method: "DELETE", authed: true });
/** `authed` only when signed in: a guest calls without a token. */
export const getPerson = (userId: string, signedIn: boolean, cursor?: string) => apiFetch<PublicProfile>(`/people/${userId}${q({ cursor, limit: 20 })}`, { authed: signedIn });
export const listPersonReplies = (userId: string, signedIn: boolean, cursor?: string) => apiFetch<Page<Reply>>(`/people/${userId}/replies${q({ cursor, limit: 20 })}`, { authed: signedIn });
export const searchPeople = (text: string) => apiFetch<S["SearchResults"]>(`/search${q({ q: text, type: "people", limit: 20 })}`);
export const requestExport = () => apiFetch<DataExport>("/me/export", { method: "POST", authed: true });
export const getExport = () => apiFetch<DataExport>("/me/export", { authed: true });
export const deleteAccount = (confirmHandle: string, understandUnitsForfeited: boolean) => apiFetch<void>("/me", { method: "DELETE", authed: true, body: { confirmHandle, understandUnitsForfeited } });
export const createReport = (body: S["CreateReportRequest"]) => apiFetch<S["ReportReceipt"]>("/reports", { method: "POST", authed: true, body });

export const getPlayUrl = (clipId: string, signedIn: boolean) => apiFetch<S["PlayUrl"]>(`/voice-clips/${clipId}/play`, { authed: signedIn });
export const createVoiceClip = (body: S["CreateVoiceClipRequest"]) => apiFetch<S["VoiceUpload"]>("/voice-clips", { method: "POST", authed: true, body });
export const completeVoiceClip = (clipId: string) => apiFetch<VoiceClip>(`/voice-clips/${clipId}/complete`, { method: "POST", authed: true });
export const getVoiceClip = (clipId: string) => apiFetch<VoiceClip>(`/voice-clips/${clipId}`, { authed: true });
export const deleteVoiceClip = (clipId: string) => apiFetch<void>(`/voice-clips/${clipId}`, { method: "DELETE", authed: true });
export const createUpload = (body: S["CreateUploadRequest"]) => apiFetch<S["FileUpload"]>("/uploads", { method: "POST", authed: true, body });
