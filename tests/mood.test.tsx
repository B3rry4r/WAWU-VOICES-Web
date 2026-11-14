// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { MoodPickScreen } from "@/features/mood/MoodPickScreen";
import { MoodFilter, MoodSplit } from "@/features/mood/MoodSplit";
import { CardNameSwitch, WhereYouSitCard } from "@/features/mood/WhereYouSitCard";
import { readPick } from "@/features/mood/mood";
import { hidesTabBar } from "@/components/shell/nav";
import { TalkCard } from "@/features/talk/TalkCard";
import { WriteScreen } from "@/features/talk/WriteScreen";
import type { Answer, Question } from "@/lib/api/talk";
import type { WhereYouSit } from "@/lib/api/mood";

const WORDS = ["ANGRY", "TIRED", "PROUD", "HOPEFUL"];
const question = (over: Partial<Question> = {}): Question => ({
  id: "q1", kind: "DAILY", status: "LIVE", text: "How do you feel about Nigeria right now?", hint: "With everything going on, say it in your voice. 10 seconds.",
  moodOptions: WORDS, category: null, topicId: null, scheduledFor: null, startsAt: null, endsAt: null, pinned: false, sensitive: false, voiceCount: 0, answerCount: 0,
  hasOpenPoll: false, proposalCount: 0, iSaved: false, recentVoices: [], ...over,
}) as Question;
const answer = (over: Partial<Answer> = {}): Answer => ({
  id: "a1", questionId: "q1", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: "Ibadan", avatarUrl: null }, kind: "TEXT", body: "Hopeful, because the young ones build.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 3, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], mood: "HOPEFUL", ...over,
}) as Answer;

type Call = { url: string; method: string; headers: Headers; body?: unknown };
let calls: Call[] = [];
function stub(routes: (c: Call) => Response | undefined) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return routes(c) ?? new Response("{}", { status: 404 });
  }));
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

