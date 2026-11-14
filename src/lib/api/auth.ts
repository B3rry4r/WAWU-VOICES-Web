import { AccountBlockedError, ApiError, apiFetch, isBlockedStatus } from "./client";
import { WAWU_ID_BASE } from "./config";
import { sessionStorage } from "@/lib/auth/session-storage";
import { clearEntryState } from "@/lib/auth/entry-draft";
import { clearKeptAddress } from "@/lib/install/address";

/*
 * WAWU ID owns sign-up, sign-in, the email code and password reset (the same service the WAWU website uses).
 * This module calls it directly and never proxies auth through the VOICES API (V-20).
 * Pattern copied from WAWUAfrica src/lib/api/auth.ts. WAWU ID has no "me" route: the person comes from the
 * login answer and the token; the VOICES profile comes from GET /me on the VOICES API.
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

export interface RegisterInput {
  fullName: string;
  email: string;
  /** Digits after the +234, no leading zero. */
  phoneNational: string;
  password: string;
  /** The country's name as WAWU ID stores it. */
  country: string;
  dialCode: string;
}

function unwrap<T>(v: unknown): T {
  return (v && typeof v === "object" && "data" in v ? (v as { data: T }).data : v) as T;
}

/** Which product is asking. WAWU ID uses it to send VOICES' own emails, with VOICES words and links, never the WHO MADE THIS ones (V-44). */
export const WAWU_ID_APP = "voices";

async function idCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await apiFetch<unknown>(path, { method: "POST", baseUrl: WAWU_ID_BASE, body: { ...body, app: WAWU_ID_APP } }));
}

/** Tidy a typed phone into +234 form: drops spaces, dashes and one leading 0 (or a pasted +234 or 234). */
export function nationalPhone(typed: string, dial = "+234"): string {
  const digits = typed.replace(/\D/g, "");
  const code = dial.replace(/\D/g, "");
  const rest = digits.startsWith(code) && digits.length > 10 ? digits.slice(code.length) : digits;
  return rest.replace(/^0+/, "");
}

export { AccountBlockedError } from "./client";
export const isAccountBlocked = (e: unknown): boolean => e instanceof AccountBlockedError;

/** Keep the tokens only for an active account. A status that is present and not "active" clears them and refuses. */
function keepSession(r: WawuIdTokenResult): WawuIdUser {
  if (isBlockedStatus(r.accessToken, r.user?.status)) {
    sessionStorage.clear();
    throw new AccountBlockedError();
  }
  sessionStorage.setTokens(r.accessToken, r.refreshToken);
  return r.user;
}

/** `identifier` is email or phone. Stores the tokens and returns the WAWU ID user. A person whose email is not yet confirmed gets ApiError code EMAIL_NOT_VERIFIED. */
export async function signIn(identifier: string, password: string): Promise<WawuIdUser> {
  return keepSession(await idCall<WawuIdTokenResult>("/auth/login", { identifier: identifier.trim(), password }));
}

/**
 * Creates the WAWU ID account. WAWU ID answers with tokens at once, but sign-in stays closed until the email
 * code is confirmed, so those tokens are dropped here and the confirmed ones from the code step are the session.
 */
export async function register(input: RegisterInput): Promise<void> {
  const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
  await idCall<WawuIdTokenResult>("/auth/register", {
    fullName: input.fullName.trim(),
    firstName,
    lastName: rest.join(" ") || firstName,
    email: input.email.trim().toLowerCase(),
    phone: `${input.dialCode}${input.phoneNational}`,
    dialCode: input.dialCode,
    country: input.country,
    password: input.password,
  });
}

/** Sends (or re-sends) the 6 digit code by email. Returns how many seconds it lives (300). */
export async function startEmailVerification(email: string): Promise<{ expiresIn: number }> {
  return idCall<{ message: string; expiresIn: number }>("/auth/email/verify/start", { email: email.trim().toLowerCase() });
}

export async function confirmEmailVerification(email: string, code: string): Promise<WawuIdUser> {
  return keepSession(await idCall<WawuIdTokenResult>("/auth/email/verify/confirm", { email: email.trim().toLowerCase(), code }));
}

/**
 * Asks WAWU ID to mail a reset link to the account's email. WAWU ID answers the same way whether or not an account exists,
 * so this never says which. The mail opens /reset-password on this site with a one time token and the email.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await idCall("/auth/forgot-password", { identifier: email.trim().toLowerCase(), method: "email" });
}

/** Sets a new password from the link in the mail. WAWU ID refuses (401) a link that is wrong, used or older than an hour. Does not sign anyone in. */
export async function resetPassword(input: { token: string; email: string; password: string }): Promise<void> {
  await idCall("/auth/reset-password", { token: input.token, email: input.email.trim().toLowerCase(), password: input.password });
}

/** Ends the session here first, then tells WAWU ID to kill the refresh token (best effort). */
export function signOut(): void {
  const refreshToken = sessionStorage.getRefreshToken();
  sessionStorage.clear();
  clearEntryState();
  clearKeptAddress();
  if (refreshToken) void idCall("/auth/logout", { refreshToken }).catch(() => undefined);
  // a kept recording belongs to the person who made it
  void import("@/features/speak/draft").then((m) => { m.leaveTab(); return m.wipeDraft(); }).catch(() => undefined);
}

export function isSignedIn(): boolean {
  return sessionStorage.getToken() !== null;
}

export const isEmailNotVerified = (e: unknown): boolean => e instanceof ApiError && e.status === 403 && e.code === "EMAIL_NOT_VERIFIED";
export const isPhoneNotConfirmed = (e: unknown): boolean => e instanceof ApiError && e.status === 403 && e.code === "PHONE_NOT_CONFIRMED";
