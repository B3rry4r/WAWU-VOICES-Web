import type { components } from "./types";
import { apiFetch, ApiError } from "./client";

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

/** Photo: ask for a presigned PUT, send the bytes to it, return the file id for PATCH /me/profile. */
export async function uploadAvatar(file: File): Promise<string> {
  const up = await apiFetch<S["FileUpload"]>("/uploads", { method: "POST", authed: true, body: { kind: "AVATAR", mime: file.type, sizeBytes: file.size } });
  let res: Response;
  try {
    res = await fetch(up.putUrl, { method: "PUT", headers: (up.putHeaders ?? {}) as Record<string, string>, body: file });
  } catch {
    throw new ApiError(0, "UPLOAD_FAILED", "The photo did not upload", false);
  }
  if (!res.ok) throw new ApiError(res.status, "UPLOAD_FAILED", "The photo did not upload", false);
  return up.fileId;
}
