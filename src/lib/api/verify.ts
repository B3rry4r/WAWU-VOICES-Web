import { apiFetch } from "./client";
import type { components } from "./types";

type S = components["schemas"];

export type VerificationState = S["VerificationState"];
export type AdminVerificationPage = S["AdminVerificationPage"];
export type AdminVerificationItem = S["AdminVerificationItem"];
export type AdminVerification = S["AdminVerification"];
export type RejectReasonCode = S["RejectVerificationRequest"]["reasonCode"];

const A = { authed: true } as const;
const enc = encodeURIComponent;

/** V-46. Where my verification stands. */
export const getMyVerification = () => apiFetch<VerificationState>("/me/verification", A);

/** The file is the body itself. kind: "id" for the government ID, "bill" for the utility bill. */
export const putVerificationDocument = (kind: "id" | "bill", file: Blob) =>
  apiFetch<VerificationState>(`/me/verification/documents/${kind}`, { ...A, method: "PUT", body: file });

export const submitVerification = () => apiFetch<VerificationState>("/me/verification/submit", { ...A, method: "POST" });

// Admin (ADMIN role only)
export const listVerification = (o: { status?: "pending" | "decided"; cursor?: string | null } = {}) => {
  const q = new URLSearchParams();
  if (o.status) q.set("status", o.status);
  if (o.cursor) q.set("cursor", o.cursor);
  const s = q.toString();
  return apiFetch<AdminVerificationPage>(`/admin/verification${s ? "?" + s : ""}`, A);
};
export const getVerification = (id: string) => apiFetch<AdminVerification>(`/admin/verification/${enc(id)}`, A);
export const approveVerification = (id: string) => apiFetch<S["AdminVerificationDecision"]>(`/admin/verification/${enc(id)}/approve`, { ...A, method: "POST", body: {} });
export const rejectVerification = (id: string, body: { reasonCode: RejectReasonCode; note?: string }) =>
  apiFetch<S["AdminVerificationDecision"]>(`/admin/verification/${enc(id)}/reject`, { ...A, method: "POST", body });
export type VerificationDocumentLink = S["VerificationDocumentLink"];
/** Opens one document: a signed link that stops working after 5 minutes. Written to the audit log. kind: "id" or "bill". */
export const openVerificationDocument = (id: string, kind: "id" | "bill") => apiFetch<VerificationDocumentLink>(`/admin/verification/${enc(id)}/documents/${kind}`, A);
