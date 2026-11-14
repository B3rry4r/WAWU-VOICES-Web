// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => true }));
vi.mock("@/lib/audio-ref/upload", () => ({ putWithRetry: vi.fn(() => Promise.resolve()) }));
const recordShareEvent = vi.hoisted(() => vi.fn((..._a: unknown[]) => Promise.resolve()));
vi.mock("@/lib/api/reach", () => ({ recordShareEvent: (...a: unknown[]) => recordShareEvent(...a) }));
const speak = vi.hoisted(() => ({
  getQuestion: vi.fn(), getPublicConfig: vi.fn(), getAllowance: vi.fn(),
  createVoiceClip: vi.fn(), completeVoiceClip: vi.fn(), getVoiceClip: vi.fn(), deleteVoiceClip: vi.fn(), createVoiceAnswer: vi.fn(),
}));
vi.mock("@/lib/api/speak", () => ({ ...Object.fromEntries(Object.entries(speak).map(([k, f]) => [k, (...a: unknown[]) => (f as (...x: unknown[]) => unknown)(...a)])) }));

import { Outbox } from "@/features/speak/Outbox";
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/features/speak/draft";
import { sendKeptRecording } from "@/features/speak/outbox";
import { ApiError } from "@/lib/api/client";

const COSTS = { freeVoiceSeconds: 10, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30 };
const allowance = (freeLeft: number) => ({ freePostsRemaining: freeLeft, costs: COSTS, extraVoiceTokens: [] });
const draft = (over: Partial<Draft> = {}): Draft => ({ questionId: "q1", blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", seconds: 8, peaks: [], key: "key-r2", savedAt: Date.now(), queued: true, ...over });

beforeEach(async () => {
  await clearDraft();
  recordShareEvent.mockClear();
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
afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, "locks"); window.localStorage.clear(); });

describe("V-FIX-D round 2: the outbox says what it is doing and can be retried", () => {
  it("while a free recording is sending the banner says Sending your saved voice", async () => {
    let done: (v: unknown) => void = () => undefined;
    speak.createVoiceAnswer.mockReturnValue(new Promise((r) => { done = r; }));
    await saveDraft(draft());
    render(<Outbox />);
    await screen.findByText("Sending your saved voice");
    await act(async () => { done({ answer: { id: "ans1" } }); });
    await screen.findByText(/Your saved voice was posted/);
  });

  it("a free one that fails keeps a Try again button, which sends with the same key", async () => {
    speak.createVoiceAnswer.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "x", false));
    await saveDraft(draft());
    render(<Outbox />);
    const again = await screen.findByRole("button", { name: "Try again" });
    expect(await loadDraft()).not.toBeNull();
    await userEvent.click(again);
    await screen.findByText(/Your saved voice was posted/);
    expect(speak.createVoiceAnswer.mock.calls.map((c) => c[2])).toEqual(["key-r2", "key-r2"]);
  });

  it("a priced one keeps its Send for N tokens button after a failure", async () => {
    speak.getAllowance.mockResolvedValue(allowance(0));
    speak.createVoiceAnswer.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "x", false));
    await saveDraft(draft({ seconds: 25 }));
    render(<Outbox />);
    await userEvent.click(await screen.findByRole("button", { name: /^Send for .+ tokens$/ }));
    await screen.findByText(/We could not send it/);
    await userEvent.click(screen.getByRole("button", { name: /^Send for .+ tokens$/ }));
    await screen.findByText(/Your saved voice was posted/);
  });

  it("a recording that came from a share link counts as published from it when the outbox posts it, in a later visit", async () => {
    await saveDraft(draft({ shareCode: "abc1234" }));
    render(<Outbox />);
    await screen.findByText(/Your saved voice was posted/);
    expect(recordShareEvent.mock.calls).toEqual([["abc1234", "published_from_link"]]);
  });

  it("a recording with no share link counts nothing", async () => {
    await saveDraft(draft());
    render(<Outbox />);
    await screen.findByText(/Your saved voice was posted/);
    expect(recordShareEvent).not.toHaveBeenCalled();
  });

  it("saveDraft says false when the device cannot keep the recording (no storage here), so no screen may call it saved", async () => {
    expect(await saveDraft(draft())).toBe(false);
  });
});

describe("V-FIX-D round 2: two tabs never send one recording", () => {
  function fakeLocks() {
    const held = new Map<string, Promise<unknown>>();
    return {
      request: async (name: string, a: unknown, b?: (l: unknown) => Promise<unknown>) => {
        const opts = typeof a === "object" && a ? (a as { ifAvailable?: boolean }) : {};
        const cb = (typeof a === "function" ? a : b) as (l: unknown) => Promise<unknown>;
        while (held.has(name)) {
          if (opts.ifAvailable) return cb(null);
          await held.get(name)!.catch(() => undefined);
        }
        const p = cb({ name });
        held.set(name, p);
        try { return await p; } finally { held.delete(name); }
      },
    };
  }

  it("with Web Locks: one tab uploads, the other waits and then reports it done, uploading nothing", async () => {
    Object.defineProperty(navigator, "locks", { value: fakeLocks(), configurable: true });
    let finish: (v: unknown) => void = () => undefined;
    speak.createVoiceAnswer.mockReturnValue(new Promise((r) => { finish = r; }));
    const a = sendKeptRecording(draft());
    await waitFor(() => expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1));
    const b = sendKeptRecording(draft(), undefined, async () => false);
    await new Promise((r) => setTimeout(r, 20));
    finish({ answer: { id: "ans1" } });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toMatchObject({ ok: true, answerId: "ans1" });
    expect(rb).toMatchObject({ ok: true, answerId: null, byOtherTab: true });
    expect(speak.createVoiceClip).toHaveBeenCalledTimes(1);
    expect(speak.createVoiceAnswer).toHaveBeenCalledTimes(1);
  });

  it("without Web Locks: a fresh storage flag from another tab makes this one wait and upload nothing; a stale flag does not block", async () => {
    window.localStorage.setItem("voices-send-lock:key-r2", String(Date.now()));
    setTimeout(() => window.localStorage.removeItem("voices-send-lock:key-r2"), 1200);
    const r = await sendKeptRecording(draft(), undefined, async () => false);
    expect(r).toMatchObject({ ok: true, byOtherTab: true });
    expect(speak.createVoiceClip).not.toHaveBeenCalled();
    window.localStorage.setItem("voices-send-lock:key-r2", String(Date.now() - 5 * 60_000));
    const s = await sendKeptRecording(draft());
    expect(s).toMatchObject({ ok: true, answerId: "ans1" });
    expect(window.localStorage.getItem("voices-send-lock:key-r2")).toBeNull();
  });
});
