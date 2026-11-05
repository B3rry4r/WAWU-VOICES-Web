import { describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError } from "@/lib/api/client";
import type { Payment } from "@/lib/api/units";
import { POLL_TRIES, cleanTxId, runReturn, type ReturnDeps, type ReturnState } from "@/features/units/payment-return";

const ID = "01a1ad10-f09a-73fc-9902-42da40d26dec";
const pay = (status: Payment["status"], o: Partial<Payment> = {}): Payment => ({ id: ID, kind: "UNITS", status, amountKobo: 69000, txRef: "voices-x", title: "Buzz pack", unitsMilli: 55000, bonusMilli: 5000, method: "card", cardLast4: "4412", receiptNo: status === "SUCCEEDED" ? "VU-1" : null, failureReason: null, balanceMilli: status === "SUCCEEDED" ? 55000 : null, createdAt: "2026-11-05T10:00:00Z", verifiedAt: status === "SUCCEEDED" ? "2026-11-05T10:01:00Z" : null, token: null, ...o });
const err = (status: number, code: string) => new ApiError(status, code, "m", true);

function harness(get: Array<Payment | Error>, verify: Payment | Error | null = null) {
  const gets = [...get];
  const d = {
    getPayment: vi.fn(async () => { const n = gets.length > 1 ? gets.shift()! : gets[0]; if (n instanceof Error) throw n; return n; }),
    verifyPayment: vi.fn(async () => { if (verify instanceof Error) throw verify; if (!verify) throw err(409, "PAYMENT_NOT_VERIFIED"); return verify; }),
    sleep: vi.fn(async () => undefined),
  } satisfies ReturnDeps;
  const seen: ReturnState[] = [];
  const run = (p: { paymentId?: string; urlStatus?: string | null; transactionId?: string | null } = {}) =>
    runReturn({ paymentId: ID, ...p }, d, (s) => seen.push(s), () => false).then(() => seen);
  return { d, seen, run };
}

describe("payment return rules", () => {
  it("shows a final payment as it is and never calls verify", async () => {
    const h = harness([pay("SUCCEEDED")]);
    const seen = await h.run({ urlStatus: "successful", transactionId: "123" });
    expect(seen.map((s) => s.kind)).toEqual(["success"]);
    expect(h.d.verifyPayment).not.toHaveBeenCalled();
  });
  it("calls verify exactly once with the digits-only transaction id", async () => {
    const h = harness([pay("INITIATED")], pay("SUCCEEDED"));
    const seen = await h.run({ urlStatus: "successful", transactionId: "285959875" });
    expect(h.d.verifyPayment).toHaveBeenCalledTimes(1);
    expect(h.d.verifyPayment).toHaveBeenCalledWith(ID, expect.stringMatching(/.{8,}/), "285959875");
    expect(seen.map((s) => s.kind)).toEqual(["confirming", "success"]);
  });
  it("does not send a transaction id that is not digits", async () => {
    expect(cleanTxId("12; drop")).toBeUndefined();
    expect(cleanTxId("../x")).toBeUndefined();
    expect(cleanTxId(null)).toBeUndefined();
    expect(cleanTxId("42")).toBe("42");
  });
  it("never shows success from the address alone: a forged success return stays unconfirmed", async () => {
    const h = harness([pay("INITIATED")]); // verify says not verified, the payment never moves
    const seen = await h.run({ urlStatus: "successful", transactionId: "999" });
    expect(seen.some((s) => s.kind === "success")).toBe(false);
    expect(seen[seen.length - 1].kind).toBe("slow");
    expect(h.d.getPayment).toHaveBeenCalledTimes(1 + POLL_TRIES);
    expect(h.d.verifyPayment).toHaveBeenCalledTimes(1);
  });
  it("polls the payment until it is final", async () => {
    const h = harness([pay("INITIATED"), pay("PENDING"), pay("PENDING"), pay("SUCCEEDED")]);
    const seen = await h.run({ urlStatus: "successful" });
    expect(seen[seen.length - 1].kind).toBe("success");
    expect(h.d.verifyPayment).toHaveBeenCalledTimes(1);
  });
  it("reads each ending", async () => {
    expect((await harness([pay("FAILED", { failureReason: "Declined by the bank" })]).run()).pop()!.kind).toBe("failed");
    expect((await harness([pay("EXPIRED")]).run()).pop()!.kind).toBe("expired");
    expect((await harness([pay("REFUNDED")]).run()).pop()!.kind).toBe("refunded");
    expect((await harness([pay("INITIATED")], err(409, "PAYMENT_EXPIRED")).run()).pop()!.kind).toBe("expired");
    expect((await harness([pay("INITIATED")], err(422, "PAYMENT_AMOUNT_MISMATCH")).run()).pop()!.kind).toBe("mismatch");
    expect((await harness([pay("INITIATED")], pay("FAILED")).run()).pop()!.kind).toBe("failed");
  });
  it("says nothing of cancelling from the address: an unconfirmed payment stays unconfirmed (reconcile may still credit it)", async () => {
    const h = harness([pay("INITIATED")]);
    const seen = await h.run({ urlStatus: "cancelled" });
    expect(seen.map((s) => s.kind)).not.toContain("cancelled");
    expect(seen.pop()!.kind).toBe("slow");
  });
  it("cancelled in the address does not hide a payment that did go through", async () => {
    const seen = await harness([pay("INITIATED")], pay("SUCCEEDED")).run({ urlStatus: "cancelled" });
    expect(seen.pop()!.kind).toBe("success");
  });
  it("a payment that is not this person's (404) or not an id is not found, and verify is never tried", async () => {
    const a = harness([err(404, "NOT_FOUND")]);
    expect((await a.run()).pop()!.kind).toBe("notfound");
    expect(a.d.verifyPayment).not.toHaveBeenCalled();
    const b = harness([pay("SUCCEEDED")]);
    expect((await b.run({ paymentId: "not-an-id" })).pop()!.kind).toBe("notfound");
    expect(b.d.getPayment).not.toHaveBeenCalled();
  });
  it("a verify that finds the payment is somebody else's (404) is not found", async () => {
    expect((await harness([pay("INITIATED")], err(404, "NOT_FOUND")).run()).pop()!.kind).toBe("notfound");
  });
  it("a lost connection on the first read is an error to retry, and on verify it keeps polling", async () => {
    expect((await harness([new NetworkError("offline")]).run()).pop()!.kind).toBe("error");
    const seen = await harness([pay("INITIATED"), pay("SUCCEEDED")], new NetworkError("offline")).run();
    expect(seen.pop()!.kind).toBe("success");
  });
  it("stops quietly when the page has moved on", async () => {
    const h = harness([pay("INITIATED")]);
    const seen: ReturnState[] = [];
    let gone = false;
    h.d.sleep.mockImplementation(async () => { gone = true; });
    await runReturn({ paymentId: ID }, h.d, (s) => seen.push(s), () => gone);
    expect(h.d.getPayment).toHaveBeenCalledTimes(1);
    expect(seen.map((s) => s.kind)).toEqual(["confirming"]);
  });
});
