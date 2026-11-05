import { apiFetch } from "./client";
import { WAWU_ID_BASE } from "./config";
import { sessionStorage } from "@/lib/auth/session-storage";

/*
 * WAWU ID owns sign-up, sign-in, OTP and password reset (same service the WAWU app uses).
 * This module calls it directly and never proxies auth through the VOICES API.
 * Pattern copied from WAWUAfrica src/lib/api/auth.ts.
 */

export interface WawuIdUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  status: string;
}

interface WawuIdTokenResult {
  accessToken: string;
  refreshToken: string;
  user: WawuIdUser;
}

function unwrap<T>(v: unknown): T {
  return (v && typeof v === "object" && "data" in v ? (v as { data: T }).data : v) as T;
}

async function idCall<T>(path: string, body: unknown): Promise<T> {
  return unwrap<T>(await apiFetch<unknown>(path, { method: "POST", baseUrl: WAWU_ID_BASE, body }));
}

/** `identifier` is email or phone. Stores the tokens and returns the WAWU ID user. */
export async function signIn(identifier: string, password: string): Promise<WawuIdUser> {
  const r = await idCall<WawuIdTokenResult>("/auth/login", { identifier, password });
  sessionStorage.setTokens(r.accessToken, r.refreshToken);
  return r.user;
}

export async function startEmailVerification(email: string): Promise<{ expiresIn: number }> {
  return idCall<{ message: string; expiresIn: number }>("/auth/email/verify/start", { email });
}

export async function confirmEmailVerification(email: string, code: string): Promise<WawuIdUser> {
  const r = await idCall<WawuIdTokenResult>("/auth/email/verify/confirm", { email, code });
  sessionStorage.setTokens(r.accessToken, r.refreshToken);
  return r.user;
}

export function signOut(): void {
  sessionStorage.clear();
  // a kept recording belongs to the person who made it
  void import("@/features/speak/draft").then((m) => m.clearDraft()).catch(() => undefined);
}

export function isSignedIn(): boolean {
  return sessionStorage.getToken() !== null;
}
