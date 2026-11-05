// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { startCheckout, useCheckout } from "@/features/units/checkout";
import { postAwaitingDraft } from "@/features/units/post-draft";
import { saveDraft, setAwaiting, getDraft } from "@/features/units/draft";
import { ApiError, NetworkError } from "@/lib/api/client";

const INIT = { paymentId: "01a1ad10-f09a-73fc-9902-42da40d26dec", txRef: "voices-1", amountKobo: 69000, currency: "NGN", unitsMilli: 55000, checkoutUrl: "https://checkout.flutterwave.com/v3/hosted/pay/abc", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { window.sessionStorage.clear(); window.localStorage.clear(); window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const f = vi.fn(async (url: string, init: RequestInit) => handler(String(url), init));
  vi.stubGlobal("fetch", f);
  return f;
}
const headerOf = (init: RequestInit, k: string) => new Headers(init.headers).get(k);
const unitsSpec = { kind: "UNITS" as const, tierId: "tier-buzz", method: "card" as const };

describe("start a payment", () => {
  it("sends only the choice, the Idempotency-Key and the bearer, then goes to the checkout the API returned", async () => {
    const f = stubFetch(() => json(INIT, 201));
    const go = vi.fn();
    await startCheckout(unitsSpec, undefined, go);
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/payments$/);
    expect(JSON.parse(init.body as string)).toEqual({ kind: "UNITS", tierId: "tier-buzz", method: "card", returnPath: "/units/done" });
    expect(headerOf(init, "idempotency-key")).toMatch(/.{8,}/);
    expect(headerOf(init, "authorization")).toBe("Bearer tok");
    expect(go).toHaveBeenCalledWith(INIT.checkoutUrl);
  });
  it("keeps the same Idempotency-Key when the first try is lost and the person tries again", async () => {
    let n = 0;
    const f = stubFetch(() => { n++; if (n === 1) throw new TypeError("offline"); return json(INIT, 201); });
    const go = vi.fn();
    await expect(startCheckout(unitsSpec, undefined, go)).rejects.toBeInstanceOf(NetworkError);
    await startCheckout(unitsSpec, undefined, go);
    const keys = f.mock.calls.map((c) => headerOf(c[1], "idempotency-key"));
    expect(keys[0]).toBe(keys[1]);
    expect(go).toHaveBeenCalledTimes(1);
  });
  it("goes straight to the known checkout on a repeat (the back button), with no second request", async () => {
    const f = stubFetch(() => json(INIT, 201));
    const go = vi.fn();
    await startCheckout(unitsSpec, undefined, go);
    await startCheckout(unitsSpec, undefined, go);
    expect(f).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledTimes(2);
    expect(go.mock.calls[1][0]).toBe(INIT.checkoutUrl);
  });
  it("uses a new key for a different pack, and a new key once the server refused the first", async () => {
    const f = stubFetch((_u, init) => (JSON.parse(init.body as string).tierId === "tier-a" ? json({ error: { code: "NOT_FOUND", message: "We could not find that pack." } }, 404) : json(INIT, 201)));
    await expect(startCheckout({ ...unitsSpec, tierId: "tier-a" }, undefined, vi.fn())).rejects.toBeInstanceOf(ApiError);
    await expect(startCheckout({ ...unitsSpec, tierId: "tier-a" }, undefined, vi.fn())).rejects.toBeInstanceOf(ApiError);
    await startCheckout(unitsSpec, undefined, vi.fn());
    const k = f.mock.calls.map((c) => headerOf(c[1], "idempotency-key"));
    expect(new Set(k).size).toBe(3);
  });
  it("keeps the key after a rate limit (nothing was created) and after a server error", async () => {
    let n = 0;
    const f = stubFetch(() => { n++; return n === 1 ? json({ error: { code: "RATE_LIMITED", message: "Too many tries." } }, 429) : n === 2 ? json({}, 503) : json(INIT, 201); });
    await expect(startCheckout(unitsSpec, undefined, vi.fn())).rejects.toBeInstanceOf(ApiError);
    await expect(startCheckout(unitsSpec, undefined, vi.fn())).rejects.toBeInstanceOf(ApiError);
    await startCheckout(unitsSpec, undefined, vi.fn());
    const k = f.mock.calls.map((c) => headerOf(c[1], "idempotency-key"));
    expect(new Set(k).size).toBe(1);
  });
  it("keeps the key after a 409 CONFLICT (a simultaneous request won the race), so a retry returns that payment", async () => {
    let n = 0;
    const f = stubFetch(() => { n++; return n === 1 ? json({ error: { code: "CONFLICT", message: "That conflicts with what is already saved." } }, 409) : json(INIT, 201); });
    await expect(startCheckout(unitsSpec, undefined, vi.fn())).rejects.toBeInstanceOf(ApiError);
    await startCheckout(unitsSpec, undefined, vi.fn());
    expect(headerOf(f.mock.calls[0][1], "idempotency-key")).toBe(headerOf(f.mock.calls[1][1], "idempotency-key"));
  });
  it("starts clean after IDEMPOTENCY_KEY_REUSED", async () => {
    let n = 0;
    const f = stubFetch(() => { n++; return n === 1 ? json({ error: { code: "IDEMPOTENCY_KEY_REUSED", message: "That key was used for something else." } }, 409) : json(INIT, 201); });
    await expect(startCheckout(unitsSpec, undefined, vi.fn())).rejects.toBeInstanceOf(ApiError);
    await startCheckout(unitsSpec, undefined, vi.fn());
    expect(headerOf(f.mock.calls[0][1], "idempotency-key")).not.toBe(headerOf(f.mock.calls[1][1], "idempotency-key"));
  });
  it("refuses a checkout address that is not http or https", async () => {
    stubFetch(() => json({ ...INIT, checkoutUrl: "javascript:alert(1)" }, 201));
    const go = vi.fn();
    await expect(startCheckout(unitsSpec, undefined, go)).rejects.toBeInstanceOf(ApiError);
    expect(go).not.toHaveBeenCalled();
  });
  it("sends an extra voice token purchase by its kind, not by a price", async () => {
    const f = stubFetch(() => json(INIT, 201));
    await startCheckout({ kind: "EXTRA_VOICE", tokenKind: "SECONDS_30" }, undefined, vi.fn());
    expect(JSON.parse(f.mock.calls[0][1].body as string)).toEqual({ kind: "EXTRA_VOICE", tokenKind: "SECONDS_30", returnPath: "/units/done" });
  });
});

