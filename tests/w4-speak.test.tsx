// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { peaksFromLevels, tokenFor, refusalText, durationLabel } from "@/features/speak/logic";
import { clearDraft, loadDraft, saveDraft } from "@/features/speak/draft";
import { SpeakScreen } from "@/features/speak/SpeakScreen";
import { ApiError } from "@/lib/api/client";
import type { ExtraVoiceOffer, ExtraVoiceToken } from "@/lib/api/speak";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/q/q1/speak", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const offers: ExtraVoiceOffer[] = [
  { kind: "SECONDS_30", maxSeconds: 30, priceKobo: 7800, label: "30 seconds" },
  { kind: "SECONDS_60", maxSeconds: 60, priceKobo: 10000, label: "1 minute" },
];
const tok = (over: Partial<ExtraVoiceToken>): ExtraVoiceToken => ({ id: "t1", kind: "SECONDS_30", maxSeconds: 30, status: "AVAILABLE", createdAt: "2026-11-05T10:00:00Z", ...over });

describe("speak logic", () => {
  it("draws bars from the loudest moment in each slice, never from nothing", () => {
    expect(peaksFromLevels([])).toEqual([]);
    const p = peaksFromLevels([0, 0.2, 0.4, 0.1, 0.8, 0.05], 3);
    expect(p).toEqual([64, 128, 255]);
    expect(Math.max(...peaksFromLevels([0.1, 0.3], 48))).toBe(255);
  });
  it("picks the smallest available token that covers the take, none inside the free seconds", () => {
    const tokens = [tok({ id: "a", kind: "SECONDS_60", maxSeconds: 60 }), tok({ id: "b" }), tok({ id: "c", status: "USED" })];
    expect(tokenFor(tokens, 9.9, 10)).toBeUndefined();
    expect(tokenFor(tokens, 12, 10)?.id).toBe("b");
    expect(tokenFor(tokens, 45, 10)?.id).toBe("a");
    expect(tokenFor(tokens, 70, 10)).toBeUndefined();
  });
  it("formats durations", () => {
    expect(durationLabel(60)).toBe("1 minute");
    expect(durationLabel(30)).toBe("30 seconds");
  });
  it("shows the server's own words when it explained, a plain line when it did not", () => {
    expect(refusalText(new ApiError(402, "EXTRA_VOICE_REQUIRED", "A longer voice needs an extra voice token.", true))).toBe("A longer voice needs an extra voice token.");
    expect(refusalText(new ApiError(500, "HTTP_500", "Request failed (500)", false))).toMatch(/Try again in a moment/);
    expect(refusalText(new ApiError(0, "OFFLINE", "x", false))).toMatch(/offline/i);
  });
});

describe("draft store", () => {
  it("keeps one recording and gives it back (memory copy when IndexedDB is blocked)", async () => {
    await clearDraft();
    expect(await loadDraft()).toBeNull();
    const blob = new Blob(["abc"], { type: "audio/webm" });
    await saveDraft({ questionId: "q1", blob, mime: "audio/webm", seconds: 4, peaks: [1, 2], key: "k", savedAt: 1 });
    const d = await loadDraft();
    expect(d?.questionId).toBe("q1");
    expect(d?.seconds).toBe(4);
    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
const question = { id: "q1", text: "When salary arrives, how many hours pass before it disappears?", hint: null, status: "LIVE", category: { id: "c", slug: "money", name: "Money", blurb: null, voicesThisWeek: 1, questionCount: 1 }, topicTitle: "Salary", voiceCount: 12500, answerCount: 3100, proposalCount: 214, recentVoices: [], iSaved: false, kind: "DAILY", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, hasOpenPoll: false, topicId: null, weekNumber: null };
const config = { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: offers };

describe("SpeakScreen", () => {
  let calls: string[];
  beforeEach(() => {
    calls = [];
    push.mockClear();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith("/questions/q1")) return json(question);
      if (url.endsWith("/config/public")) return json(config);
      return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

  it("a guest sees the ready recorder, the free post pill and the voice prices from the API; no extra voice to buy", async () => {
    render(<SpeakScreen questionId="q1" />);
    await screen.findByRole("button", { name: "Start recording" });
    expect(screen.getAllByText("10 free posts left").length).toBeGreaterThan(0);
    const hint = screen.getByText(/Tap to record\. You have/).textContent ?? "";
    expect(hint).toContain("60 seconds");
    expect(hint).toContain("A free post covers 10 seconds.");
    expect(hint).toContain("Up to 30 seconds is 78 tokens, longer is 100 tokens, charged when you send.");
    expect(screen.queryByText("Need more time?")).toBeNull();
    expect(screen.queryByRole("button", { name: /Up to 1 minute/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Try a prompt/)).toBeNull();
    expect(calls.some((u) => u.includes("/me/allowance"))).toBe(false);
  });

  it("says plainly when the browser cannot record", async () => {
    render(<SpeakScreen questionId="q1" />);
    const b = await screen.findByRole("button", { name: "Start recording" });
    await userEvent.click(b);
    await screen.findByText("This browser cannot record");
    expect(screen.getByRole("link", { name: "Write instead" }).getAttribute("href")).toBe("/q/q1/write");
  });

  it("shows the not-found words for a missing question", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "NOT_FOUND", message: "no" } }, 404)));
    render(<SpeakScreen questionId="nope" />);
    await waitFor(() => expect(screen.getByText("We could not find that.")).toBeTruthy());
  });
});
