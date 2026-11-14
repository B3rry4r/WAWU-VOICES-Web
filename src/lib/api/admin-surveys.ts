import type { components } from "./types";
import { ApiError, apiFetch } from "./client";
import { putBytes } from "@/features/profile/voiceCardRecorder";

type S = components["schemas"];
export type AdminSurvey = S["AdminSurvey"];
export type AdminSurveyPage = S["AdminSurveyPage"];
export type UpsertSurveyRequest = S["UpsertSurveyRequest"];
export type SurveyQuestionInput = S["SurveyQuestionInput"];
export type SurveyDecision = S["SurveyDecision"];
export type SurveyReport = S["SurveyReport"];
export type SurveyFreeAnswers = S["SurveyFreeAnswers"];
export type SurveyFreeItem = S["SurveyFreeItem"];
export type SurveyReleaseResult = S["SurveyReleaseResult"];
export type AdminBrand = S["AdminBrand"];
export type BrandInput = S["BrandInput"];

const A = { authed: true } as const;
const enc = encodeURIComponent;

function qs(o: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? "?" + s : "";
}

// Surveys (roles AD_MANAGER and ADMIN)
export const listSurveys = (status?: string) => apiFetch<AdminSurveyPage>(`/admin/surveys${qs({ status, limit: 50 })}`, A);
export const getAdminSurvey = (id: string) => apiFetch<AdminSurvey>(`/admin/surveys/${enc(id)}`, A);
export const createSurvey = (body: UpsertSurveyRequest) => apiFetch<AdminSurvey>("/admin/surveys", { ...A, method: "POST", body });
export const updateSurvey = (id: string, body: Partial<UpsertSurveyRequest>) => apiFetch<AdminSurvey>(`/admin/surveys/${enc(id)}`, { ...A, method: "PATCH", body });
export const submitSurvey = (id: string) => apiFetch<AdminSurvey>(`/admin/surveys/${enc(id)}/submit`, { ...A, method: "POST" });
export const decideSurvey = (id: string, body: SurveyDecision) => apiFetch<AdminSurvey>(`/admin/surveys/${enc(id)}/decision`, { ...A, method: "POST", body });
export const getSurveyReport = (id: string) => apiFetch<SurveyReport>(`/admin/surveys/${enc(id)}/report`, A);
/** Over and not released: every free answer and transcript, scrubbed by the server, for staff to read. 409 while the survey runs. */
export const getSurveyFreeAnswers = (id: string) => apiFetch<SurveyFreeAnswers>(`/admin/surveys/${enc(id)}/free-answers`, A);
/** Hide one free answer from the brand, or show it again. One call each. */
export const hideSurveyFreeAnswer = (id: string, answerId: string, hidden: boolean) =>
  apiFetch<S["HideFreeAnswerResult"]>(`/admin/surveys/${enc(id)}/free-answers/${enc(answerId)}`, { ...A, method: "PATCH", body: { hidden } });
/** Release the results to the brand. Once only. */
export const releaseSurvey = (id: string) => apiFetch<SurveyReleaseResult>(`/admin/surveys/${enc(id)}/release`, { ...A, method: "POST" });

// Brands
export const listBrands = () => apiFetch<S["AdminBrandList"]>("/admin/brands", A);
export const createBrand = (body: BrandInput) => apiFetch<AdminBrand>("/admin/brands", { ...A, method: "POST", body });
export const updateBrand = (id: string, body: Partial<BrandInput>) => apiFetch<AdminBrand>(`/admin/brands/${enc(id)}`, { ...A, method: "PATCH", body });

export const LOGO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type LogoMime = (typeof LOGO_MIMES)[number];
export const isLogoMime = (m: string): m is LogoMime => (LOGO_MIMES as readonly string[]).includes(m);

/** A brand logo: ask for a presigned PUT (kind AD_CREATIVE, the one adverts use), send the bytes, confirm, and return the file id for `logoFileId`. */
export async function uploadBrandLogo(file: File): Promise<string> {
  if (!isLogoMime(file.type)) throw new ApiError(0, "BAD_TYPE", "Use a JPEG, PNG or WebP picture.", true);
  const up = await apiFetch<S["FileUpload"]>("/uploads", { ...A, method: "POST", body: { kind: "AD_CREATIVE", mime: file.type, sizeBytes: file.size } });
  const headers = (up.putHeaders ?? {}) as Record<string, string>;
  try {
    await putBytes(up.putUrl, headers, file);
  } catch {
    throw new ApiError(0, "UPLOAD_FAILED", "The logo did not upload. Check the connection and try again.", true);
  }
  await apiFetch<S["UploadedFile"]>(`/uploads/${up.fileId}/complete`, { ...A, method: "POST" });
  return up.fileId;
}
