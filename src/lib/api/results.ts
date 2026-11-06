import { apiFetch, ApiError } from "./client";
import type { components } from "./types";

export type ResultThread = components["schemas"]["ResultThread"];
export type ResultPost = components["schemas"]["ResultPost"];
export type ResultPostPage = components["schemas"]["ResultPostPage"];
export type CreateResultPostRequest = components["schemas"]["CreateResultPostRequest"];

export type ResultThreadPage = components["schemas"]["ResultThreadPage"];

export type ResultFilter = "all" | "verified";

export function getResultThread(threadId: string): Promise<ResultThread> {
  return apiFetch<ResultThread>(`/result-threads/${encodeURIComponent(threadId)}`, { authed: true });
}

export function listResultThreads(): Promise<ResultThreadPage> {
  return apiFetch<ResultThreadPage>("/result-threads", { authed: true });
}

export interface ListPostsOptions {
  filter?: ResultFilter;
  cursor?: string | null;
  /** Cursor of the newest result already seen: the page then reports newCount (no stream, so the screen polls). */
  after?: string | null;
  limit?: number;
}

export function listResultPosts(threadId: string, o: ListPostsOptions = {}): Promise<ResultPostPage> {
  const q = new URLSearchParams();
  if (o.filter === "verified") q.set("status", "VERIFIED");
  if (o.cursor) q.set("cursor", o.cursor);
  if (o.after) q.set("after", o.after);
  if (o.limit) q.set("limit", String(o.limit));
  const qs = q.toString();
  return apiFetch<ResultPostPage>(`/result-threads/${encodeURIComponent(threadId)}/posts${qs ? "?" + qs : ""}`, { authed: true });
}

/** Posting is free (V-8). The Idempotency-Key makes a double tap safe. */
export function createResultPost(threadId: string, body: CreateResultPostRequest, idempotencyKey: string): Promise<ResultPost> {
  return apiFetch<ResultPost>(`/result-threads/${encodeURIComponent(threadId)}/posts`, { method: "POST", authed: true, body, idempotencyKey });
}

export const RESULT_PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ResultPhotoMime = (typeof RESULT_PHOTO_MIMES)[number];

export function isResultPhotoMime(m: string): m is ResultPhotoMime {
  return (RESULT_PHOTO_MIMES as readonly string[]).includes(m);
}

/** Uploads the result sheet photo (RESULT_PHOTO) and returns its file id. Only the WAWU team ever sees it. */
export async function uploadResultPhoto(file: Blob, mime: ResultPhotoMime): Promise<string> {
  const up = await apiFetch<components["schemas"]["FileUpload"]>("/uploads", {
    method: "POST",
    authed: true,
    body: { kind: "RESULT_PHOTO", mime, sizeBytes: file.size },
  });
  const headers = (up.putHeaders ?? {}) as Record<string, string>;
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", up.putUrl);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, String(v));
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) x.setRequestHeader("Content-Type", mime);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new ApiError(x.status, "UPLOAD_FAILED", "The photo did not upload.", true)));
    x.onerror = () => reject(new ApiError(0, "UPLOAD_FAILED", "The photo did not upload.", true));
    x.send(file);
  });
  // Confirm the upload (as the avatar upload does): the server checks the object arrived, so the photo is never swept as abandoned.
  await apiFetch<components["schemas"]["UploadedFile"]>(`/uploads/${up.fileId}/complete`, { method: "POST", authed: true });
  return up.fileId;
}

/** Who is posting, for the "How it will look" preview. */
export function getMyHandle(): Promise<{ handle: string | null }> {
  return apiFetch<{ handle: string | null }>("/me", { authed: true });
}
