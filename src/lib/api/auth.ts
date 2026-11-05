import { apiFetch, ApiError } from "./client";
import { WAWU_ID_BASE } from "./config";
import { sessionStorage } from "@/lib/auth/session-storage";
import { clearEntryState } from "@/lib/auth/entry-draft";

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

async function idCall<T>(path: string, body: unknown): Promise<T> {
  return unwrap<T>(await apiFetch<unknown>(path, { method: "POST", baseUrl: WAWU_ID_BASE, body }));
}

/** Tidy a typed phone into +234 form: drops spaces, dashes and one leading 0 (or a pasted +234 or 234). */
export function nationalPhone(typed: string, dial = "+234"): string {
  const digits = typed.replace(/\D/g, "");
  const code = dial.replace(/\D/g, "");
  const rest = digits.startsWith(code) && digits.length > 10 ? digits.slice(code.length) : digits;
  return rest.replace(/^0+/, "");
}

/** WAWU ID gives tokens to suspended, banned and pending-deletion accounts too. VOICES does not let them in. */
export class AccountBlockedError extends Error {
  constructor() {
    super("This account cannot sign in to VOICES right now.");
    this.name = "AccountBlockedError";
  }
}
export const isAccountBlocked = (e: unknown): boolean => e instanceof AccountBlockedError;

function claimStatus(token: string): unknown {
  try {
    return (JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { status?: unknown }).status;
  } catch {
    return undefined;
  }
}

/** Keep the tokens only for an active account. A status that is present and not "active" clears them and refuses. */
function keepSession(r: WawuIdTokenResult): WawuIdUser {
  for (const st of [claimStatus(r.accessToken), r.user?.status]) {
    if (st !== undefined && st !== null && String(st).toLowerCase() !== "active") {
      sessionStorage.clear();
      throw new AccountBlockedError();
    }
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

/** Ends the session here first, then tells WAWU ID to kill the refresh token (best effort). */
export function signOut(): void {
  const refreshToken = sessionStorage.getRefreshToken();
  sessionStorage.clear();
  clearEntryState();
  if (refreshToken) void idCall("/auth/logout", { refreshToken }).catch(() => undefined);
  // a kept recording belongs to the person who made it
  void import("@/features/speak/draft").then((m) => m.clearDraft()).catch(() => undefined);
}

export function isSignedIn(): boolean {
  return sessionStorage.getToken() !== null;
}

export const isEmailNotVerified = (e: unknown): boolean => e instanceof ApiError && e.status === 403 && e.code === "EMAIL_NOT_VERIFIED";
export const isPhoneNotConfirmed = (e: unknown): boolean => e instanceof ApiError && e.status === 403 && e.code === "PHONE_NOT_CONFIRMED";
