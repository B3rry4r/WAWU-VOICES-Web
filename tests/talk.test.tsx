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
      if (c.url.endsWith("/me/allowance")) return json(allowance(0));
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
      if (c.url.endsWith("/me/allowance")) return json(allowance(0));
      if (c.method === "POST") return err(402, "INSUFFICIENT_UNITS");
      return undefined;
    });
    await writeAnswer("Hello");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/units/out-of-posts?question=q1"));
  });

  it("a successful post goes to Posted once, with a key, and clears the typed draft", async () => {
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/me/allowance")) return json(allowance(7));
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
      if (c.url.endsWith("/me/allowance")) return json(allowance(7));
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

const voice = (id: string, clip: string) => answer({ id, kind: "VOICE", body: null, clip: { id: clip, status: "READY", durationMs: 8000, maxDurationMs: 10000, peaks: [], transcript: null } as never });
const playUrl = (c: Call) => (c.url.includes("/voice-clips/") && c.url.endsWith("/play") ? json({ url: `https://cdn.test/${c.url.split("/voice-clips/")[1].split("/")[0]}.webm`, expiresAt: new Date(Date.now() + 600000).toISOString(), mime: "audio/webm" }) : undefined);

describe("TalkCard: like and voices", () => {
  it("two fast taps on Like send one request, and the next tap after it settles sends the opposite", async () => {
    let liked = false;
    stub((c) => {
      if (!c.url.endsWith("/answers/a1/like")) return undefined;
      return new Promise<Response>((r) => setTimeout(() => { liked = c.method === "PUT"; r(json({ answerId: "a1", iLiked: liked, likeCount: liked ? 4 : 3 })); }, 150)) as never;
    });
    // fetch stub must return a promise of Response
    const f = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const orig = f.getMockImplementation()!;
    f.mockImplementation(async (u: string, i?: RequestInit) => (await (orig(u, i) as Promise<Response> | Response)) as Response);
    render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    const btn = () => screen.getByRole("button", { name: /^Like,/ });
    await userEvent.click(btn());
    await new Promise((r) => setTimeout(r, 60));
    await userEvent.click(btn());
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/like")).length).toBe(1));
    await waitFor(() => expect(btn().getAttribute("aria-pressed")).toBe("true"));
    await new Promise((r) => setTimeout(r, 200));
    await userEvent.click(btn());
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").length).toBe(1));
    expect(calls.filter((c) => c.method === "PUT").length).toBe(1);
  });

  it("a voice whose URL cannot be fetched puts the button back and says so", async () => {
    const push2 = vi.fn();
    stub((c) => (c.url.endsWith("/play") ? err(404, "NOT_FOUND") : undefined));
    render(<TalkCard answer={voice("a1", "c1")} signedIn push={push2} />);
    await userEvent.click(screen.getByRole("button", { name: /^Play voice/ }));
    await waitFor(() => expect(push2).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /^Play voice/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Pause voice/ })).toBeNull();
  });

  it("starting one voice stops the other and resets its button", async () => {
    const plays: string[] = [];
    const pauses: string[] = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { plays.push(this.src); return Promise.resolve(); });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { pauses.push(this.src); });
    stub((c) => playUrl(c));
    render(<><TalkCard answer={voice("a1", "c1")} signedIn push={vi.fn()} /><TalkCard answer={voice("a2", "c2")} signedIn push={vi.fn()} /></>);
    const play = () => screen.getAllByRole("button", { name: /^(Play|Pause) voice/ });
    await userEvent.click(play()[0]);
    await waitFor(() => expect(plays.length).toBe(1));
    await userEvent.click(play()[1]);
    await waitFor(() => expect(plays.length).toBe(2));
    expect(pauses.some((s) => s.includes("c1.webm"))).toBe(true);
    expect(play()[0].getAttribute("aria-label")).toMatch(/^Play voice/);
    expect(play()[1].getAttribute("aria-label")).toMatch(/^Pause voice/);
    vi.restoreAllMocks();
  });

  it("an expired signed URL is asked for again once", async () => {
    let n = 0;
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => (n++ === 0 ? Promise.reject(new Error("403")) : Promise.resolve()));
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    stub((c) => playUrl(c));
    const push2 = vi.fn();
    render(<TalkCard answer={voice("a1", "c1")} signedIn push={push2} />);
    await userEvent.click(screen.getByRole("button", { name: /^Play voice/ }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/play")).length).toBe(2));
    expect(push2).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("the out-of-reactions message uses the server's price and never a typed one", async () => {
    const push2 = vi.fn();
    stub((c) => (c.method === "PUT" ? json({ error: { code: "INSUFFICIENT_UNITS", message: "x", requestId: "r", details: { costMilli: 250, balanceMilli: 0 } } }, 402) : undefined));
    render(<TalkCard answer={answer()} signedIn push={push2} />);
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("radio", { name: /Funny/ }));
    await waitFor(() => expect(push2).toHaveBeenCalled());
    const t = String(push2.mock.calls[0][0]);
    expect(t).toMatch(/0\.[23] unit/);
    expect(t).not.toMatch(/0\.1/);
  });
});

