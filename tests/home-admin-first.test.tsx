// @vitest-environment jsdom
// Home draws the "Trending answers" list the Hub sends, in the Hub's order, up to 5 (admin posts first, then the top voices).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let trending: unknown[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => true }));
vi.mock("@/lib/api/feed", async (orig) => ({
  ...(await orig<object>()),
  getHome: async () => ({ dailyQuestion: question, topicOfWeek: { id: "t1", weekNumber: 1, title: "Topic", questionCount: 10, status: "LIVE", startsOn: "2026-11-09", endsOn: "2026-11-22", weeklyPollId: null, reportId: null, voiceCount: 0, voicesCount: 0 }, trending, newConversations: [], trendingQuestions: [], categories: [] }),
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

import { HomeScreen } from "@/components/feed/HomeScreen";

const post = (handle: string, admin: boolean) => ({
  id: `a-${handle}`, questionId: "q1", questionText: question.text, kind: "TEXT", body: `Body of ${handle}`, createdAt: "2026-11-14T10:00:00Z",
  labels: [], likeCount: 0, iLiked: false, replyCount: 0, reactionCount: 0, reactionBreakdown: [],
  author: { id: `u-${handle}`, handle, displayName: handle, avatarUrl: null, admin },
});
const set = (n: number) => Array.from({ length: n }, (_, i) => (i < 3 ? post(`admin${i + 1}`, true) : post(`voice${i - 2}`, false)));
const handlesDrawn = () => [...document.querySelectorAll(".vx-answer__name")].map((e) => (e.textContent ?? "").replace(/Admin$/, "").replace(/^@/, ""));

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => cleanup());

describe("Home trending answers, admin posts first", () => {
  it("draws 5 in the Hub's order: 3 admin posts, then 2 voices", async () => {
    trending = set(5);
    render(<HomeScreen />);
    await screen.findByText("Body of voice2");
    expect(handlesDrawn()).toEqual(["admin1", "admin2", "admin3", "voice1", "voice2"]);
  });
  it("draws 2 when the Hub sends 2", async () => {
    trending = [post("voice1", false), post("voice2", false)];
    render(<HomeScreen />);
    await screen.findByText("Body of voice2");
    expect(handlesDrawn()).toEqual(["voice1", "voice2"]);
  });
  it("draws only the first 5 of 7", async () => {
    trending = set(7);
    render(<HomeScreen />);
    await screen.findByText("Body of voice2");
    expect(handlesDrawn()).toEqual(["admin1", "admin2", "admin3", "voice1", "voice2"]);
    expect(screen.queryByText("Body of voice3")).toBeNull();
  });
  it("draws no Trending answers section with none", async () => {
    trending = [];
    render(<HomeScreen />);
    await screen.findByText(/Nigeria right now/);
    expect(screen.queryByText("Trending answers")).toBeNull();
  });
});
