import { apiFetch, ApiError, NetworkError } from "./client";
import { API_BASE, REQUEST_TIMEOUT_MS } from "./config";
import { sessionStorage } from "@/lib/auth/session-storage";
import type { components } from "./types";

/* Voice Units routes (contract tag voice-units), plus the three neighbours the Voice Units screens read:
 * GET /config/public, GET /ads/placement and POST /questions/{id}/answers (a held draft posts after a purchase, V-19).
 * Paths are written as the contract writes them; the client adds the /api/v1 base (V-26). */

type S = components["schemas"];
export type Wallet = S["Wallet"];
export type TiersResponse = S["TiersResponse"];
export type UnitTier = S["UnitTier"];
export type ActionCosts = S["ActionCosts"];
export type ExtraVoiceOffer = S["ExtraVoiceOffer"];
export type ExtraVoiceTokenKind = S["ExtraVoiceTokenKind"];
export type LedgerItem = S["LedgerItem"];
export type LedgerPage = S["LedgerPage"];
export type Payment = S["Payment"];
export type PaymentInit = S["PaymentInit"];
export type PaymentStatus = S["PaymentStatus"];
export type Receipt = S["Receipt"];
export type PublicConfig = S["PublicConfig"];
export type AdPlacement = S["AdPlacement"];
export type InitPaymentRequest = S["InitPaymentRequest"];
export type PayMethod = NonNullable<InitPaymentRequest["method"]>;

export const getWallet = () => apiFetch<Wallet>("/wallet", { authed: true });
/** Guest or signed in; the token is sent when there is one. */
export const getTiers = () => apiFetch<TiersResponse>("/units/tiers", { authed: true });
export const getPublicConfig = () => apiFetch<PublicConfig>("/config/public");

export function getHistory(cursor?: string, limit = 20): Promise<LedgerPage> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set("cursor", cursor);
  return apiFetch<LedgerPage>(`/wallet/history?${q.toString()}`, { authed: true });
}

/** The server fixes the amount; the browser sends only what was chosen. `idempotencyKey` is one per attempt. */
export const initPayment = (body: InitPaymentRequest, idempotencyKey: string) =>
  apiFetch<PaymentInit>("/payments", { method: "POST", authed: true, body, idempotencyKey });

export const getPayment = (paymentId: string) => apiFetch<Payment>(`/payments/${encodeURIComponent(paymentId)}`, { authed: true });

/** Confirm on return. The server calls Flutterwave itself; `providerTxId` is only a hint. */
export const verifyPayment = (paymentId: string, idempotencyKey: string, providerTxId?: string) =>
  apiFetch<Payment>(`/payments/${encodeURIComponent(paymentId)}/verify`, {
    method: "POST",
    authed: true,
    idempotencyKey,
    body: providerTxId ? { providerTxId } : {},
  });

export const getReceipt = (paymentId: string) => apiFetch<Receipt>(`/payments/${encodeURIComponent(paymentId)}/receipt`, { authed: true });

/** The approved ad for a slot, or null where none may show. */
export async function getAdPlacement(kind: "BANNER" | "WALLET_OFFER"): Promise<AdPlacement | null> {
  const r = await apiFetch<{ ad: AdPlacement | null }>(`/ads/placement?kind=${kind}`, { authed: true });
  return r.ad;
}

export function recordAdEvent(adId: string, kind: "IMPRESSION" | "TAP"): Promise<void> {
  return apiFetch<void>(`/ads/${encodeURIComponent(adId)}/events`, { method: "POST", authed: true, body: { kind } }).catch(() => undefined);
}

/** Post a held text draft as an answer. `idempotencyKey` is stored with the draft so a refresh never posts it twice. */
export const postHeldAnswer = (questionId: string, body: string, idempotencyKey: string) =>
  apiFetch<{ answer?: { id: string } }>(`/questions/${encodeURIComponent(questionId)}/answers`, {
    method: "POST",
    authed: true,
    idempotencyKey,
    body: { kind: "TEXT", body },
  });

async function csvOnce(): Promise<Response> {
  const headers = new Headers({ Accept: "text/csv" });
  const t = sessionStorage.getToken();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 3);
  try {
    return await fetch(`${API_BASE}/wallet/history/export`, { headers, signal: controller.signal });
  } catch {
    throw new NetworkError(controller.signal.aborted ? "timeout" : "offline");
  } finally {
    clearTimeout(timer);
  }
}

/** The statement as a file (CSV). The route needs the bearer token, so it is fetched, then saved by the page. */
export async function fetchStatementCsv(): Promise<Blob> {
  let res = await csvOnce();
  if (res.status === 401) {
    // apiFetch refreshes an expired token on 401; run one cheap call through it, then retry once.
    await getWallet();
    res = await csvOnce();
  }
  if (!res.ok) throw new ApiError(res.status, "HTTP_" + res.status, "Could not download the statement", false);
  return res.blob();
}