beforeEach(() => {
  calls = []; push.mockReset(); replace.mockReset(); search = "";
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("the pick screen (LCH-02)", () => {
  const routes = (c: Call) => {
    if (c.url.endsWith("/questions/q1")) return json(question());
    if (c.url.endsWith("/config/public")) return json({ voiceFreeSeconds: 10 });
    return undefined;
  };

  it("shows the four words, none pressed, and asks for one before going on", async () => {
    stub(routes);
    render(<MoodPickScreen qid="q1" />);
    expect(await screen.findByRole("heading", { name: "How do you feel about Nigeria right now?" })).toBeTruthy();
    for (const w of WORDS) expect(screen.getByRole("button", { name: new RegExp(w) }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByText("Say it in 10 seconds"));
    expect(screen.getByRole("alert").textContent).toBe("Pick one word first.");
    expect(push).not.toHaveBeenCalled();
  });

  it("presses one word, lets it change, and carries the last one to Record or Write", async () => {
    stub(routes);
    render(<MoodPickScreen qid="q1" />);
    await screen.findByTestId("mood-ANGRY");
    await userEvent.click(screen.getByTestId("mood-HOPEFUL"));
    expect(screen.getByTestId("mood-HOPEFUL").getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByTestId("mood-ANGRY"));
    expect(screen.getByTestId("mood-ANGRY").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("mood-HOPEFUL").getAttribute("aria-pressed")).toBe("false");
    expect(readPick("q1")).toBe("ANGRY");
    await userEvent.click(screen.getByText("Say it in 10 seconds"));
    expect(push).toHaveBeenLastCalledWith("/q/q1/speak?mood=ANGRY");
    await userEvent.click(screen.getByText("Type it instead"));
    expect(push).toHaveBeenLastCalledWith("/q/q1/write?mood=ANGRY");
  });

  it("remembers the word when the person comes back to change it", async () => {
    window.localStorage.setItem("voices-mood-pick", JSON.stringify({ q1: "TIRED" }));
    stub(routes);
    render(<MoodPickScreen qid="q1" />);
    await waitFor(() => expect(screen.getByTestId("mood-TIRED").getAttribute("aria-pressed")).toBe("true"));
  });
});

describe("the shell", () => {
  it("hides the tab bar on the pick screen, as on every full-screen task", () => {
    expect(hidesTabBar("/q/abc/mood")).toBe(true);
    expect(hidesTabBar("/q/abc")).toBe(false);
  });
});

describe("writing on a mood question", () => {
  const routes = (c: Call) => {
    if (c.url.endsWith("/questions/q1")) return json(question());
    if (c.url.endsWith("/me/allowance")) return json({ freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 10, costs: { textPostMilli: 1000, voicePostMilli: 1000, baseKoboPerUnit: 100, textMaxChars: 500 }, freeReactionsLeftToday: 20 });
    if (c.url.endsWith("/questions/q1/answers") && c.method === "POST") return json({ answer: answer({ id: "new1" }), charge: {}, allowances: {} }, 201);
    return undefined;
  };

  it("sends a person with no word to the pick screen", async () => {
    stub(routes);
    render(<WriteScreen qid="q1" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/q/q1/mood"));
  });

  it("posts the word with the answer, shows it with a way to change it, and forgets it after posting", async () => {
    search = "mood=HOPEFUL";
    stub(routes);
    render(<WriteScreen qid="q1" />);
    const note = await screen.findByTestId("mood-word-note");
    expect(within(note).getByTestId("mood-chip").textContent).toBe("HOPEFUL");
    expect(within(note).getByRole("link", { name: "Change" }).getAttribute("href")).toBe("/q/q1/mood");
    await userEvent.type(screen.getByRole("textbox"), "Hopeful, because the young ones build.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/questions/q1/answers"))).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ kind: "TEXT", mood: "HOPEFUL" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/posted?a=new1"));
    expect(readPick("q1")).toBeNull();
  });

  it("sends no word on an ordinary question", async () => {
    stub((c) => (c.url.endsWith("/questions/q1") ? json(question({ moodOptions: [] })) : routes(c)));
    render(<WriteScreen qid="q1" />);
    await userEvent.type(await screen.findByRole("textbox"), "Salary goes in two hours.");
    await userEvent.click(screen.getByRole("button", { name: /^(Post|Send)/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect((calls.find((c) => c.method === "POST")!.body as Record<string, unknown>).mood).toBeUndefined();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("the word beside an answer", () => {
  it("shows the word above a mood answer and nothing on an ordinary one", () => {
    stub(() => undefined);
    const { rerender } = render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    expect(screen.getByTestId("mood-chip").textContent).toBe("HOPEFUL");
    rerender(<TalkCard answer={answer({ mood: null })} signedIn push={vi.fn()} />);
    expect(screen.queryByTestId("mood-chip")).toBeNull();
  });
});

describe("how Nigeria feels so far", () => {
  it("draws the bar and the legend from the stored counts, and says nothing before anyone answered", async () => {
    stub((c) => (c.url.endsWith("/questions/q1/moods")
      ? json({ questionId: "q1", total: 100, updatedAt: new Date().toISOString(), items: [{ mood: "ANGRY", count: 31, percent: 31 }, { mood: "TIRED", count: 24, percent: 24 }, { mood: "PROUD", count: 7, percent: 7 }, { mood: "HOPEFUL", count: 38, percent: 38 }] })
      : undefined));
    render(<MoodSplit qid="q1" />);
    expect(await screen.findByRole("heading", { name: "How Nigeria feels so far" })).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Angry 31 percent, Tired 24 percent, Proud 7 percent, Hopeful 38 percent");
    expect(screen.getByText("Hopeful 38%")).toBeTruthy();
    cleanup();
    stub(() => json({ questionId: "q1", total: 0, updatedAt: new Date().toISOString(), items: [] }));
    render(<MoodSplit qid="q1" />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(1));
    expect(screen.queryByTestId("mood-split")).toBeNull();
  });

  it("filters by word, and All clears it", async () => {
    const on = vi.fn();
    render(<MoodFilter value={null} onChange={on} />);
    await userEvent.click(screen.getByRole("button", { name: "Angry" }));
    expect(on).toHaveBeenLastCalledWith("ANGRY");
    cleanup();
    render(<MoodFilter value="ANGRY" onChange={on} />);
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(on).toHaveBeenLastCalledWith(null);
  });
});

describe("where you sit (LCH-04)", () => {
  const sit = (over: Partial<WhereYouSit> = {}): WhereYouSit => ({
    answerId: "a1", questionId: "q1", mood: "HOPEFUL", showNameOnCard: false,
    nigeria: { percent: 38, voices: 120 }, world: { percent: 33, voices: 400 }, defaultScope: "NIGERIA", showSwitch: true,
    line: "You’re with the 38% who feel HOPEFUL.", cardLine: "You’re with the 38% who feel hopeful.", updatedAt: new Date().toISOString(), ...over,
  });

  it("shows the percentage with a Nigeria and World switch from 50 on", async () => {
    render(<WhereYouSitCard sit={sit()} />);
    expect(screen.getByRole("heading", { name: "You’re with the 38% who feel HOPEFUL." })).toBeTruthy();
    expect(screen.getByTestId("sit-percent").textContent).toBe("38%");
    expect(screen.getByRole("button", { name: "Nigeria" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "World" }));
    expect(screen.getByTestId("sit-percent").textContent).toBe("33%");
    expect(screen.getByRole("heading", { name: "You’re with the 33% who feel HOPEFUL." })).toBeTruthy();
  });

  it("before 50: no number, no switch, the plain line and the reason", () => {
    render(<WhereYouSitCard sit={sit({ nigeria: { percent: null, voices: null }, world: { percent: null, voices: null }, showSwitch: false, defaultScope: "WORLD", line: "You’re one of the first.", cardLine: "You’re one of the first." })} />);
    expect(screen.getByRole("heading", { name: "You’re one of the first." })).toBeTruthy();
    expect(screen.queryByTestId("sit-percent")).toBeNull();
    expect(screen.queryByRole("button", { name: "World" })).toBeNull();
    expect(screen.getByText("When 50 people have answered, you will see where you sit, in Nigeria and the world.")).toBeTruthy();
  });

  it("a group under 50 says one of the first even when the other has a number", async () => {
    render(<WhereYouSitCard sit={sit({ nigeria: { percent: null, voices: null }, defaultScope: "WORLD" })} />);
    expect(screen.getByTestId("sit-percent").textContent).toBe("33%");
    await userEvent.click(screen.getByRole("button", { name: "Nigeria" }));
    expect(screen.queryByTestId("sit-percent")).toBeNull();
    expect(screen.getByRole("heading", { name: "You’re one of the first." })).toBeTruthy();
  });

  it("the name switch is off unless on, and reports a tap", async () => {
    const on = vi.fn();
    render(<CardNameSwitch on={false} busy={false} onChange={on} />);
    const sw = screen.getByRole("switch", { name: "Show my name on the card" }) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    await userEvent.click(sw);
    expect(on).toHaveBeenCalledWith(true);
  });
});