describe("Write: keys and double sends", () => {
  it("returning with a held draft reuses its Idempotency-Key", async () => {
    window.localStorage.setItem("voices-held-drafts", JSON.stringify({ q1: { questionId: "q1", body: "Held words", key: "held-key-1", savedAt: 1, awaitingUnits: false } }));
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/me/allowance")) return json(allowance(5));
      if (c.method === "POST") return json({ answer: answer({ id: "n1" }), charge: { costMilli: 0, usedFreePost: true, usedFreeDaily: false, balanceMilli: 0 }, allowances: allowance(4) }, 201);
      return undefined;
    });
    await writeAnswer("Held words");
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.headers.get("Idempotency-Key")).toBe("held-key-1");
  });

  it("a double click on Post sends once", async () => {
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/me/allowance")) return json(allowance(5));
      if (c.method === "POST") return json({ answer: answer({ id: "n1" }), charge: { costMilli: 0, usedFreePost: true, usedFreeDaily: false, balanceMilli: 0 }, allowances: allowance(4) }, 201);
      return undefined;
    });
    render(<WriteScreen qid="q1" />);
    await userEvent.type(await screen.findByRole("textbox"), "Once");
    await userEvent.dblClick(screen.getByRole("button", { name: /^Post/ }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("the length limit comes from the API", async () => {
    stub((c) => {
      if (c.url.endsWith("/questions/q1")) return json(question);
      if (c.url.endsWith("/me/allowance")) return json({ ...allowance(5), costs: { ...allowance(5).costs, textMaxChars: 120 } });
      return undefined;
    });
    render(<WriteScreen qid="q1" />);
    expect((await screen.findByRole("textbox")).getAttribute("maxlength")).toBe("120");
  });
});

import { ThreadScreen } from "@/features/talk/ThreadScreen";
describe("Thread: closed question and anonymous voices", () => {
  const thread = (status: string, author: unknown) => stub((c) => {
    if (c.url.endsWith("/questions/q1")) return json({ ...question, status });
    if (c.url.endsWith("/answers/a1")) return json(answer({ author: author as never }));
    if (c.url.includes("/answers/a1/replies")) return json({ items: [], nextCursor: null, counts: { agree: 0, disagree: 0, experience: 0 } });
    if (c.url.endsWith("/me/allowance")) return json(allowance(5));
    return undefined;
  });
  it("hides the reply bar and stance chips when the question is closed", async () => {
    thread("CLOSED", answer().author);
    render(<ThreadScreen qid="q1" aid="a1" />);
    expect(await screen.findByText("This question has closed.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "How are you replying?" })).toBeNull();
    expect(screen.queryByText(/in words/)).toBeNull();
  });
  it("shows the reply bar when it is open, and says Anonymous without an author", async () => {
    thread("LIVE", null);
    render(<ThreadScreen qid="q1" aid="a1" />);
    expect(await screen.findByText("Reply to Anonymous in words")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/this voice\b.*@|@this voice/);
    expect(document.body.textContent).toMatch(/replies to Anonymous/);
  });
});

describe("TalkCard: reactions under latency end equal to the database", () => {
  it("Sad then Funny at 400 ms ends with FUNNY on screen and in the database", async () => {
    let db: string | null = null;
    const puts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (!String(url).endsWith("/answers/a1/reaction")) return new Response("{}", { status: 404 });
      await new Promise((r) => setTimeout(r, 400));
      if (init?.method === "PUT") { db = JSON.parse(String(init.body)).kind; puts.push(db!); } else db = null;
      return json({ answerId: "a1", myReaction: db, reactionCount: db ? 1 : 0, reactionBreakdown: [], charge: { costMilli: 0, usedFreePost: false, usedFreeDaily: true, balanceMilli: 0 } });
    }));
    render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("radio", { name: /Sad/ }));
    await userEvent.click(screen.getByRole("button", { name: /Your reaction: Sad/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Funny/ }));
    await waitFor(() => expect(db).toBe("FUNNY"), { timeout: 3000 });
    expect(puts).toEqual(["SAD", "FUNNY"]);
    expect(screen.getByRole("button", { name: /Your reaction: Funny/ })).toBeTruthy();
  });

  it("tapping the same reaction twice quickly ends with no reaction", async () => {
    let db: string | null = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", headers: new Headers(init?.headers) });
      await new Promise((r) => setTimeout(r, 200));
      if (init?.method === "PUT") db = JSON.parse(String(init.body)).kind; else db = null;
      return json({ answerId: "a1", myReaction: db, reactionCount: 0, reactionBreakdown: [] });
    }));
    render(<TalkCard answer={answer()} signedIn push={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("radio", { name: /Funny/ }));
    await userEvent.click(screen.getByRole("button", { name: /Your reaction: Funny/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Funny/ }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").length).toBe(1), { timeout: 3000 });
    await waitFor(() => expect(db).toBeNull(), { timeout: 3000 });
    expect(screen.getByRole("button", { name: "React" })).toBeTruthy();
  });
});

import { unitsText } from "@/features/talk/lib";
describe("unitsText", () => {
  it("says 0 units, 0.5 unit, 1 unit, 12.5 units", () => {
    expect(unitsText(0)).toBe("0 units");
    expect(unitsText(500)).toBe("0.5 unit");
    expect(unitsText(1000)).toBe("1 unit");
    expect(unitsText(12500)).toBe("12.5 units");
  });
});