describe("the pay button", () => {
  it("two taps at once make one request", async () => {
    let release: (r: Response) => void = () => undefined;
    const f = stubFetch(() => new Promise<Response>((r) => { release = r; }));
    vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      void result.current.start("pay", unitsSpec);
      void result.current.start("pay", unitsSpec);
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe("pay");
    await act(async () => release(json(INIT, 201)));
  });
  it("shows a readable sentence for a failed start and lets the person try again", async () => {
    stubFetch(() => { throw new TypeError("offline"); });
    const { result } = renderHook(() => useCheckout());
    await act(async () => { await result.current.start("pay", unitsSpec); });
    expect(result.current.error).toBe("Could not reach VOICES. Check your connection and try again.");
    expect(result.current.busy).toBeNull();
  });
  it("clears the spinner when the browser restores the page with the back button (pageshow, persisted)", async () => {
    stubFetch(() => json(INIT, 201));
    vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
    const { result } = renderHook(() => useCheckout());
    await act(async () => { await result.current.start("pay", unitsSpec); });
    expect(result.current.busy).toBe("pay");
    await act(async () => { const e = new Event("pageshow") as Event & { persisted: boolean }; e.persisted = true; window.dispatchEvent(e); });
    expect(result.current.busy).toBeNull();
  });
});

describe("a held draft posts after units arrive", () => {
  it("posts the waiting draft once, with its own key, then forgets it", async () => {
    saveDraft("q1", "My take");
    setAwaiting("q1", true);
    const key = getDraft("q1")!.key;
    const post = vi.fn(async () => ({}));
    expect(await postAwaitingDraft(post)).toEqual({ status: "posted", questionId: "q1" });
    expect(post).toHaveBeenCalledWith("q1", "My take", key);
    expect(getDraft("q1")).toBeUndefined();
    expect(await postAwaitingDraft(post)).toEqual({ status: "none" });
  });
  it("does nothing when no draft waits (not every draft is posted)", async () => {
    saveDraft("q1", "My take");
    const post = vi.fn();
    expect(await postAwaitingDraft(post)).toEqual({ status: "none" });
    expect(post).not.toHaveBeenCalled();
  });
  it("keeps the draft and says why when the server refuses", async () => {
    saveDraft("q1", "My take");
    setAwaiting("q1", true);
    const post = vi.fn(async () => { throw new ApiError(404, "NOT_FOUND", "That question is closed.", true); });
    expect(await postAwaitingDraft(post)).toEqual({ status: "kept", questionId: "q1", message: "That question is closed." });
    expect(getDraft("q1")?.awaitingUnits).toBe(false);
  });
  it("keeps the draft waiting when the connection is lost, so a refresh posts it", async () => {
    saveDraft("q1", "My take");
    setAwaiting("q1", true);
    const post = vi.fn(async () => { throw new NetworkError("offline"); });
    expect(await postAwaitingDraft(post)).toEqual({ status: "retry", questionId: "q1" });
    expect(getDraft("q1")?.awaitingUnits).toBe(true);
  });
});
