// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attemptFor, choiceId, clearByPayment, dropAttempt, findByPayment, safePath, saveAttempt } from "@/features/units/attempt";
import { clearDraft, saveDraft, getDraft, setAwaiting, awaitingDrafts } from "@/features/units/draft";

beforeEach(() => { window.sessionStorage.clear(); window.localStorage.clear(); });
afterEach(() => vi.useRealTimers());

describe("purchase attempts (one Idempotency-Key per choice)", () => {
  const c = choiceId({ kind: "UNITS", tierId: "t1", method: "card" });
  it("gives the same key to a repeat of the same choice and another key to another choice", () => {
    const a = attemptFor(c);
    expect(attemptFor(c).key).toBe(a.key);
    expect(attemptFor(choiceId({ kind: "UNITS", tierId: "t2", method: "card" })).key).not.toBe(a.key);
    expect(attemptFor(choiceId({ kind: "UNITS", tierId: "t1", method: "ussd" })).key).not.toBe(a.key);
  });
  it("keeps the key across a reload of the tab (session storage)", () => {
    const a = attemptFor(c);
    expect(JSON.parse(window.sessionStorage.getItem("voices-buy-attempts")!)[c].key).toBe(a.key);
  });
  it("starts a clean attempt after it is dropped, finished or too old", () => {
    const a = attemptFor(c, undefined, 1000);
    dropAttempt(c);
    expect(attemptFor(c, undefined, 1001).key).not.toBe(a.key);
    const b = attemptFor(c, undefined, 2000);
    saveAttempt(c, { paymentId: "pay-1" });
    expect(findByPayment("pay-1")?.key).toBe(b.key);
    clearByPayment("pay-1");
    expect(findByPayment("pay-1")).toBeUndefined();
    const old = attemptFor(c, undefined, 5000);
    expect(attemptFor(c, undefined, 5000 + 21 * 60 * 1000).key).not.toBe(old.key);
  });
  it("only accepts a path inside VOICES as a place to come back to", () => {
    expect(safePath("/q/abc/write")).toBe("/q/abc/write");
    expect(safePath("//evil.example")).toBeUndefined();
    expect(safePath("https://evil.example")).toBeUndefined();
    expect(safePath("/a b")).toBeUndefined();
    expect(safePath(null)).toBeUndefined();
  });
  it("still works when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const a = attemptFor(c);
    expect(attemptFor(c).key).toBe(a.key);
    spy.mockRestore();
    get.mockRestore();
  });
});

describe("held drafts (V-19)", () => {
  it("keeps the words and the post key while the text is the same", () => {
    const d = saveDraft("q1", "  My answer ");
    expect(d?.body).toBe("My answer");
    expect(saveDraft("q1", "My answer")?.key).toBe(d?.key);
    expect(saveDraft("q1", "Changed")?.key).not.toBe(d?.key);
    expect(getDraft("q1")?.body).toBe("Changed");
  });
  it("forgets an empty draft", () => {
    saveDraft("q1", "x");
    saveDraft("q1", "   ");
    expect(getDraft("q1")).toBeUndefined();
  });
  it("lists the drafts waiting for units, newest first", () => {
    saveDraft("q1", "a", 1);
    saveDraft("q2", "b", 2);
    expect(awaitingDrafts()).toEqual([]);
    setAwaiting("q1", true);
    setAwaiting("q2", true);
    expect(awaitingDrafts().map((d) => d.questionId)).toEqual(["q2", "q1"]);
    clearDraft("q2");
    expect(awaitingDrafts().map((d) => d.questionId)).toEqual(["q1"]);
  });
});
