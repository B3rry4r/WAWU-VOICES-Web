import { ApiError } from "@/lib/api/client";
import type { Payment } from "@/lib/api/units";
import { newKey } from "./attempt";

/* The return page's rules (V-11, V-21), kept apart from React so they can be tested:
 *  1. Read the payment first. A final state is shown as it is: nothing is credited by this page.
 *  2. Otherwise call verify ONCE with what Flutterwave put in the address (the id is only a hint; the server asks Flutterwave
 *     itself and compares reference, amount and currency). The address alone never shows success.
 *  3. Then poll the payment until it is final, up to a limit; after that say it is still being confirmed. */

export type ReturnState =
  | { kind: "confirming" }
  | { kind: "success"; payment: Payment }
  | { kind: "failed"; payment: Payment }
  | { kind: "refunded"; payment: Payment }
  | { kind: "cancelled"; payment: Payment }
  | { kind: "expired" }
  | { kind: "mismatch" }
  | { kind: "notfound" }
  | { kind: "slow" }
  | { kind: "error"; error: unknown };

export interface ReturnDeps {
  getPayment(id: string): Promise<Payment>;
  verifyPayment(id: string, idempotencyKey: string, providerTxId?: string): Promise<Payment>;
  sleep(ms: number): Promise<void>;
}

export interface ReturnParams {
  paymentId: string;
  /** From Flutterwave's redirect (status, tx_ref, transaction_id). Only the transaction id is sent on, as a hint; the address never decides what is shown. */
  urlStatus?: string | null;
  transactionId?: string | null;
}

export const POLL_MS = 3000;
export const POLL_TRIES = 20;

export function classify(p: Payment): ReturnState | null {
  switch (p.status) {
    case "SUCCEEDED":
      return { kind: "success", payment: p };
    case "FAILED":
      return { kind: "failed", payment: p };
    case "REFUNDED":
      return { kind: "refunded", payment: p };
    case "EXPIRED":
      return { kind: "expired" };
    default:
      return null; // INITIATED or PENDING: not final
  }
}

const FINAL = new Set(["success", "failed", "refunded", "expired", "cancelled", "notfound", "mismatch"]);
export const isFinal = (s: ReturnState): boolean => FINAL.has(s.kind);

/** Flutterwave's transaction id is digits; anything else is not sent. */
export function cleanTxId(v: string | null | undefined): string | undefined {
  return v && /^\d{1,20}$/.test(v) ? v : undefined;
}

export function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Runs the three steps. `emit` gets each state; returns when final, slow, or aborted. */
export async function runReturn(p: ReturnParams, deps: ReturnDeps, emit: (s: ReturnState) => void, aborted: () => boolean): Promise<void> {
  const say = (s: ReturnState) => {
    if (!aborted()) emit(s);
  };
  if (!isUuid(p.paymentId)) return say({ kind: "notfound" });

  let first: Payment;
  try {
    first = await deps.getPayment(p.paymentId);
  } catch (e) {
    return say(e instanceof ApiError && e.status === 404 ? { kind: "notfound" } : { kind: "error", error: e });
  }
  const done = classify(first);
  if (done) return say(done);
  say({ kind: "confirming" });

  // Step 2: verify, once. Even when the address says cancelled: the address alone decides nothing.
  const cancelledReturn = /^cancel/i.test(p.urlStatus ?? "");
  try {
    const v = await deps.verifyPayment(p.paymentId, newKey(), cleanTxId(p.transactionId));
    const r = classify(v);
    if (r) return say(cancelledReturn && r.kind === "failed" ? { kind: "cancelled", payment: first } : r);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) return say({ kind: "notfound" });
      // lead ruling WF, 6 Nov (RW4): the address said cancelled and the one verify call says the payment did not succeed:
      // show Cancelled at once. A later webhook or reconcile success still credits (the server does that, not this page).
      if (cancelledReturn && e.status === 409 && e.code === "PAYMENT_NOT_VERIFIED") return say({ kind: "cancelled", payment: first });
      if (e.code === "PAYMENT_EXPIRED") return say({ kind: "expired" });
      if (e.code === "PAYMENT_AMOUNT_MISMATCH") return say({ kind: "mismatch" });
      // PAYMENT_NOT_VERIFIED, 429, 5xx, offline: not final yet; keep polling the payment below.
    }
  }

  // Step 3: poll until final.
  for (let i = 0; i < POLL_TRIES; i++) {
    await deps.sleep(POLL_MS);
    if (aborted()) return;
    try {
      const cur = await deps.getPayment(p.paymentId);
      const r = classify(cur);
      if (r) return say(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return say({ kind: "notfound" });
    }
  }
  say({ kind: "slow" });
}
