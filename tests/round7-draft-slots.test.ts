// @vitest-environment jsdom
// V-SURVEYS round 7, M2: another person's kept recording is never shown to B, never removed by B, and waits for A.
import { beforeEach, describe, expect, it } from "vitest";
import { currentOwner, clearDraft, DRAFT_MAX_AGE_MS, loadDraft, saveDraft, type Draft } from "@/features/speak/draft";

const token = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;
const as = (sub: string | null) => {
  window.localStorage.clear();
  if (sub) window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: token(sub), refreshToken: "r" }));
};
const mk = (key: string, over: Partial<Draft> = {}): Draft => ({ blob: new Blob(["x"]), mime: "audio/webm", seconds: 5, questionId: "q1", key, savedAt: Date.now(), ...over } as Draft);

beforeEach(async () => { as("A"); await clearDraft(currentOwner()); as("B"); await clearDraft(currentOwner()); as(null); await clearDraft(currentOwner()); });

describe("one kept recording for each person", () => {
  it("B opens a page: sees nothing of A's, A's stays, and A gets it back", async () => {
    as("A"); await saveDraft(currentOwner(), mk("ka", { queued: true }));
    as("B");
    expect(await loadDraft(currentOwner())).toBeNull();
    expect(await loadDraft(currentOwner())).toBeNull();
    as("A");
    expect((await loadDraft(currentOwner()))?.key).toBe("ka");
  });
  it("B keeps and sends their own beside A's, and A's is untouched", async () => {
    as("A"); await saveDraft(currentOwner(), mk("ka"));
    as("B"); await saveDraft(currentOwner(), mk("kb"));
    expect((await loadDraft(currentOwner()))?.key).toBe("kb");
    await clearDraft(currentOwner());
    expect(await loadDraft(currentOwner())).toBeNull();
    as("A");
    expect((await loadDraft(currentOwner()))?.key).toBe("ka");
  });
  it("A discarding removes only A's", async () => {
    as("A"); await saveDraft(currentOwner(), mk("ka"));
    as("B"); await saveDraft(currentOwner(), mk("kb"));
    as("A"); await clearDraft(currentOwner());
    expect(await loadDraft(currentOwner())).toBeNull();
    as("B");
    expect((await loadDraft(currentOwner()))?.key).toBe("kb");
  });
  it("a guest's recording goes to the first person who signs in; it is not left for the next", async () => {
    as(null); await saveDraft(currentOwner(), mk("kg"));
    as("A");
    expect((await loadDraft(currentOwner()))?.key).toBe("kg");
    as("B");
    expect(await loadDraft(currentOwner())).toBeNull();
  });
  it("A's own old recording is reported as old when A returns (the age limit is the caller's)", async () => {
    as("A"); await saveDraft(currentOwner(), mk("ka", { recordedAt: Date.now() - DRAFT_MAX_AGE_MS - 1000 }));
    as("B"); expect(await loadDraft(currentOwner())).toBeNull();
    as("A"); expect((await loadDraft(currentOwner()))?.key).toBe("ka");
  });
});
