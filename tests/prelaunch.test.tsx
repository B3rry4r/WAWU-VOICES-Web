// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { QuestionHero } from "@/components/vx";
import { WeekCard } from "@/components/feed/parts";
import { HomeScreen } from "@/components/feed/HomeScreen";
import { Go } from "@/features/entry/Go";
import { Landing } from "@/features/entry/Landing";
import { QuestionScreen } from "@/features/talk/QuestionScreen";
import { comingUp, notOpenYet, startsLabel, topicNotStarted } from "@/lib/feed-format";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// 14 Nov 2026 05:18 UTC, the moment the launch calendar was measured.
const BEFORE = Date.parse("2026-11-14T05:18:00Z");
const OPENS = "2026-11-14T23:00:00.000Z"; // midnight in Lagos, Sunday 15 Nov
const LAUNCH = { id: "q9", kind: "DAILY", status: "SCHEDULED", startsAt: OPENS, endsAt: "2026-11-22T23:00:00.000Z", text: "How do you feel about Nigeria right now?", hint: "Say it in your voice.", voiceCount: 0, voicesCount: 0, answerCount: 0, category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], proposalCount: 0, iSaved: false };
const TOPIC = { id: "t1", weekNumber: 1, title: "Are You Really Fine? You Dey Okay?", questionCount: 10, status: "SCHEDULED", startsOn: "2026-11-16", endsOn: "2026-11-22", weeklyPollId: "p1", reportId: null, voiceCount: 0, voicesCount: 0 };

describe("V-PRELAUNCH helpers", () => {
  it("a scheduled question is not open, whatever this device's clock says; only the API's word opens it", () => {
    expect(notOpenYet({ status: "SCHEDULED", startsAt: OPENS })).toBe(true);
    expect(comingUp({ status: "SCHEDULED", startsAt: OPENS })).toBe("Opens Sunday 15 November");
    expect(comingUp({ status: "LIVE", startsAt: OPENS })).toBeUndefined();
    expect(comingUp({ status: "CLOSED", startsAt: OPENS })).toBeUndefined();
  });
  it("a topic the API calls scheduled has not begun and says when it starts, in Lagos time", () => {
    expect(topicNotStarted({ status: "SCHEDULED", startsOn: "2026-11-16" })).toBe(true);
    expect(topicNotStarted({ status: "LIVE", startsOn: "2026-11-16" })).toBe(false);
    expect(startsLabel({ startsOn: "2026-11-16" })).toBe("Starts Monday 16 November");
  });
});

