import type { components } from "./types";
import { apiFetch } from "./client";

type S = components["schemas"];
export type DmMessage = S["DmMessage"];
export type DmConversation = S["DmConversation"];
export type DmConversationPage = S["DmConversationPage"];
export type DmMessagePage = S["DmMessagePage"];
export type DmPerson = S["DmPerson"];
export type DmWith = S["DmWith"];
export type DmLimits = S["DmLimits"];
export type DmSendReceipt = S["DmSendReceipt"];
export type SendDmRequest = S["SendDmRequest"];
export type VoiceClip = S["VoiceClip"];
export type ReportReason = S["ReportReason"];

const id = encodeURIComponent;
const page = (cursor?: string) => (cursor ? `?limit=20&cursor=${id(cursor)}` : "?limit=20");

/** One send. The key is made once per tap and reused for every retry of that tap, so the server charges once. */
export const sendDm = (body: SendDmRequest, key: string) =>
  apiFetch<DmSendReceipt>("/dm/messages", { method: "POST", authed: true, idempotencyKey: key, body });
export const listConversations = (cursor?: string) => apiFetch<DmConversationPage>(`/dm/conversations${page(cursor)}`, { authed: true });
export const listMessages = (conversationId: string, cursor?: string) =>
  apiFetch<DmMessagePage>(`/dm/conversations/${id(conversationId)}/messages${page(cursor)}`, { authed: true });
export const markRead = (conversationId: string) => apiFetch<void>(`/dm/conversations/${id(conversationId)}/read`, { method: "POST", authed: true });
export const getDmUnread = () => apiFetch<{ unread: number }>("/dm/unread", { authed: true });
export const getDmWith = (userId: string) => apiFetch<DmWith>(`/dm/with/${id(userId)}`, { authed: true });

export const createDmClip = (b: { mime: S["CreateVoiceClipRequest"]["mime"]; sizeBytes: number; durationMs: number }) =>
  apiFetch<S["VoiceUpload"]>("/voice-clips", { method: "POST", authed: true, body: { purpose: "DM", ...b } });
export const completeClip = (clipId: string) => apiFetch<VoiceClip>(`/voice-clips/${id(clipId)}/complete`, { method: "POST", authed: true });
export const getClip = (clipId: string) => apiFetch<VoiceClip>(`/voice-clips/${id(clipId)}`, { authed: true });
export const deleteClip = (clipId: string) => apiFetch<void>(`/voice-clips/${id(clipId)}`, { method: "DELETE", authed: true });

export const reportMessage = (messageId: string, reason: ReportReason, note?: string, alsoBlock?: boolean) =>
  apiFetch<S["ReportReceipt"]>("/reports", {
    method: "POST",
    authed: true,
    body: { targetType: "DM_MESSAGE", targetId: messageId, reason, ...(note ? { note } : {}), ...(alsoBlock ? { alsoBlock: true } : {}) },
  });
export const blockPerson = (userId: string) => apiFetch<void>(`/me/blocks/${id(userId)}`, { method: "PUT", authed: true });
export const unblockPerson = (userId: string) => apiFetch<void>(`/me/blocks/${id(userId)}`, { method: "DELETE", authed: true });
export const getDmLimits = () => apiFetch<DmLimits>("/dm/limits", { authed: true });
export const muteChat = (conversationId: string) => apiFetch<void>(`/dm/conversations/${id(conversationId)}/mute`, { method: "PUT", authed: true });
export const unmuteChat = (conversationId: string) => apiFetch<void>(`/dm/conversations/${id(conversationId)}/mute`, { method: "DELETE", authed: true });
export const reportPerson = (userId: string, reason: ReportReason, note?: string, alsoBlock?: boolean) =>
  apiFetch<S["ReportReceipt"]>("/reports", {
    method: "POST",
    authed: true,
    body: { targetType: "USER", targetId: userId, reason, ...(note ? { note } : {}), ...(alsoBlock ? { alsoBlock: true } : {}) },
  });
export const searchPeople = (text: string) => apiFetch<S["SearchResults"]>(`/search?q=${id(text)}&type=people&limit=20`, { authed: true });
