// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/features/speak/draft";
import { planFor } from "@/features/speak/outbox";
import { ApiError } from "@/lib/api/client";

const COSTS = { freeVoiceSeconds: 10, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30 };
const allowance = (freeLeft: number) => ({ freePostsRemaining: freeLeft, costs: COSTS, extraVoiceTokens: [] });
const draft = (over: Partial<Draft> = {}): Draft => ({
  questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 8, peaks: [], key: "key-1", savedAt: Date.now(), queued: true, ...over,
});

beforeEach(async () => {
  await clearDraft();
  Object.values(speak).forEach((f) => f.mockReset());
  speak.getQuestion.mockResolvedValue({ id: "q1", status: "LIVE" });
  speak.getPublicConfig.mockResolvedValue({ voiceFreeSeconds: 10 });
  speak.getAllowance.mockResolvedValue(allowance(5));
  speak.createVoiceClip.mockResolvedValue({ clip: { id: "clip1" }, putUrl: "https://put.test/x" });
  speak.completeVoiceClip.mockResolvedValue({});
  speak.getVoiceClip.mockResolvedValue({ status: "READY" });
  speak.createVoiceAnswer.mockResolvedValue({ answer: { id: "ans1" } });
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
afterEach(cleanup);

describe("V-FIX-D: recordings made offline send themselves, or ask first", () => {
  it("planFor: free when a free post covers it, otherwise a priced Send", () => {
    const cfg = { voiceFreeSeconds: 10 } as never;
    expect(planFor({ seconds: 8 }, { allowance: allowance(5) as never, config: cfg })).toMatchObject({ free: true, label: "Send" });
    expect(planFor({ seconds: 8 }, { allowance: allowance(0) as never, config: cfg }).free).toBe(false);
    const long = planFor({ seconds: 45 }, { allowance: allowance(5) as never, config: cfg });
    expect(long.free).toBe(false);
    expect(long.label).toMatch(/^Send for .+ tokens$/);
  });

  it("a free recording is sent by itself, once, with its own key as the Idempotency-Key, and the kept copy is removed", async () => {
    await saveDraft(draft({ anonymous: true, mood: null }));
    render(<Outbox />);
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
    expect(speak.createVoiceAnswer).toHaveBeenCalledWith("q1", "clip1", "key-1", undefined, null, true);
    await waitFor(() => expect(screen.getByText(/Your saved voice was posted/)).toBeTruthy());
    expect(await loadDraft()).toBeNull();
    // the connection coming back again sends nothing more
    await act(async () => { window.dispatchEvent(new Event("online")); await new Promise((r) => setTimeout(r, 20)); });
    expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1);
    expect(speak.createVoiceClip).toHaveBeenCalledTimes(1);
  });

  it("two reconnects at once still send one recording once", async () => {
    await saveDraft(draft());
    render(<Outbox />);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
    expect(speak.createVoiceClip).toHaveBeenCalledTimes(1);
  });

  it("a recording that costs tokens is offered with its price and is NOT sent until the person taps Send", async () => {
    speak.getAllowance.mockResolvedValue(allowance(0));
    await saveDraft(draft({ seconds: 25 }));
    render(<Outbox />);
    const btn = await screen.findByRole("button", { name: /^Send for .+ tokens$/ });
    expect(screen.getByText(/Saved while you were offline, 25 seconds/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(speak.createVoiceAnswer).not.toHaveBeenCalled();
    await userEvent.click(btn);
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
    expect(speak.createVoiceAnswer.mock.calls[0][2]).toBe("key-1");
  });

  it("Delete on the offer removes the recording and sends nothing", async () => {
    speak.getAllowance.mockResolvedValue(allowance(0));
    await saveDraft(draft({ seconds: 25 }));
    render(<Outbox />);
    await screen.findByRole("button", { name: /^Send for/ });
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(async () => expect(await loadDraft()).toBeNull());
    expect(speak.createVoiceAnswer).not.toHaveBeenCalled();
  });

  it("a recording older than 7 days is removed with a plain note and never sent", async () => {
    await saveDraft(draft({ recordedAt: Date.now() - 8 * 24 * 3600 * 1000 }));
    render(<Outbox />);
    await waitFor(() => expect(screen.getByText("A recording you saved more than 7 days ago was removed.")).toBeTruthy());
    expect(await loadDraft()).toBeNull();
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
  });

  it("a recording the person only listened to (never sent) is left alone", async () => {
    await saveDraft(draft({ queued: false }));
    render(<Outbox />);
    await new Promise((r) => setTimeout(r, 40));
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(screen.queryByTestId("outbox")).toBeNull();
    expect(await loadDraft()).not.toBeNull();
  });

  it("offline at open: nothing is tried; when the connection comes back it is sent", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    await saveDraft(draft());
    render(<Outbox />);
    await new Promise((r) => setTimeout(r, 40));
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
  });

  it("a send that fails offline keeps the recording for the next reconnect (no second post is made meanwhile)", async () => {
    speak.createVoiceAnswer.mockRejectedValueOnce(new ApiError(0, "NETWORK", "offline", false));
    await saveDraft(draft());
    render(<Outbox />);
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
    expect(await loadDraft()).not.toBeNull();
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(2));
    // the same key both times: the server answers the second with the first post
    expect(speak.createVoiceAnswer.mock.calls.map((c) => c[2])).toEqual(["key-1", "key-1"]);
  });

  it("a closed question removes the recording with a note and sends nothing", async () => {
    speak.getQuestion.mockResolvedValue({ id: "q1", status: "CLOSED" });
    await saveDraft(draft());
    render(<Outbox />);
    await waitFor(() => expect(screen.getByText(/has closed/)).toBeTruthy());
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    expect(await loadDraft()).toBeNull();
  });
});