describe("V-PRELAUNCH cards", () => {
  beforeEach(() => { push.mockClear(); vi.useFakeTimers({ toFake: ["Date"], now: BEFORE }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("the question card says Coming up and Opens, with no counts and no buttons", () => {
    render(<QuestionHero question="Q?" opensLabel="Opens Sunday 15 November" voices={0} closesIn="8 days" onSpeak={() => undefined} />);
    expect(screen.getByText("Coming up")).toBeTruthy();
    expect(screen.getByText("Opens Sunday 15 November")).toBeTruthy();
    expect(screen.queryByText(/so far/)).toBeNull();
    expect(screen.queryByText(/Closes in/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("the open card is as before", () => {
    render(<QuestionHero question="Q?" voices={0} closesIn="8 days" />);
    expect(screen.getByText("Today’s question")).toBeTruthy();
    expect(screen.getByText("0 voices so far")).toBeTruthy();
    for (const b of ["Speak", "Listen", "Discuss", "Vote"]) expect(screen.getByRole("button", { name: b })).toBeTruthy();
  });
  it("Topic of the week for a week that has not begun: the title, Starts Monday 16 November, no Poll open, no Join button", () => {
    const { container } = render(<WeekCard topic={TOPIC as never} questionId="q9" variant="rail" />);
    expect(screen.getByText(TOPIC.title)).toBeTruthy();
    expect(screen.getByText("Starts Monday 16 November")).toBeTruthy();
    expect(container.textContent).not.toMatch(/Poll open|Join the conversation|Week 1|10 questions/);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("Topic of the week on the phone card says the same", () => {
    const { container } = render(<WeekCard topic={TOPIC as never} questionId="q9" />);
    expect(container.textContent).toContain("Starts Monday 16 November");
    expect(container.textContent).not.toMatch(/Poll open/);
  });
  it("Topic of the week once it is live is as before", () => {
    vi.setSystemTime(Date.parse("2026-11-16T10:00:00Z"));
    const { container } = render(<WeekCard topic={{ ...TOPIC, status: "LIVE" } as never} questionId="q9" variant="rail" />);
    expect(container.textContent).toContain("Week 1 · 10 questions · Poll open");
    expect(screen.getByRole("button", { name: "Join the conversation" })).toBeTruthy();
  });
});

describe("V-PRELAUNCH screens with the API stubbed", () => {
  let home: Record<string, unknown>;
  beforeEach(() => {
    push.mockClear();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"], now: BEFORE });
    home = { topicOfWeek: TOPIC, dailyQuestion: LAUNCH, flashPoll: null, trending: [], newConversations: [], sponsored: null, greetingName: null };
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const u = String(input);
      if (u.endsWith("/home")) return json(home);
      if (u.endsWith("/questions/today") || u.endsWith("/questions/q9")) return json(LAUNCH);
      if (u.includes("/feed/trending")) return json({ items: [], nextCursor: null });
      if (u.endsWith("/config/public")) return json({ currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs: {}, tiers: [], extraVoice: [], voiceFreeSeconds: 10 });
      return json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
    }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("Home as a guest: Coming up, Opens, the topic starts Monday, no top voices box, nothing to press on the card", async () => {
    const { container } = render(<HomeScreen />);
    await screen.findByText("Coming up");
    const text = container.textContent ?? "";
    expect(text).toContain("Opens Sunday 15 November");
    expect(text).toContain("Starts Monday 16 November");
    expect(text).not.toMatch(/Today’s question|so far|Closes in|Poll open|Join the conversation|Trending answers|Top voices|No voices yet/);
    for (const b of ["Listen", "Discuss", "Vote", "Add your voice"]) expect(screen.queryByRole("button", { name: b })).toBeNull();
  });
  it("Home once it has opened, with today's top voices missing: the card is normal and still no empty box", async () => {
    vi.setSystemTime(Date.parse(OPENS) + 60_000);
    home.dailyQuestion = { ...LAUNCH, status: "LIVE" };
    home.topicOfWeek = { ...TOPIC, status: "SCHEDULED" };
    const { container } = render(<HomeScreen />);
    await screen.findByText("Today’s question");
    expect(container.textContent).toContain("0 voices so far");
    expect(container.textContent).not.toMatch(/Coming up|Trending answers|Top voices|No voices yet/);
  });
  it("the question page before it opens: the text and hint, the date, no counts, no buttons, no voices", async () => {
    const { container } = render(<QuestionScreen id="q9" />);
    await waitFor(() => expect(container.querySelector("[data-testid='q-coming-up']")).toBeTruthy());
    const text = container.textContent ?? "";
    expect(text).toContain("How do you feel about Nigeria right now?");
    expect(text).toContain("Say it in your voice.");
    expect(text).toContain("Opens Sunday 15 November");
    expect(text).not.toMatch(/so far|Closes in|No voices yet|Write instead|Speak|has closed/);
  });
  it("the landing page and /go before it opens", async () => {
    const a = render(<Landing />);
    await screen.findByText("Coming up");
    expect(a.container.textContent).toContain("Opens Sunday 15 November");
    expect(a.container.textContent).not.toMatch(/so far|Closes in/);
    expect(screen.queryByRole("button", { name: "Discuss" })).toBeNull();
    a.unmount();
    const g = render(<Go />);
    await screen.findByTestId("go-opens");
    expect(g.container.textContent).toContain("Opens Sunday 15 November");
    expect(screen.queryByTestId("go-ANGRY")).toBeNull();
  });
});
