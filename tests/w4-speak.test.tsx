// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { peaksFromLevels, tokenFor, limitSeconds, naira, refusalText, durationLabel } from "@/features/speak/logic";
import { clearDraft, loadDraft, saveDraft } from "@/features/speak/draft";
import { ExtraVoiceSheet } from "@/features/speak/ExtraVoiceSheet";
import { SpeakScreen } from "@/features/speak/SpeakScreen";
import { ApiError } from "@/lib/api/client";
import type { ExtraVoiceOffer, ExtraVoiceToken } from "@/lib/api/speak";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/q/q1/speak", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const offers: ExtraVoiceOffer[] = [
  { kind: "SECONDS_30", maxSeconds: 30, priceKobo: 15000, label: "30 seconds" },
  { kind: "SECONDS_60", maxSeconds: 60, priceKobo: 20000, label: "1 minute" },
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
  it("limits at the free seconds or the longest token", () => {
    expect(limitSeconds(10, [])).toBe(10);
    expect(limitSeconds(10, [tok({}), tok({ id: "x", maxSeconds: 60 }), tok({ id: "y", maxSeconds: 90, status: "USED" })])).toBe(60);
  });
  it("formats money from kobo and durations", () => {
    expect(naira(15000)).toBe("₦150");
    expect(naira(13800)).toBe("₦138");
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

describe("ExtraVoice sheet", () => {
  beforeEach(() => { vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined })); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("reads the prices from the offers, preselects the asked one and pays with the chosen method", async () => {
    const onPay = vi.fn();
    render(<ExtraVoiceSheet offers={offers} freeSeconds={10} initial="SECONDS_60" hasTake paying={false} onPay={onPay} onClose={() => undefined} />);
    expect(screen.getByText("You reached the 10 seconds of a free post.")).toBeTruthy();
    expect(screen.getByText("Time for this voice: 10 seconds free, plus 50 more with this token.")).toBeTruthy();
    expect(screen.getByText("Your 10-second recording is kept. Your free posts stay as they are.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /1 minute/ }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: /30 seconds/ }));
    await userEvent.click(screen.getByRole("tab", { name: "USSD" }));
    await userEvent.click(screen.getByRole("button", { name: "Pay ₦150 for 30 seconds" }));
    expect(onPay).toHaveBeenCalledWith(offers[0], "ussd");
    expect(screen.getByRole("button", { name: "No thanks, keep my 10 seconds" })).toBeTruthy();
  });
  it("for an over-limit take it promises no send: real length, a covering token, record again", async () => {
    const onRerecord = vi.fn();
    const onPay = vi.fn();
    render(<ExtraVoiceSheet offers={offers} freeSeconds={10} hasTake takeSeconds={12.4} paying={false} onPay={onPay} onRerecord={onRerecord} onClose={() => undefined} />);
    expect(screen.getByText("Your recording is 12 seconds. A free post is 10.")).toBeTruthy();
    expect(screen.getByText("This token covers your 12-second recording.")).toBeTruthy();
    expect(screen.queryByText(/is kept/)).toBeNull();
    expect(screen.queryByText(/keep my 10 seconds/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Record again" }));
    expect(onRerecord).toHaveBeenCalled();
  });
  it("a 45 s take cannot be paid with the 30 s token", () => {
    render(<ExtraVoiceSheet offers={offers} freeSeconds={10} hasTake takeSeconds={45} paying={false} onPay={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole("radio", { name: /1 minute/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: /Pay ₦200/ }).hasAttribute("disabled")).toBe(false);
  });
  it("from the idle recorder it says nothing about a kept recording", () => {
    render(<ExtraVoiceSheet offers={offers} freeSeconds={10} hasTake={false} paying={false} onPay={() => undefined} onClose={() => undefined} />);
    expect(screen.queryByText(/is kept/)).toBeNull();
    expect(screen.getByRole("button", { name: "No thanks" })).toBeTruthy();
  });
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
const question = { id: "q1", text: "When salary arrives, how many hours pass before it disappears?", hint: null, status: "LIVE", category: { id: "c", slug: "money", name: "Money", blurb: null, voicesThisWeek: 1, questionCount: 1 }, topicTitle: "Salary", voiceCount: 12500, answerCount: 3100, proposalCount: 214, recentVoices: [], iSaved: false, kind: "DAILY", scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, hasOpenPoll: false, topicId: null, weekNumber: null };
const config = { currency: "NGN", freePosts: 10, unitBaseKobo: 1380, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 1000, baseKoboPerUnit: 1380 }, tiers: [], extraVoice: offers };

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

  it("a guest sees the ready recorder, the free post pill, the passes with prices from the API and no tab bar copy", async () => {
    render(<SpeakScreen questionId="q1" />);
    await screen.findByRole("button", { name: "Start recording" });
    expect(screen.getAllByText("10 free posts left").length).toBeGreaterThan(0);
    expect(screen.getByText(/Tap to record\. You have/).textContent).toContain("10 seconds on a free post.");
    const more = screen.getByText("Need more time?").closest("div") as HTMLElement;
    expect(within(more).getByText("Up to 30 seconds")).toBeTruthy();
    expect(within(more).getByText("₦150 for one message")).toBeTruthy();
    expect(within(more).getByText("₦200 for one message")).toBeTruthy();
    expect(screen.queryByText(/Try a prompt/)).toBeNull();
    expect(calls.some((u) => u.includes("/me/allowance"))).toBe(false);
  });

  it("opens the ExtraVoice sheet from a pass, with the price that was tapped", async () => {
    render(<SpeakScreen questionId="q1" />);
    await screen.findByRole("button", { name: "Start recording" });
    await userEvent.click(screen.getByRole("button", { name: /Up to 1 minute/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Pay ₦200 for 1 minute" })).toBeTruthy();
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
