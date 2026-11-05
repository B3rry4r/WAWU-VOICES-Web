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

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = sessionStorage.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${WAWU_ID_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const raw = (await res.json()) as { data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string };
    const d = raw.data ?? raw;
    if (!d.accessToken || !d.refreshToken) return false;
    sessionStorage.setTokens(d.accessToken, d.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function raw(path: string, opts: RequestOptions, isRetry = false): Promise<Response> {
  const { body, authed, token, baseUrl, idempotencyKey, ...rest } = opts;
  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined && !(typeof FormData !== "undefined" && body instanceof FormData)) headers.set("Content-Type", "application/json");
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
      body: body === undefined ? undefined : typeof FormData !== "undefined" && body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError(controller.signal.aborted ? "timeout" : "offline");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && authed && !token && !isRetry) {
    if (!refreshing) refreshing = refreshSession().finally(() => { refreshing = null; });
    if (await refreshing) return raw(path, opts, true);
    sessionStorage.clear();
  }
  if (!res.ok) throw await readError(res);
  return res;
}

/** The only place raw fetch lives. Components call domain modules in src/lib/api, never fetch. */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await raw(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
