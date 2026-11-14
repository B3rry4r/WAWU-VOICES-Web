// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { HomeScreen } from "@/components/feed/HomeScreen";
import { Go } from "@/features/entry/Go";
import { Landing } from "@/features/entry/Landing";
import { Onboarding } from "@/features/entry/Onboarding";
import { OpenGate } from "@/features/talk/OpenGate";
import { ShareGate } from "@/features/share/ShareGate";
import { sharePageBody } from "./support/share-page";
import { ShareSheet } from "@/features/share/ShareSheet";
import { longDay } from "@/lib/format/date";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const OPENS = Date.parse("2026-11-14T23:00:00Z");
const TOPIC = { id: "t1", weekNumber: 1, title: "Are You Really Fine?", questionCount: 10, status: "SCHEDULED", startsOn: "2026-11-16", endsOn: "2026-11-22", weeklyPollId: "p1", reportId: null, voiceCount: 0, voicesCount: 0 };
const launch = (open: boolean) => ({ id: "q9", kind: "DAILY", status: open ? "LIVE" : "SCHEDULED", startsAt: new Date(OPENS).toISOString(), endsAt: "2026-11-22T23:00:00.000Z", text: "How do you feel about Nigeria right now?", hint: "Say it in your voice.", voiceCount: 0, voicesCount: 0, answerCount: 0, category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], proposalCount: 0, iSaved: false });

let open = false;
let report: unknown = null;
let leak = false;
function stub() {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const u = String(input);
    if (u.endsWith("/home")) return json({ topicOfWeek: TOPIC, dailyQuestion: launch(open), flashPoll: null, trending: [], newConversations: [], sponsored: null, greetingName: null });
    if (u.endsWith("/questions/today") || u.endsWith("/questions/q9")) return json(launch(open));
    if (u.includes("/feed/trending")) return json({ items: leak ? [{ type: "answer", answer: { id: "a1", kind: "TEXT", body: "A voice that should not show", labels: [], likeCount: 0, replyCount: 0, reactionCount: 0, reactionBreakdown: [], createdAt: "2026-11-14T10:00:00Z", author: null } }] : [], nextCursor: null });
    if (u.endsWith("/config/public")) return json({ currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs: {}, tiers: [], extraVoice: [], voiceFreeSeconds: 10 });
    if (u.endsWith("/polls/current")) return json({ id: "p1", question: "Q", totalVotes: 40, options: [{ id: "o1", label: "Yes", votes: 30 }, { id: "o2", label: "No", votes: 10 }] });
    if (u.endsWith("/weekly-reports/latest")) return json(report);
    return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
}
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
const text = (c: HTMLElement) => c.textContent ?? "";

