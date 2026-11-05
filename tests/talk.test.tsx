// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { TalkCard } from "@/features/talk/TalkCard";
import { WriteScreen } from "@/features/talk/WriteScreen";
import type { Answer } from "@/lib/api/talk";

const answer = (over: Partial<Answer> = {}): Answer => ({
  id: "a1", questionId: "q1", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: "Ibadan", avatarUrl: null }, kind: "TEXT", body: "Two hours.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 3, replyCount: 2, agreeCount: 1, disagreeCount: 1, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [],
  ...over,
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
const err = (status: number, code: string) => json({ error: { code, message: "x", requestId: "r" } }, status);

beforeEach(() => { calls = []; push.mockReset(); window.localStorage.clear(); window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("TalkCard", () => {
  it("likes through the API and sends the guest id", async () => {
    stub((c) => (c.url.endsWith("/answers/a1/like") && c.method === "PUT" ? json({ answerId: "a1", iLiked: true, likeCount: 4 }) : undefined));
    render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Like,/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.url.endsWith("/answers/a1/like"))).toBe(true));
    expect(calls[0].headers.get("X-Guest-Id")).toBeTruthy();
  });

  it("sets a reaction with an Idempotency-Key, and removes the same one", async () => {
    stub((c) => {
      if (c.url.endsWith("/answers/a1/reaction") && c.method === "PUT") return json({ answerId: "a1", myReaction: "RELATABLE", reactionCount: 1, reactionBreakdown: [{ kind: "RELATABLE", count: 1 }], charge: { costMilli: 0, usedFreePost: false, usedFreeDaily: true, balanceMilli: 0 } });
      if (c.url.endsWith("/answers/a1/reaction") && c.method === "DELETE") return json({ answerId: "a1", myReaction: null, reactionCount: 0, reactionBreakdown: [] });
      return undefined;
    });
    render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("radio", { name: /Relatable/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")).toBeTruthy());
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({ kind: "RELATABLE" });
    expect(put.headers.get("Idempotency-Key")).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: /Your reaction: Relatable/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Relatable/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });

  it("tells the person when free reactions are used up, and never shows a raw server message", async () => {
    const push2 = vi.fn();
    stub((c) => (c.method === "PUT" ? err(402, "INSUFFICIENT_UNITS") : undefined));
    render(<TalkCard answer={answer()} signedIn push={push2} />);
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("radio", { name: /Funny/ }));
    await waitFor(() => expect(push2).toHaveBeenCalled());
    expect(String(push2.mock.calls[0][0])).toMatch(/free reactions/);
    expect(String(push2.mock.calls[0][0])).not.toMatch(/—/);
  });

  it("a guest tapping React is asked to sign in and no call is made", async () => {
    const push2 = vi.fn();
    stub(() => undefined);
    render(<TalkCard answer={answer()} signedIn={false} push={push2} />);
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    expect(push2.mock.calls[0][0]).toMatch(/Sign in to react/);
    expect(calls.length).toBe(0);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("the reply button opens the thread", async () => {
    stub(() => undefined);
    render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^Reply,/ }));
    expect(push).toHaveBeenCalledWith("/q/q1/a/a1");
  });
});

const question = { id: "q1", status: "LIVE", kind: "DAILY", text: "When salary arrives?", hint: "Hour by hour.", category: null, recentVoices: [], voiceCount: 1, answerCount: 1, proposalCount: 0, hasOpenPoll: false, iSaved: false };
const allowance = (left: number) => ({ freePostsRemaining: left, balanceMilli: 0, maxVoiceSeconds: 10, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, extraVoiceTokens: [], costs: { textPostMilli: 500, voicePostMilli: 1000, baseKoboPerUnit: 1380, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 0, freeReactionsPerDay: 20, freeVotesPerDay: 3 } });

async function writeAnswer(text: string) {
  render(<WriteScreen qid="q1" />);
  const box = await screen.findByRole("textbox");
  await userEvent.type(box, text);
  await userEvent.click(screen.getByRole("button", { name: /^Post/ }));
}

describe("Write: posting spends free posts and units", () => {
  it("402 out of free posts keeps the draft and hands off to Voice Units with the same key on retry", async () => {
    let n = 0;
    stub((c) => {
      if (c.url.endsWith("/questions/q1") ) return json(question);
      if (c.url.endsWith("/wallet")) return json({ allowances: allowance(0) });
      if (c.url.endsWith("/questions/q1/answers") && c.method === "POST") { n++; return err(402, "FREE_POSTS_EXHAUSTED"); }
      return undefined;
    });
    await writeAnswer("Salary lands on the 25th.");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/units/out-of-posts?question=q1"));
    const held = JSON.parse(window.localStorage.getItem("voices-held-drafts")!).q1;
    expect(held.body).toBe("Salary lands on the 25th.");
    const first = calls.find((c) => c.method === "POST")!;
    expect(first.headers.get("Idempotency-Key")).toBe(held.key);
    expect(first.body).toEqual({ kind: "TEXT", body: "Salary lands on the 25th." });
    expect(n).toBe(1);
    expect(JSON.parse(window.localStorage.getItem("voices-typing-drafts")!)["q:q1"]).toBe("Salary lands on the 25th.");
  });

  it("INSUFFICIENT_UNITS hands off the same way", async () => {
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/wallet")) return json({ allowances: allowance(0) });
      if (c.method === "POST") return err(402, "INSUFFICIENT_UNITS");
      return undefined;
    });
    await writeAnswer("Hello");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/units/out-of-posts?question=q1"));
  });

  it("a successful post goes to Posted once, with a key, and clears the typed draft", async () => {
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/wallet")) return json({ allowances: allowance(7) });
      if (c.url.endsWith("/questions/q1/answers") && c.method === "POST") return json({ answer: answer({ id: "new1" }), charge: { costMilli: 0, usedFreePost: true, usedFreeDaily: false, balanceMilli: 0 }, allowances: allowance(6) }, 201);
      return undefined;
    });
    await writeAnswer("My take");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/posted?a=new1"));
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    expect(calls.find((c) => c.method === "POST")!.headers.get("Idempotency-Key")).toBeTruthy();
    expect(window.localStorage.getItem("voices-typing-drafts") ?? "{}").not.toContain("My take");
  });

  it("a failure other than 402 stays on the page with plain words and keeps the text", async () => {
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/wallet")) return json({ allowances: allowance(7) });
      if (c.method === "POST") return err(429, "RATE_LIMITED");
      return undefined;
    });
    await writeAnswer("Slow down");
    expect(await screen.findByText(/You are going fast/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Slow down");
  });

  it("a guest is asked to sign in and no composer shows", async () => {
    window.localStorage.clear();
    stub(() => undefined);
    render(<WriteScreen qid="q1" />);
    expect(await screen.findByText(/Sign in to post your answer/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
