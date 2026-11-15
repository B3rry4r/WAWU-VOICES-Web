// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => true }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: vi.fn(() => Promise.resolve()) }));

const speak = vi.hoisted(() => ({
  getQuestion: vi.fn(), getPublicConfig: vi.fn(), getAllowance: vi.fn(),
  createVoiceClip: vi.fn(), completeVoiceClip: vi.fn(), getVoiceClip: vi.fn(), deleteVoiceClip: vi.fn(), createVoiceAnswer: vi.fn(),
}));
vi.mock("@/lib/api/speak", () => ({ ...Object.fromEntries(Object.entries(speak).map(([k, f]) => [k, (...a: unknown[]) => (f as (...x: unknown[]) => unknown)(...a)])) }));

import { Outbox } from "@/features/speak/Outbox";
import { clearDraft, currentOwner, loadDraft, OTHER_TAB_NOTE, saveDraft, saveDraftKeepingReply, type Draft } from "@/features/speak/draft";
import { sendKeptRecording } from "@/features/speak/outbox";

const tokenFor = (sub: string) => "x." + btoa(JSON.stringify({ sub })).replace(/=+$/, "") + ".y";
const as = (sub: string | null) => { window.localStorage.clear(); if (sub) window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: tokenFor(sub), refreshToken: "r" })); };
const draft = (over: Partial<Draft> = {}): Draft => ({ questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 8, peaks: [], key: "key-1", savedAt: Date.now(), ...over });
const COSTS = { freeVoiceSeconds: 10, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30 };

beforeEach(async () => {
  as(null);
  await clearDraft(null);
  Object.values(speak).forEach((f) => f.mockReset());
  speak.getQuestion.mockResolvedValue({ id: "q1", status: "LIVE" });
  speak.getPublicConfig.mockResolvedValue({ voiceFreeSeconds: 10 });
  speak.getAllowance.mockResolvedValue({ freePostsRemaining: 0, costs: COSTS, extraVoiceTokens: [] });
  speak.createVoiceClip.mockResolvedValue({ clip: { id: "clip1" }, putUrl: "https://put.test/x" });
  speak.completeVoiceClip.mockResolvedValue({});
  speak.getVoiceClip.mockResolvedValue({ status: "READY" });
  speak.createVoiceAnswer.mockResolvedValue({ answer: { id: "ans1" } });
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
afterEach(() => { cleanup(); window.localStorage.clear(); });

describe("a kept recording belongs to the person the screen was opened for", () => {
  it("1. A's screen after B signed in elsewhere: nothing is written, and B finds nothing", async () => {
    as("A");
    const owner = currentOwner();
    as("B"); // another tab signs in as B
    expect(await saveDraft(draft(), owner)).toBe(false);
    expect(await saveDraftKeepingReply(draft(), owner)).toBe(false);
    expect(await loadDraft("B")).toBeNull();
  });

  it("2. A's recording is never sent under B's name", async () => {
    as("A");
    const d = { ...draft({ queued: true }), owner: "A" };
    as("B");
    const r = await sendKeptRecording(d);
    expect(r.ok).toBe(false);
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(speak.createVoiceAnswer).not.toHaveBeenCalled();
    expect(await loadDraft("B")).toBeNull();
  });

  it("3. B's kept recording is not shown to A's open screen, and is still there for B", async () => {
    as("B");
    await saveDraft(draft({ key: "b-key" }), "B");
    expect(await loadDraft("A")).toBeNull(); // A's screen, opened for A, while B is signed in
    await clearDraft("A"); // and it clears nothing
    expect((await loadDraft("B"))?.key).toBe("b-key");
  });

  it("4. closing A's banner after B kept a recording leaves B's recording", async () => {
    as("A");
    await saveDraft(draft({ key: "a-key", queued: true }), "A");
    render(<Outbox />);
    await screen.findByText("A recording is waiting");
    as("B");
    await saveDraft(draft({ key: "b-key", queued: true }), "B");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await screen.findByText(OTHER_TAB_NOTE);
    expect((await loadDraft("B"))?.key).toBe("b-key");
  });

  it("a guest who signs in claims the recording once, as before", async () => {
    await saveDraft(draft(), null);
    as("U");
    expect((await loadDraft("U"))?.owner).toBe("U");
    as("V");
    expect(await loadDraft("V")).toBeNull();
  });

  it("a person alone never sees a refusal, even when the session has ended in between", async () => {
    as("A");
    for (let i = 0; i < 20; i++) {
      await saveDraft(draft({ key: `k${i}` }), "A"); // false here only means no IndexedDB in the test browser; the page copy serves
      expect((await loadDraft("A"))?.key).toBe(`k${i}`);
      window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: tokenFor("A"), refreshToken: `r${i}` })); // a token refresh keeps the same person
      await clearDraft("A");
      expect(await loadDraft("A")).toBeNull();
    }
  });
});
