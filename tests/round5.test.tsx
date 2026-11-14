// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";
import { needsNewKey, newKeyLine } from "@/lib/api/keys";
import { useStartWatch } from "@/components/feed/useLoad";
import { noteServerDate, noteServerTime, resetServerClock, serverNow } from "@/lib/api/server-clock";
import { renewDraftKey, getDraft, saveDraft } from "@/features/units/draft";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));

const OPENS = Date.parse("2026-11-14T23:00:00Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("round 5 MEDIUM-1: one helper decides when a post needs a new key", () => {
  it("409 CONFLICT 'new key' and IDEMPOTENCY_KEY_REUSED do; a plain 409, a 500 and a non-error do not", () => {
    expect(needsNewKey(new ApiError(409, "CONFLICT", "Start again with a new key", true))).toBe(true);
    expect(needsNewKey(new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "x", true))).toBe(true);
    expect(needsNewKey(new ApiError(409, "CONFLICT", "Another request with this key is running", true))).toBe(false);
    expect(needsNewKey(new ApiError(500, "INTERNAL", "new key", true))).toBe(false);
    expect(needsNewKey(new Error("x"))).toBe(false);
    expect(newKeyLine("Send")).toBe("That did not post. Tap Send to try again.");
  });
  it("a held draft keeps its words and gets a new key", () => {
    window.localStorage.clear();
    const d = saveDraft("q1", "hello")!;
    renewDraftKey("q1");
    const e = getDraft("q1")!;
    expect(e.body).toBe("hello");
    expect(e.key).not.toBe(d.key);
    expect(saveDraft("q1", "hello")!.key).toBe(e.key); // the same words keep the new key
  });
  it("a reply box: three taps after a 409 carry three different keys", async () => {
    vi.useRealTimers();
    const keys: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST" && /\/answers\/a1\/replies$/.test(String(u))) { keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? ""); return json({ error: { code: "CONFLICT", message: "Start again with a new key", requestId: "r" } }, 409); }
      return json({ items: [], nextCursor: null });
    }));
    const costs = { freeReactionsPerDay: 20, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000 };
    const allow = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
    const { ReplyComposer } = await import("@/features/talk/ReplyComposer");
    const userEvent = (await import("@testing-library/user-event")).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<ReplyComposer aid="a1" qid="q1" who="@ada" stance="AGREE" allow={allow as any} onPosted={() => undefined} onBuy={() => undefined} />);
    await userEvent.type(await screen.findByRole("textbox"), "I agree");
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole("button", { name: /^Post/ }));
      await screen.findByText("That did not post. Tap Post to try again.");
    }
    expect(keys.length).toBe(3);
    expect(new Set(keys).size).toBe(3);
  });
});

describe("round 5 LOW-2: the newest reading wins, by the time it stands for, not by arrival", () => {
  it("an old answer that arrives after a newer one does not move the clock back", () => {
    vi.useFakeTimers({ now: 1_000_000_000_000 });
    noteServerDate(new Date(1_000_000_600_000).toUTCString());
    noteServerDate(new Date(1_000_000_540_000).toUTCString()); // arrives last, is older
    expect(serverNow()).toBe(1_000_000_600_000);
    noteServerDate(new Date(1_000_000_540_000).toUTCString(), "60"); // an older Date held 60 s by a cache: the same instant as the newest, nothing newer
    expect(serverNow()).toBe(1_000_000_600_000);
    noteServerDate(new Date(1_000_000_540_000).toUTCString(), "100"); // stands for a later instant: taken
    expect(serverNow()).toBe(1_000_000_640_000);
    noteServerTime(1_000_000_630_000); // a page drawn earlier: not taken
    expect(serverNow()).toBe(1_000_000_640_000);
  });
});

describe("round 5 MEDIUM-2: a device clock that steps while the page is open", () => {
  function Watch({ onAsk, fetched }: { onAsk: () => void; fetched: { current: number } }) {
    useStartWatch(OPENS, async () => onAsk(), fetched);
    return null;
  }
  for (const [name, step] of [["back 10 minutes", -600_000], ["back 3 hours", -10_800_000], ["forward 10 minutes", 600_000], ["forward 3 hours", 10_800_000]] as const) {
    it(`clock right at load, then ${name}: asks within 5 s of the real instant`, async () => {
      vi.useFakeTimers({ now: OPENS - 120_000 });
      noteServerDate(new Date().toUTCString());
      const asks: number[] = []; // real time = fake performance time since the start
      const t0 = performance.now();
      const fetched = { current: Date.now() };
      render(<Watch onAsk={() => asks.push(performance.now() - t0)} fetched={fetched} />);
      await tick(30_000);
      vi.setSystemTime(Date.now() + step); // the device clock steps; the timers and performance.now go on
      await tick(30_000 + 60_000 + 6_000); // to 6 s after the real instant (120 s from the start)
      const real = 120_000;
      const after = asks.filter((t) => t >= real);
      expect(after.length).toBeGreaterThan(0);
      expect(after[0] - real).toBeLessThanOrEqual(5_100);
      expect(asks.filter((t) => t < real).length).toBeLessThanOrEqual(step > 0 ? 2 : 0); // forward: early asks at most one a minute
    });
  }
  it("returning to the tab asks when the device clock is earlier than the last fetch", async () => {
    vi.useFakeTimers({ now: OPENS - 600_000 });
    const asks: number[] = [];
    const fetched = { current: Date.now() };
    render(<Watch onAsk={() => asks.push(1)} fetched={fetched} />);
    await tick(10_000);
    expect(asks.length).toBe(0);
    vi.setSystemTime(Date.now() - 3_600_000); // the clock went back an hour: the data's age cannot be read from it
    window.dispatchEvent(new Event("focus"));
    await tick(50);
    expect(asks.length).toBe(1);
  });
});

describe("round 5 MEDIUM-3: two guesses of the opening instant", () => {
  function Watch({ onAsk }: { onAsk: () => void }) {
    useStartWatch(OPENS, async () => onAsk(), { current: Date.now() });
    return null;
  }
  // [name, device skew, header skew (null = no header)]
  const cases: [string, number, number | null][] = [
    ["header right, device 10 min slow", -600_000, 0],
    ["header right, device 10 min fast", 600_000, 0],
    ["device right, header 10 min slow", 0, -600_000],
    ["device right, header 10 min fast", 0, 600_000],
    ["header missing, device right", 0, null],
  ];
  for (const [name, dev, hdr] of cases) {
    it(`${name}: asks within 5 s of the real instant, at most once a minute before it`, async () => {
      const real0 = OPENS - 180_000; // three minutes before
      vi.useFakeTimers({ now: real0 + dev });
      if (hdr !== null) noteServerDate(new Date(real0 + hdr).toUTCString());
      const asks: number[] = [];
      const t0 = performance.now();
      render(<Watch onAsk={() => asks.push(performance.now() - t0)} />);
      await tick(186_000);
      const real = 180_000;
      const after = asks.filter((t) => t >= real);
      expect(after.length).toBeGreaterThan(0);
      expect(after[0] - real).toBeLessThanOrEqual(5_100);
      expect(asks.filter((t) => t < real).length).toBeLessThanOrEqual(3); // three minutes: one a minute
    });
  }
  it("header missing and device 10 min slow: late by design (both guesses are wrong the same way)", async () => {
    vi.useFakeTimers({ now: OPENS - 180_000 - 600_000 });
    let n = 0;
    render(<Watch onAsk={() => { n += 1; }} />);
    await tick(186_000);
    expect(n).toBe(0);
  });
});