describe("before the opening nothing says it has started", () => {
  beforeEach(() => { vi.useFakeTimers({ now: OPENS - 3_600_000 }); window.localStorage.clear(); open = false; report = null; leak = false; stub(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("the landing page: no Listen as a guest, no Add your voice, no voice under the card; Join VOICES stays", async () => {
    leak = true;
    const { container } = render(<Landing />);
    await tick(200);
    const t = text(container);
    expect(t).toContain("Opens Sunday 15 November");
    expect(t).not.toMatch(/Listen as a guest|Add your voice|A voice that should not show/);
    expect(screen.getAllByRole("link", { name: "Join VOICES" }).length).toBeGreaterThan(0);
  });
  it("/go: no Listen as a guest, no Add your voice; Join VOICES and Sign in stay", async () => {
    const { container } = render(<Go />);
    await tick(200);
    expect(text(container)).not.toMatch(/Listen as a guest|Add your voice/);
    expect(screen.getAllByRole("link", { name: "Join VOICES" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Sign in" }).length).toBeGreaterThan(0);
  });
  it("Home: no Listening is free banner, no Weekly report row without a report, no New conversations heading over nothing", async () => {
    const { container } = render(<HomeScreen />);
    await tick(200);
    expect(text(container)).toContain("Opens Sunday 15 November");
    expect(text(container)).not.toMatch(/Listening is free|Weekly report|New conversations|Nothing new yet/);
  });
  it("Home draws the Weekly report row when a report exists", async () => {
    report = { id: "r1" };
    const { container } = render(<HomeScreen />);
    await tick(200);
    expect(text(container)).toContain("Weekly report");
  });
  it("/join: no player, no 0:06, no reaction chips, no Open poll line, on any slide; the words and the coming-up card stay", async () => {
    const { container } = render(<Onboarding />);
    await tick(200);
    for (let i = 0; i < 3; i++) {
      const t = text(container);
      expect(t).not.toMatch(/0:06|Open poll|Exactly|Relatable|Thought-provoking/);
      expect(container.querySelector("[role='slider'], audio, [data-voice-player], .vx-player")).toBeNull();
      expect(t).toContain("Opens Sunday 15 November");
      const next = screen.queryByRole("button", { name: "Next" });
      if (next) fireEvent.click(next);
    }
  });
});

describe("the door to every action address", () => {
  beforeEach(() => { vi.useFakeTimers({ now: OPENS - 60_000 }); open = false; stub(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("shows Coming up, the text, the hint and the day, with no children, until the API says open; then the screen", async () => {
    const { container } = render(<OpenGate questionId="q9"><p>THE RECORDER</p></OpenGate>);
    await tick(200);
    expect(text(container)).toContain("Coming up");
    expect(text(container)).toContain("How do you feel about Nigeria right now?");
    expect(text(container)).toContain("Say it in your voice.");
    expect(text(container)).toContain("Opens Sunday 15 November");
    expect(text(container)).not.toMatch(/THE RECORDER|has closed|Today’s question|Your voice is live/);
    open = true;
    await tick(60_000 + 6_000);
    expect(text(container)).toContain("THE RECORDER");
    expect(text(container)).not.toContain("Coming up");
  });
  it("with no id it asks for today's question", async () => {
    const { container } = render(<OpenGate><p>THE RECORDER</p></OpenGate>);
    await tick(200);
    expect(text(container)).toContain("Opens Sunday 15 November");
  });
  it("an open question goes straight through", async () => {
    open = true;
    const { container } = render(<OpenGate questionId="q9"><p>THE RECORDER</p></OpenGate>);
    await tick(200);
    expect(text(container)).toContain("THE RECORDER");
  });
  it("a question it cannot read goes through to the screen, which shows its own error", async () => {
    const { container } = render(<OpenGate questionId="zzz"><p>THE RECORDER</p></OpenGate>);
    await tick(200);
    expect(text(container)).toContain("THE RECORDER");
  });
});

describe("the share page and the share sheet", () => {
  beforeEach(() => { vi.useFakeTimers({ now: OPENS - 60_000 }); refresh.mockClear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("the page is drawn live from the browser at the opening, and not before (once the API says the question is open)", async () => {
    let answers = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { answers += 1; return json(sharePageBody(true)); }));
    render(<ShareGate code="c1" opensAt={OPENS} serverNow={Date.now()}><p>COMING UP DRAWN BY THE SERVER</p></ShareGate>);
    await tick(59_000);
    expect(document.body.textContent).toContain("COMING UP DRAWN BY THE SERVER");
    expect(answers).toBe(0);
    await tick(1_000 + 5_100);
    expect(screen.getByTestId("share-page")).toBeTruthy();
    expect(document.body.textContent).not.toContain("COMING UP DRAWN BY THE SERVER");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("if the API will not make a link for a question that has not opened, the sheet says so and offers to copy the question's own address", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "NOT_FOUND", message: "no" } }, 404)));
    const write = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: write } });
    render(<ShareSheet objectType="QUESTION" objectId="q9" notOpen onClose={() => undefined} />);
    await tick(200);
    expect(document.body.textContent).toContain("We cannot make a share link for this question yet.");
    expect(document.body.textContent).not.toContain("We could not make your link");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Copy the question/ })); });
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/q/q9`);
  });
});

describe("dates", () => {
  it("a day in another year carries its year, in Lagos time", () => {
    vi.useFakeTimers({ now: OPENS, toFake: ["Date"] });
    expect(longDay("2026-11-14T23:00:00Z")).toBe("Sunday 15 November");
    expect(longDay("2027-09-27T12:00:00+01:00")).toBe("Monday 27 September 2027");
    // 31 Dec 23:30 UTC is already 1 Jan in Lagos: next year, so the year shows.
    expect(longDay("2026-12-31T23:30:00Z")).toBe("Friday 1 January 2027");
    vi.useRealTimers();
  });
});
