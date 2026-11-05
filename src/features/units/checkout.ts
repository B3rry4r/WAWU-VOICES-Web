"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NetworkError } from "@/lib/api/client";
import { initPayment, type ExtraVoiceTokenKind, type PayMethod } from "@/lib/api/units";
import { attemptFor, choiceId, dropAttempt, safePath, saveAttempt } from "./attempt";

export type CheckoutSpec =
  | { kind: "UNITS"; tierId: string; method: PayMethod }
  | { kind: "EXTRA_VOICE"; tokenKind: ExtraVoiceTokenKind; method?: PayMethod };

export const RETURN_PATH = "/units/done";
const REFUSED = new Set([400, 401, 403, 404, 422]);

/** A sentence a person can read for a failed start. Never a code, never a stack. */
export function startErrorText(e: unknown): string {
  if (e instanceof NetworkError) return "Could not reach VOICES. Check your connection and try again.";
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your sign-in has ended. Sign in again to continue.";
    if (e.explained && e.message) return e.message;
  }
  return "Something went wrong. Nothing was charged. Try again.";
}

function checkoutHref(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Begin a payment and go to the hosted checkout. One Idempotency-Key per choice, kept across retries (see attempt.ts). */
export function startCheckout(spec: CheckoutSpec, from?: string, go: (url: string) => void = (u) => window.location.assign(u), draftQuestionId?: string): Promise<void> {
  const choice = choiceId(spec.kind === "UNITS" ? spec : { kind: "EXTRA_VOICE", tokenKind: spec.tokenKind });
  // Only a Voice Units purchase carries a draft: a token purchase never posts one.
  const attempt = attemptFor(choice, safePath(from), Date.now(), spec.kind === "UNITS" ? draftQuestionId : undefined);
  const known = attempt.checkoutUrl && attempt.expiresAt && attempt.expiresAt > Date.now() ? checkoutHref(attempt.checkoutUrl) : null;
  if (known) {
    go(known);
    return Promise.resolve();
  }
  const body =
    spec.kind === "UNITS"
      ? { kind: "UNITS" as const, tierId: spec.tierId, method: spec.method, returnPath: RETURN_PATH }
      : { kind: "EXTRA_VOICE" as const, tokenKind: spec.tokenKind, ...(spec.method ? { method: spec.method } : {}), returnPath: RETURN_PATH };
  return initPayment(body, attempt.key).then(
    (r) => {
      const href = checkoutHref(r.checkoutUrl);
      if (!href) {
        dropAttempt(choice);
        throw new ApiError(502, "BAD_CHECKOUT", "Payments are not available right now. Try again soon.", true);
      }
      saveAttempt(choice, { paymentId: r.paymentId, checkoutUrl: href, expiresAt: Date.parse(r.expiresAt) });
      go(href);
    },
    (e: unknown) => {
      // The server refused the request itself (bad choice, no pack, key used for something else): the next tap is a clean
      // attempt. A 409 CONFLICT (a simultaneous request with this key won the race), a rate limit or a 5xx keeps the key,
      // so the retry gets the first payment back instead of making a second one.
      if (e instanceof ApiError && (REFUSED.has(e.status) || e.code === "IDEMPOTENCY_KEY_REUSED")) dropAttempt(choice);
      throw e;
    },
  );
}

/** Pay buttons: `start` is safe to call twice (a second tap while one is running does nothing). `busy` names what is running. */
export function useCheckout(from?: string, draftQuestionId?: string) {
  const running = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coming back with the browser's back button restores this page from memory with the button still spinning.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        running.current = false;
        setBusy(null);
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const start = useCallback(
    async (id: string, spec: CheckoutSpec) => {
      if (running.current) return;
      running.current = true;
      setBusy(id);
      setError(null);
      try {
        await startCheckout(spec, from, undefined, draftQuestionId);
        // Leaving for the checkout: keep the button busy until the page goes.
      } catch (e) {
        running.current = false;
        setBusy(null);
        setError(startErrorText(e));
      }
    },
    [from, draftQuestionId],
  );

  return { busy, error, start, clearError: () => setError(null) };
}
