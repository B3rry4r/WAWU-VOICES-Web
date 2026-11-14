// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { HomeScreen } from "@/components/feed/HomeScreen";
import { Go } from "@/features/entry/Go";
import { Landing } from "@/features/entry/Landing";
import { Onboarding } from "@/features/entry/Onboarding";
import { QuestionScreen } from "@/features/talk/QuestionScreen";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const OPENS = Date.parse("2026-11-14T23:00:00Z");
const BEFORE = OPENS - 30_000;
const TOPIC = { id: "t1", weekNumber: 1, title: "Are You Really Fine?", questionCount: 10, status: "SCHEDULED", startsOn: "2026-11-16", endsOn: "2026-11-22", weeklyPollId: null, reportId: null, voiceCount: 0, voicesCount: 0 };
const launch = (open: boolean) => ({ id: "q9", kind: "DAILY", status: open ? "LIVE" : "SCHEDULED", startsAt: new Date(OPENS).toISOString(), endsAt: "2026-11-22T23:00:00.000Z", text: "How do you feel about Nigeria right now?", hint: "Say it in your voice.", voiceCount: 0, voicesCount: 0, answerCount: 0, category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], proposalCount: 0, iSaved: false });

let stubOpenAt = OPENS; // the instant the API starts to say LIVE
let calls: string[] = [];
let hidden = false;

function stub() {
  calls = [];
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const u = String(input);
    calls.push(u);
    const open = Date.now() >= stubOpenAt;
    if (u.endsWith("/home")) return json({ topicOfWeek: TOPIC, dailyQuestion: launch(open), flashPoll: null, trending: [], newConversations: [], sponsored: null, greetingName: null });
    if (u.endsWith("/questions/today") || u.endsWith("/questions/q9")) return json(launch(open));
    if (u.includes("/feed/trending")) return json({ items: [], nextCursor: null });
    if (u.endsWith("/config/public")) return json({ currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs: {}, tiers: [], extraVoice: [], voiceFreeSeconds: 10 });
    if (u.endsWith("/polls/current")) return json(null);
    if (u.includes("/answers")) return json({ items: [], nextCursor: null });
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
}

const SCREENS: [string, () => JSX.Element, (t: string) => boolean][] = [
  ["Home", () => <HomeScreen />, (t) => t.includes("Today’s question") && !t.includes("Opens Sunday")],
  ["the landing page", () => <Landing />, (t) => t.includes("Today’s question") && !t.includes("Opens Sunday")],
  ["/go", () => <Go />, (t) => !t.includes("Opens Sunday") && !t.includes("Coming up")],
  ["/join", () => <Onboarding />, (t) => !t.includes("Opens Sunday") && !t.includes("Coming up")],
  ["the question page", () => <QuestionScreen id="q9" />, (t) => !t.includes("Opens Sunday") && !t.includes("Coming up")],
];

async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe("every screen turns live at the opening by itself", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: BEFORE });
    window.localStorage.clear();
    stubOpenAt = OPENS;
    hidden = false;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
    stub();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  for (const [name, el, live] of SCREENS) {
    it(`${name}: loaded 30 seconds before, untouched, is live within 10 seconds of the instant; no polling before it`, async () => {
      const { container } = render(el());
      await tick(100);
      expect(container.textContent).toContain("Opens Sunday 15 November");
      const loaded = calls.length;
      expect(loaded).toBeGreaterThan(0);
      await tick(29_000); // up to 1 s before the instant
      expect(calls.length).toBe(loaded); // one load, no polling
      expect(container.textContent).toContain("Opens Sunday 15 November");
      // 1 s before + 11 s: the instant plus 0 to 5 s of spread plus the fetch.
      await tick(1_000 + 5_100);
      expect(live(container.textContent ?? "")).toBe(true);
    });

    it(`${name}: a page asleep through the instant is live within 2 seconds of waking`, async () => {
      const { container } = render(el());
      await tick(100);
      expect(container.textContent).toContain("Opens Sunday 15 November");
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
      vi.setSystemTime(OPENS + 8 * 3_600_000); // the phone slept eight hours
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
      await tick(2_000);
      expect(live(container.textContent ?? "")).toBe(true);
    });
  }

  it("while the API still says not open the card stays, and it asks again after 5, 15, 30 then every 60 seconds", async () => {
    stubOpenAt = OPENS + 3_600_000; // the API is late
    const { container } = render(<Landing />);
    await tick(100);
    const base = calls.filter((c) => c.endsWith("/questions/today")).length;
    await tick(30_000 + 5_100); // past the instant and its spread: the first ask
    const asks = () => calls.filter((c) => c.endsWith("/questions/today")).length - base;
    expect(asks()).toBe(1);
    expect(container.textContent).toContain("Opens Sunday 15 November"); // still the coming-up card
    await tick(5_000); expect(asks()).toBe(2);
    await tick(15_000); expect(asks()).toBe(3);
    await tick(30_000); expect(asks()).toBe(4);
    await tick(60_000); expect(asks()).toBe(5);
    await tick(60_000); expect(asks()).toBe(6);
    expect(container.textContent).toContain("Opens Sunday 15 November");
  });

  it("a page in the background does not ask, and asks at once when it comes back", async () => {
    stubOpenAt = OPENS + 3_600_000;
    render(<Landing />);
    await tick(100);
    hidden = true;
    const before = calls.length;
    await tick(120_000);
    expect(calls.length).toBe(before);
    hidden = false;
    window.dispatchEvent(new Event("focus"));
    await tick(50);
    expect(calls.length).toBeGreaterThan(before);
  });

  it("an open question is loaded once and never polled", async () => {
    stubOpenAt = 0;
    render(<Landing />);
    await tick(100);
    const n = calls.length;
    await tick(300_000);
    window.dispatchEvent(new Event("focus"));
    await tick(1_000);
    expect(calls.length).toBe(n);
  });

  it("no live buttons before the API agrees: after the instant, while the fetch runs, the card is still Coming up", async () => {
    stubOpenAt = OPENS + 3_600_000;
    const { container } = render(<Landing />);
    await tick(100);
    vi.setSystemTime(OPENS + 1_000);
    await tick(500);
    expect(container.textContent).toContain("Opens Sunday 15 November");
    expect(container.querySelector(".vx-hero__cta")).toBeNull();
  });
});
