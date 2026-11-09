import type { components } from "./types";
import { apiFetch } from "./client";
import { guestId } from "./feed";

type S = components["schemas"];
export type Allowances = S["Allowances"];
export type ExtraVoiceToken = S["ExtraVoiceToken"];
export type ExtraVoiceOffer = S["ExtraVoiceOffer"];
export type PublicConfig = S["PublicConfig"];
export type VoiceClip = S["VoiceClip"];
export type VoiceUpload = S["VoiceUpload"];
export type PostReceipt = S["PostReceipt"];
export type Question = S["Question"];
export type TiersResponse = S["TiersResponse"];

const guestHeaders = () => {
  const g = guestId();
  return g ? { "X-Guest-Id": g } : undefined;
};

export const getQuestion = (id: string) => apiFetch<Question>(`/questions/${encodeURIComponent(id)}`, { authed: true, headers: guestHeaders() });
export const getToday = () => apiFetch<Question>("/questions/today", { authed: true, headers: guestHeaders() });
export const getPublicConfig = () => apiFetch<PublicConfig>("/config/public");
export const getAllowance = () => apiFetch<Allowances>("/me/allowance", { authed: true });
export const getTiers = () => apiFetch<TiersResponse>("/units/tiers", { authed: true });

export const createVoiceClip = (b: { mime: S["CreateVoiceClipRequest"]["mime"]; sizeBytes: number; durationMs: number; extraVoiceTokenId?: string }) =>
  apiFetch<VoiceUpload>("/voice-clips", { method: "POST", authed: true, body: { purpose: "ANSWER", ...b } });
export const completeVoiceClip = (id: string) => apiFetch<VoiceClip>(`/voice-clips/${id}/complete`, { method: "POST", authed: true });
export const getVoiceClip = (id: string) => apiFetch<VoiceClip>(`/voice-clips/${id}`, { authed: true });
export const deleteVoiceClip = (id: string) => apiFetch<void>(`/voice-clips/${id}`, { method: "DELETE", authed: true });

export const createVoiceAnswer = (questionId: string, clipId: string, key: string, extraVoiceTokenId?: string) =>
  apiFetch<PostReceipt>(`/questions/${questionId}/answers`, {
    method: "POST",
    authed: true,
    idempotencyKey: key,
    body: { kind: "VOICE", clipId, ...(extraVoiceTokenId ? { extraVoiceTokenId } : {}) },
  });

