import { apiFetch, ApiError } from "./client";
import type { components } from "./types";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { baseMime } from "@/lib/audio-ref/mime";

type S = components["schemas"];

/** The picture types the server accepts (POST /uploads). */
export const PICTURE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
/** The recording types the server accepts for a voice note or an audio advert (POST /voice-clips). */
export const AUDIO_MIMES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/aac"] as const;
/** A recording longer than this is turned away here, before anything is sent (the server holds its own limit too). */
export const NOTE_MAX_SECONDS = 60;
/** The longest audio advert (addendum 3B: a short audio ad slot). */
export const AD_AUDIO_MAX_SECONDS = 30;
export const PICTURE_MAX_BYTES = 5_000_000;

export type TeamClipPurpose = "OVERRIDE_NOTE" | "AD_AUDIO";
export type TeamFileKind = "OVERRIDE_IMAGE" | "AD_CREATIVE";

/** Plain words for a file that cannot be used, or null when it can. */
export function pictureProblem(file: { type: string; size: number }): string | null {
  if (!(PICTURE_MIMES as readonly string[]).includes(file.type)) return "Use a JPEG, PNG or WebP picture.";
  if (file.size > PICTURE_MAX_BYTES) return "That picture is too large. Use one under 5 MB.";
  return null;
}

export function audioProblem(file: { type: string }, seconds: number, maxSeconds: number): string | null {
  if (!(AUDIO_MIMES as readonly string[]).includes(baseMime(file.type))) return "Use a recording in WebM, MP4, OGG, MP3 or AAC.";
  if (!(seconds >= 0.3)) return "That recording is too short.";
  if (seconds > maxSeconds + 0.5) return `That recording is too long. ${maxSeconds} seconds at most.`;
  return null;
}

/** How long an audio file is, in seconds, read in the browser (0 when it cannot be read). */
export function audioSeconds(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (n: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(n) ? n : 0); };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.src = url;
  });
}

/** Uploads a picture (POST /uploads, PUT, complete) and returns its file id. */
export async function uploadPicture(file: Blob, kind: TeamFileKind): Promise<string> {
  const up = await apiFetch<S["FileUpload"]>("/uploads", { method: "POST", authed: true, body: { kind, mime: file.type, sizeBytes: file.size } });
  await putWithRetry({ url: up.putUrl, key: "", headers: {} }, file);
  await apiFetch<S["UploadedFile"]>(`/uploads/${up.fileId}/complete`, { method: "POST", authed: true });
  return up.fileId;
}

/** Uploads a recording, waits until it is ready, and returns its clip id. */
export async function uploadRecording(file: Blob, seconds: number, purpose: TeamClipPurpose): Promise<string> {
  const mime = baseMime(file.type) as S["CreateVoiceClipRequest"]["mime"];
  const up = await apiFetch<S["VoiceUpload"]>("/voice-clips", { method: "POST", authed: true, body: { purpose, mime, sizeBytes: file.size, durationMs: Math.round(seconds * 1000) } });
  await putWithRetry({ url: up.putUrl, key: "", headers: {} }, new Blob([file], { type: mime }));
  await apiFetch<S["VoiceClip"]>(`/voice-clips/${up.clip.id}/complete`, { method: "POST", authed: true });
  for (let i = 0; i < 90; i++) {
    const c = await apiFetch<S["VoiceClip"]>(`/voice-clips/${up.clip.id}`, { authed: true });
    if (c.status === "READY") return up.clip.id;
    if (c.status === "FAILED" || c.status === "REMOVED") throw new ApiError(422, "CLIP_FAILED", "We could not process that recording. Try another file.", false);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new ApiError(0, "CLIP_SLOW", "The recording is still being prepared. Try again in a moment.", true);
}
