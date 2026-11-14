// @vitest-environment jsdom
// V-SURVEYS round 8: a kept recording belongs to the person the screen or banner was opened for.
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
import { clearDraft, DRAFT_MAX_AGE_MS, loadDraft, saveDraft, sweepStaleDrafts, type Draft } from "@/features/speak/draft";

const token = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.s`;
const as = (sub: string | null) => {
  window.localStorage.removeItem("voices-web-session");
  if (sub) window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: token(sub), refreshToken: "r" }));
};
const COSTS = { freeVoiceSeconds: 10, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30 };
const mk = (key: string, over: Partial<Draft> = {}): Draft => ({ blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 25, peaks: [], questionId: "q1", key, savedAt: Date.now(), queued: true, ...over });
const DAY = 24 * 3600 * 1000;

beforeEach(async () => {
  for (const p of ["A", "B", "C", null]) await clearDraft(p);
  window.localStorage.clear();
  Object.values(speak).forEach((f) => f.mockReset());
  speak.getQuestion.mockResolvedValue({ id: "q1", status: "LIVE" });
  speak.getPublicConfig.mockResolvedValue({ voiceFreeSeconds: 10 });
  speak.getAllowance.mockResolvedValue({ freePostsRemaining: 0, costs: COSTS, extraVoiceTokens: [] }); // costs tokens: offered, sent only on a tap
  speak.createVoiceClip.mockResolvedValue({ clip: { id: "clip1" }, putUrl: "https://put.test/x" });
  speak.completeVoiceClip.mockResolvedValue({});
  speak.getVoiceClip.mockResolvedValue({ status: "READY" });
  speak.createVoiceAnswer.mockResolvedValue({ answer: { id: "ans1" } });
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
afterEach(cleanup);

describe("age limit for every slot", () => {
  it("20 people's 30 day old slots are removed; a 6 day old one stays", async () => {
    const old = Date.now() - 30 * DAY;
    for (let i = 0; i < 20; i++) await saveDraft(`P${i}`, mk(`k${i}`, { recordedAt: old }));
    await saveDraft("Q", mk("kq", { recordedAt: Date.now() - 6 * DAY }));
    as(null);
    await sweepStaleDrafts();
    for (let i = 0; i < 20; i++) expect(await loadDraft(`P${i}`)).toBeNull();
    expect((await loadDraft("Q"))?.key).toBe("kq");
    await clearDraft("Q");
  });
  it("exactly the limit stays; one ms over goes", async () => {
    const now = Date.now();
    await saveDraft("E", mk("ke", { recordedAt: now - DRAFT_MAX_AGE_MS }));
    await saveDraft("F", mk("kf", { recordedAt: now - DRAFT_MAX_AGE_MS - 1 }));
    await sweepStaleDrafts(now);
    expect((await loadDraft("E"))?.key).toBe("ke");
    expect(await loadDraft("F")).toBeNull();
    await clearDraft("E");
  });
  it("the signed-in person's own old slot is left for the banner to report", async () => {
    await saveDraft("A", mk("ka", { recordedAt: Date.now() - 30 * DAY }));
    await sweepStaleDrafts(Date.now(), "A");
    expect((await loadDraft("A"))?.key).toBe("ka");
  });
});

describe("the banner belongs to the person it opened for", () => {
  it("A's banner open, B signs in and keeps a recording, A taps X: B's recording is still there", async () => {
    as("A"); await saveDraft("A", mk("ka"));
    render(<Outbox />);
    await screen.findByRole("button", { name: /^Send for/ });
    as("B"); await saveDraft("B", mk("kb"));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByTestId("outbox")).toBeNull());
    expect((await loadDraft("B"))?.key).toBe("kb");
    expect((await loadDraft("A"))?.key).toBe("ka"); // A's is not cleared either: A is not the one signed in
  });
  it("A's banner open, B signs in, A taps Send: nothing is created, sent, read or cleared", async () => {
    as("A"); await saveDraft("A", mk("ka"));
    render(<Outbox />);
    const btn = await screen.findByRole("button", { name: /^Send for/ });
    as("B"); await saveDraft("B", mk("kb"));
    await userEvent.click(btn);
    await screen.findByText(/signed in as someone else/);
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(speak.createVoiceAnswer).not.toHaveBeenCalled();
    expect((await loadDraft("B"))?.key).toBe("kb");
  });
  it("B signs in at the post: one post as A; later A signs in: nothing is sent again and A's slot is cleared", async () => {
    as("A"); await saveDraft("A", mk("ka"));
    speak.createVoiceAnswer.mockImplementation(async () => { as("B"); return { answer: { id: "ans1" } }; });
    render(<Outbox />);
    await userEvent.click(await screen.findByRole("button", { name: /^Send for/ }));
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(speak.createVoiceAnswer.mock.calls[0][2]).toBe("ka");
    cleanup();
    as("A");
    expect((await loadDraft("A"))?.key).toBe("ka"); // not cleared while B was signed in
    speak.createVoiceClip.mockClear();
    render(<Outbox />);
    await waitFor(async () => expect(await loadDraft("A")).toBeNull());
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1);
  });
});
