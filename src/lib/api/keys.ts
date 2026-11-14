import { ApiError } from "./client";

/**
 * The one place that decides whether a refused post needs a NEW Idempotency-Key.
 * The API says "start again with a new key" (a 409 CONFLICT whose words say so, after it handed a token back from a crash)
 * or IDEMPOTENCY_KEY_REUSED: the key it holds is spent, so the next tap must carry a different one. A plain 409 CONFLICT
 * (a simultaneous request with the same key) is not this case: that key stays, so the retry gets the first post back.
 */
export function needsNewKey(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "IDEMPOTENCY_KEY_REUSED" || (e.status === 409 && e.code === "CONFLICT" && /new key/i.test(e.message)));
}

/** A fresh key. */
export function freshKey(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** The plain line for that case; `word` is the button's own word on the screen ("Post", "Send", ...). */
export function newKeyLine(word: string, what = "post"): string {
  return `That did not ${what}. Tap ${word} to try again.`;
}
