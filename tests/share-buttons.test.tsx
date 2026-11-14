// @vitest-environment jsdom
// The Share button on the Home question card (open, answered, coming up) and in the pick-one-word screen's top bar.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
let signed = true;
let answeredToday = false;
let question: Record<string, unknown> = {};
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/features/share", () => ({
  ShareSheet: (p: { objectType: string; objectId: string; notOpen?: boolean }) => (
    <div role="dialog" aria-label="Share sheet" data-type={p.objectType} data-id={p.objectId} data-notopen={String(!!p.notOpen)}>Share sheet</div>
  ),
}));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => signed }));
vi.mock("@/lib/api/feed", async (orig) => ({
  ...(await orig<object>()),
  getHome: async () => ({ dailyQuestion: question, topicOfWeek: { id: "t1", weekNumber: 1, title: "Topic", questionCount: 10, status: "LIVE", startsOn: "2026-11-09", endsOn: "2026-11-22", weeklyPollId: null, reportId: null, voiceCount: 0, voicesCount: 0 }, trending: [], newConversations: [], trendingQuestions: [], categories: [] }),
  getMe: async () => ({ firstName: "Ada", suspended: null }),
  getTrendingQuestions: async () => ({ items: [] }),
  getPublicConfig: async () => ({ voiceFreeSeconds: 60 }),
}));
vi.mock("@/lib/api/polls", () => ({ getFlashPolls: async () => ({ items: [] }), getAdPlacement: async () => null }));
vi.mock("@/lib/api/profile", async (orig) => ({
  ...(await orig<object>()),
  listMyAnswers: async () => ({ items: answeredToday ? [{ answer: { questionId: "q1" } }] : [] }),
  getSettings: async () => ({ shareMyWord: true }),
  updateSettings: async () => ({}),
}));
vi.mock("@/lib/api/talk", async (orig) => ({ ...(await orig<object>()), getQuestion: async () => question }));
vi.mock("@/features/entry/ui", async (orig) => ({ ...(await orig<object>()), useFinishProfile: () => undefined }));

import { HomeScreen } from "@/components/feed/HomeScreen";
import { MoodPickScreen } from "@/features/mood/MoodPickScreen";

const OPEN = { id: "q1", kind: "DAILY", status: "LIVE", startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-30T00:00:00Z", text: "How do you feel about Nigeria right now?", hint: null, voiceCount: 5, voicesCount: 5, answerCount: 5, category: null, recentVoices: [], moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], proposalCount: 0, iSaved: false };

beforeEach(() => { push.mockReset(); signed = true; answeredToday = false; question = OPEN; window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => cleanup());

describe("Home question card Share", () => {
  it("open question: Share sits with Listen, Discuss and Vote and opens the QUESTION sheet without notOpen", async () => {
    render(<HomeScreen />);
    const share = await screen.findByRole("button", { name: "Share" });
    for (const b of ["Speak", "Listen", "Discuss", "Vote"]) expect(screen.getByRole("button", { name: b })).toBeTruthy();
    await userEvent.click(share);
    const d = await screen.findByRole("dialog", { name: "Share sheet" });
    expect(d.getAttribute("data-type")).toBe("QUESTION");
    expect(d.getAttribute("data-id")).toBe("q1");
    expect(d.getAttribute("data-notopen")).toBe("false");
  });
  it("Speak, Listen, Discuss and Vote still go where they went", async () => {
    render(<HomeScreen />);
    await screen.findByRole("button", { name: "Share" });
    await userEvent.click(screen.getByRole("button", { name: "Speak" }));
    await userEvent.click(screen.getByRole("button", { name: "Listen" }));
    await userEvent.click(screen.getByRole("button", { name: "Discuss" }));
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(push.mock.calls.map((c) => c[0])).toEqual(["/speak", "/q/q1", "/q/q1", "/q/q1"]);
  });
  it("answered: Share is still there", async () => {
    answeredToday = true;
    render(<HomeScreen />);
    expect(await screen.findByRole("button", { name: "Share" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
  });
  it("guest: Share opens the sheet", async () => {
    signed = false;
    render(<HomeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Share" }));
    expect((await screen.findByRole("dialog", { name: "Share sheet" })).getAttribute("data-type")).toBe("QUESTION");
  });
  it("coming up: one Share, still notOpen", async () => {
    question = { ...OPEN, status: "SCHEDULED", startsAt: "2099-01-01T00:00:00Z" };
    render(<HomeScreen />);
    const all = await screen.findAllByRole("button", { name: "Share" });
    expect(all).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Listen" })).toBeNull();
    await userEvent.click(all[0]);
    expect((await screen.findByRole("dialog", { name: "Share sheet" })).getAttribute("data-notopen")).toBe("true");
  });
});

describe("pick-one-word screen Share", () => {
  it("the bar has Share this question and it opens the QUESTION sheet", async () => {
    render(<MoodPickScreen qid="q1" />);
    await screen.findByTestId("mood-ANGRY");
    await userEvent.click(screen.getByRole("button", { name: "Share this question" }));
    const d = await waitFor(() => screen.getByRole("dialog", { name: "Share sheet" }));
    expect(d.getAttribute("data-type")).toBe("QUESTION");
    expect(d.getAttribute("data-id")).toBe("q1");
  });
});
