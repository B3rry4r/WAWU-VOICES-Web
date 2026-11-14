import { sessionStorage } from "@/lib/auth/session-storage";
import { API_BASE, REQUEST_TIMEOUT_MS, WAWU_ID_BASE } from "./config";

/** The one error shape the VOICES API returns: { error: { code, message, details? } }. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** The server answered and refused. `status` is a real HTTP status. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  /** True only when the server explained itself; otherwise `message` is a placeholder, never show it. */
  readonly explained: boolean;

  constructor(status: number, code: string, message: string, explained: boolean, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.explained = explained;
    this.details = details;
  }
}

/** WAWU ID gives tokens to suspended, banned and pending-deletion accounts too. VOICES does not let them in. */
export class AccountBlockedError extends ApiError {
  constructor() {
    super(403, "ACCOUNT_SUSPENDED", "This account cannot sign in to VOICES right now.", true);
    this.name = "AccountBlockedError";
  }
}

function claimStatus(token: string): unknown {
  try {
    return (JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { status?: unknown }).status;
  } catch {
    return undefined;
  }
}

/** A status that is present and not "active" (in the token claim or the user object) blocks the account. */
export function isBlockedStatus(accessToken: string, userStatus?: unknown): boolean {
  return [claimStatus(accessToken), userStatus].some((st) => st !== undefined && st !== null && String(st).toLowerCase() !== "active");
}

/** No answer at all: offline, DNS, or our timeout. */
export class NetworkError extends ApiError {
  readonly kind: "timeout" | "offline";
  constructor(kind: "timeout" | "offline") {
    super(0, kind === "timeout" ? "TIMEOUT" : "OFFLINE", "Could not reach VOICES", false);
    this.name = "NetworkError";
    this.kind = kind;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Attach the signed-in bearer token (or `token`). Guests call without it. */
  authed?: boolean;
  token?: string;
  /** Override the origin (used to call WAWU ID directly). Default: API_BASE. */
  baseUrl?: string;
  /** Sent as the Idempotency-Key header (required on every money POST). */
  idempotencyKey?: string;
}

async function readError(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return new ApiError(res.status, "HTTP_" + res.status, `Request failed (${res.status})`, false);
  }
  const b = body as { error?: { code?: unknown; message?: unknown; details?: unknown }; message?: unknown; code?: unknown };
  if (b && typeof b === "object") {
    if (b.error && typeof b.error === "object" && typeof b.error.message === "string") {
      return new ApiError(res.status, typeof b.error.code === "string" ? b.error.code : "ERROR", b.error.message, true, b.error.details);
    }
    // WAWU ID answers with a top-level message (string or array) and an optional code.
    const msg = Array.isArray(b.message) ? b.message.filter((m) => typeof m === "string").join(". ") : b.message;
    if (typeof msg === "string" && msg.trim()) {
      return new ApiError(res.status, typeof b.code === "string" ? b.code : "ERROR", msg.trim(), true);
    }
  }
  return new ApiError(res.status, "HTTP_" + res.status, `Request failed (${res.status})`, false);
}

let refreshing: Promise<boolean | null> | null = null;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** True when another tab has already rotated the refresh token we started from (give it a moment to write storage). */
async function rotatedElsewhere(before: string): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const now = sessionStorage.getRefreshToken();
    if (now && now !== before) return true;
    await wait(100);
  }
  return false;
}

async function doRefresh(before: string, retried = false): Promise<boolean | null> {
  const current = sessionStorage.getRefreshToken();
  if (!current) return false;
  // Another tab won while we waited for the lock: its tokens are already in storage.
  if (current !== before) return true;
  try {
    const res = await fetch(`${WAWU_ID_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current, app: "voices" }),
    });
    if (res.status === 429) {
      // Too many tries: keep the session, wait as long as WAWU ID asks (at most 30 s), and ask once more.
      if (retried) return null;
      let secs = Number(res.headers.get("retry-after")) || 0;
      try {
        const b = (await res.json()) as { retryAfterSeconds?: unknown };
        if (typeof b.retryAfterSeconds === "number") secs = b.retryAfterSeconds;
      } catch {
        /* no body */
      }
      await wait(Math.min(Math.max(secs, 0), 30) * 1000);
      return doRefresh(before, true);
    }
    if (!res.ok) {
      if (res.status >= 500) return null;
      // Refused: if another tab rotated meanwhile, use its tokens; sign out only when nothing changed.
      return (await rotatedElsewhere(current)) ? true : false;
    }
    const raw = (await res.json()) as { data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string };
    const d = raw.data ?? raw;
    if (!d.accessToken || !d.refreshToken) return false;
    // A token refreshed into a suspended state is not kept.
    if (isBlockedStatus(d.accessToken)) {
      sessionStorage.clear();
      throw new AccountBlockedError();
    }
    sessionStorage.setTokens(d.accessToken, d.refreshToken);
    return true;
  } catch (e) {
    if (e instanceof AccountBlockedError) throw e;
    return null;
  }
}

/** One refresh at a time across tabs (Web Locks), and one per tab. true: new tokens in storage. false: refused. null: could not ask. */
async function refreshSession(): Promise<boolean | null> {
  const before = sessionStorage.getRefreshToken();
  if (!before) return false;
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: { request: <T>(name: string, cb: () => Promise<T>) => Promise<T> } }).locks : undefined;
  return locks ? locks.request("voices-refresh", () => doRefresh(before)) : doRefresh(before);
}

async function raw(path: string, opts: RequestOptions, isRetry = false): Promise<Response> {
  const { body, authed, token, baseUrl, idempotencyKey, ...rest } = opts;
  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");
  const isRaw = typeof Blob !== "undefined" && body instanceof Blob; // a file sent as the body itself (V-46: ID and utility bill)
  if (isRaw) headers.set("Content-Type", (body as Blob).type || "application/octet-stream");
  else if (body !== undefined && !(typeof FormData !== "undefined" && body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  if (authed || token) {
    const t = token ?? sessionStorage.getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl ?? API_BASE}${path}`, {
      ...rest,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : isRaw || (typeof FormData !== "undefined" && body instanceof FormData) ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError(controller.signal.aborted ? "timeout" : "offline");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && authed && !token && !isRetry) {
    if (!refreshing) refreshing = refreshSession().finally(() => { refreshing = null; });
    const ok = await refreshing;
    if (ok) return raw(path, opts, true);
    if (ok === false) sessionStorage.clear();
  }
  if (!res.ok) {
    const err = await readError(res);
    // The API refuses every write from a suspended, banned or pending-deletion account: say so plainly, keep no session.
    // Only profile creation ends the session: a person who is already in and then suspended on VOICES stays signed in
    // to read their notices and send an appeal (lead ruling WF, 6 Nov, RW2: suspension never blocks the appeal).
    if (err.status === 403 && err.code === "ACCOUNT_SUSPENDED" && path === "/me" && (rest.method ?? "GET").toUpperCase() === "POST") {
      sessionStorage.clear();
      throw new AccountBlockedError();
    }
    throw err;
  }
  return res;
}

/** A binary answer (a zip or a picture) from a signed-in route. Errors are the same ApiError as apiFetch. */
export async function apiBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  return (await raw(path, opts)).blob();
}

/** The only place raw fetch lives. Components call domain modules in src/lib/api, never fetch. */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await raw(path, opts);
  if (res.status === 204) return undefined as T;
  // Any success with an empty body (a 202 with no content, or a zero length) is "no data", never a parse error.
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}
