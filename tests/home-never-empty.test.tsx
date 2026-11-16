// @vitest-environment jsdom
// Home's trending block is never empty: it draws what the Hub sends (maybe from other open questions) and names a card's question when it is not today's.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

let trending: unknown[] = [];
let today: Record<string, unknown> | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => true }));
vi.mock("@/lib/api/feed", async (orig) => ({
  ...(await orig<object>()),
  getHome: async () => ({ dailyQuestion: today, topicOfWeek: { id: "t1", weekNumber: 1, title: "Topic", questionCount: 10, status: "LIVE", startsOn: "2026-11-09", endsOn: "2026-11-22", weeklyPollId: null, reportId: null, voiceCount: 0, voicesCount: 0 }, trending, newConversations: [], trendingQuestions: [], categories: [] }),
  getMe: async () => ({ firstName: "Ada", suspended: null }),
  getTrendingQuestions: async () => ({ items: [] }),
  getPublicConfig: async () => ({ voiceFreeSeconds: 60 }),
}));
vi.mock("@/lib/api/polls", () => ({ getFlashPolls: async () => ({ items: [] }), getAdPlacement: async () => null }));
vi.mock("@/lib/api/profile", async (orig) => ({
  ...(await orig<object>()),
  listMyAnswers: async () => ({ items: [] }),
  getSettings: async () => ({ shareMyWord: true }),
  updateSettings: async () => ({}),
}));
vi.mock("@/features/entry/ui", async (orig) => ({ ...(await orig<object>()), useFinishProfile: () => undefined }));

const question = { id: "q1", kind: "DAILY", status: "LIVE", startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-30T00:00:00Z", text: "How do you feel about Nigeria right now?", hint: null, voiceCount: 5, voicesCount: 5, answerCount: 5, category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED"], proposalCount: 0, iSaved: false };

today = null;
import { HomeScreen } from "@/components/feed/HomeScreen";

const base = { id: "x", questionId: "q1", questionText: question.text, kind: "TEXT", body: "", createdAt: "2026-11-14T10:00:00Z", labels: [], likeCount: 0, iLiked: false, replyCount: 0, reactionCount: 0, reactionBreakdown: [] };
const post = (handle: string, over: Record<string, unknown> = {}) => ({ ...base, id: `a-${handle}`, body: `Body of ${handle}`, author: { id: `u-${handle}`, handle, displayName: handle, avatarUrl: null, admin: false }, ...over });
const other = { questionId: "q2", questionText: "Is fuel too dear?" };
// The Trending block is found by its heading text, never by position (the top question card is a section too).
const trendingBlock = (): HTMLElement | null => [...document.querySelectorAll("section")].find((s) => /Trending answers/.test(s.querySelector("h2")?.textContent ?? "")) as HTMLElement | undefined ?? null;
const block = () => within(trendingBlock()!);
const lines = () => [...trendingBlock()!.querySelectorAll("[data-testid=on-question]")] as HTMLAnchorElement[];

// A fixed date for the whole file, so "Closes in N days" and every age never depend on the day the test runs. Only Date is faked: waitFor keeps its real timers.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-14T12:00:00Z")); window.localStorage.clear(); window.sessionStorage.clear(); today = question; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Home trending block is never empty", () => {
  it("every card from today's question: the block is the one drawn before this change", async () => {
    trending = [post("voice1"), post("voice2")];
    render(<HomeScreen />);
    await screen.findByText("Body of voice2");
    expect(lines()).toHaveLength(0);
    const html = trendingBlock()!.outerHTML;
    expect(html).toContain("Trending answers");
    expect(html).toContain("Body of voice1");
    expect(html).toContain("Body of voice2");
    const file = "tests/fixtures/home-trending-today.html";
    // The fixture was written by the code before this change (WRITE_FIXTURE=1 in a clean worktree of origin/main 8851c92, with this same file and the fixed clock).
    if (process.env.WRITE_FIXTURE) writeFileSync(file, html);
    else expect(html).toBe(readFileSync(file, "utf8"));
    expect(block().getByText("Trending answers")).toBeTruthy();
    expect(block().getByText("Top voices on today’s question")).toBeTruthy();
    expect(block().getByText("See all")).toBeTruthy();
  });

  it("mixed cards: names the question of a card from another one, links to it, keeps the Trending heading", async () => {
    trending = [post("admin1", { ...other }), post("voice1"), post("voice2", { questionId: "q3", questionText: "Who won?" })];
    render(<HomeScreen />);
    await screen.findByText("Body of voice2");
    expect(block().queryByText("Top voices on today’s question")).toBeNull();
    expect(block().getByText("Trending answers")).toBeTruthy();
    const l = lines();
    expect(l.map((a) => a.textContent)).toEqual(["On: Is fuel too dear?", "On: Who won?"]);
    expect(l.map((a) => a.getAttribute("href"))).toEqual(["/q/q2", "/q/q3"]);
    expect(block().getAllByText("See all").length).toBe(1);
    expect(trendingBlock()!.querySelectorAll(".vx-answer").length).toBe(3);
  });

  it("today's question has 0 voices: no See all, Trending heading on desktop, the question line and its link", async () => {
    today = { ...question, voiceCount: 0, voicesCount: 0, answerCount: 0 };
    trending = [post("admin1", { ...other }), post("voice1", { ...other })];
    render(<HomeScreen />);
    await screen.findByText("Body of voice1");
    expect(block().queryByText("See all")).toBeNull();
    expect(block().queryByText("Top voices on today’s question")).toBeNull();
    expect(block().getByText("Trending answers")).toBeTruthy();
    expect(lines()).toHaveLength(2);
    expect(lines()[0].getAttribute("href")).toBe("/q/q2");
  });

  it("an empty list: the block is not drawn", async () => {
    trending = [];
    render(<HomeScreen />);
    await screen.findByText(/Nigeria right now/);
    expect(trendingBlock()).toBeNull();
    expect(screen.queryByText("Trending answers")).toBeNull();
    expect(screen.queryByText("See all")).toBeNull();
  });
});
