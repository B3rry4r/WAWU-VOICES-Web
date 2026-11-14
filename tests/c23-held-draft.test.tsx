// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postDraftForPurchase } from "@/features/units/post-draft";
import { saveDraft, setAwaiting, getDraft } from "@/features/units/draft";
import { ApiError, NetworkError } from "@/lib/api/client";

beforeEach(() => { window.localStorage.clear(); });
const hold = () => { saveDraft("q1", "My take", Date.now()); setAwaiting("q1", true); return getDraft("q1")!; };

describe("C23: a held draft refused with 'start again with a new key' after a purchase", () => {
  it("renews the draft's key, shows the product line, and the next post sends the new key and succeeds", async () => {
    const d = hold();
    const post = vi.fn(async (_q: string, _b: string, _k: string): Promise<{ answer?: { id: string } }> => { throw new ApiError(409, "CONFLICT", "Start again with a new key", true); });
    const out = await postDraftForPurchase("q1", "pay-1", { post });
    expect(out).toEqual({ status: "kept", questionId: "q1", message: "That did not post. Tap Post to try again." });
    const now = getDraft("q1")!;
    expect(now.key).not.toBe(d.key);
    expect(now.body).toBe("My take");
    const ok = vi.fn(async (_q: string, _b: string, _k: string): Promise<{ answer?: { id: string } }> => ({}));
    expect(await postDraftForPurchase("q1", "pay-1", { post: ok, force: true })).toEqual({ status: "posted", questionId: "q1" });
    expect(ok).toHaveBeenCalledWith("q1", "My take", now.key);
  });
  it("IDEMPOTENCY_KEY_REUSED does the same", async () => {
    const d = hold();
    const post = vi.fn(async (): Promise<{ answer?: { id: string } }> => { throw new ApiError(422, "IDEMPOTENCY_KEY_REUSED", "Key reused", true); });
    const out = await postDraftForPurchase("q1", "pay-1", { post });
    expect(out).toMatchObject({ status: "kept", message: "That did not post. Tap Post to try again." });
    expect(getDraft("q1")!.key).not.toBe(d.key);
  });
  for (const [name, err] of [
    ["500", new ApiError(500, "INTERNAL", "x", true)],
    ["429", new ApiError(429, "RATE_LIMITED", "x", true)],
    ["offline", new NetworkError("offline")],
  ] as const) {
    it(`${name} keeps the key and keeps waiting`, async () => {
      const d = hold();
      const post = vi.fn(async (): Promise<{ answer?: { id: string } }> => { throw err; });
      expect(await postDraftForPurchase("q1", "pay-1", { post })).toEqual({ status: "retry", questionId: "q1" });
      expect(getDraft("q1")!.key).toBe(d.key);
      expect(getDraft("q1")!.awaitingUnits).toBe(true);
    });
  }
});
