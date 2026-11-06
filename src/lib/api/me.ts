import type { components } from "./types";
import { apiFetch, ApiError, NetworkError } from "./client";
import { putBytes } from "@/features/profile/voiceCardRecorder";

type S = components["schemas"];
export type Me = S["Me"];
export type Country = S["Country"];
export type HandleCheck = S["HandleCheck"];
export type CreateMeRequest = S["CreateMeRequest"];

export const listCountries = () => apiFetch<S["CountryList"]>("/countries");

/** Signed in (WAWU ID token) and works before the VOICES profile exists. */
export const getMe = () => apiFetch<Me>("/me", { authed: true });

export const checkHandle = (handle: string) => apiFetch<HandleCheck>(`/me/handle-check?handle=${encodeURIComponent(handle)}`, { authed: true });

/** First call after sign-in. Idempotent. */
export const createMe = (body: CreateMeRequest) => apiFetch<Me>("/me", { method: "POST", authed: true, body, idempotencyKey: crypto.randomUUID() });

export const setCategories = (categories: S["CategoryFollow"][]) =>
  apiFetch<S["SetCategoriesRequest"]>("/me/categories", { method: "PUT", authed: true, body: { categories } });

export const updateProfile = (body: S["UpdateProfileRequest"]) => apiFetch<S["Profile"]>("/me/profile", { method: "PATCH", authed: true, body });

export const PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
/** The API refuses uploads over upload.max_bytes (5,000,000; not served in /config/public, so held here). */
export const PHOTO_MAX_BYTES = 5_000_000;

/** Plain words for a photo that did not go up. The server's own words when it explained itself (the 503 "Uploads are not available right now. Try again in a minute."), else ours. lead ruling WF, 6 Nov (A-M5). */
export function photoUploadWords(e: unknown): string {
  if (e instanceof NetworkError) return "Could not reach VOICES. Check your connection and try again.";
  if (e instanceof ApiError && e.explained && e.message) return e.message.replace(/\s*\u2014\s*/g, ", ");
  if (e instanceof ApiError && e.status === 503) return "Uploads are not available right now. Try again in a minute.";
  return "We could not upload your photo. Check your connection and try again, or choose another photo.";
}

/** Photo: ask for a presigned PUT, send the bytes to it, tell the server it landed, and return the file id for PATCH /me/profile (avatarFileId). */
export async function uploadAvatar(file: File): Promise<string> {
  const up = await apiFetch<S["FileUpload"]>("/uploads", { method: "POST", authed: true, body: { kind: "AVATAR", mime: file.type, sizeBytes: file.size } });
  try {
    await putBytes(up.putUrl, (up.putHeaders ?? {}) as Record<string, string>, file);
  } catch {
    throw new ApiError(0, "UPLOAD_FAILED", "The photo did not upload", false);
  }
  await apiFetch<S["UploadedFile"]>(`/uploads/${up.fileId}/complete`, { method: "POST", authed: true });
  return up.fileId;
}
