// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { costLines, PollCard } from "@/features/vote/PollCard";
import { stageHref } from "@/features/stage/StageNav";
import { pickPoll } from "@/features/vote/poll-pick";
import { unitsText } from "@/features/vote/chrome";
import { updatedAgo, ProposalItem } from "@/features/vote/WhatNextPage";
import { ResultsPage, RESULTS_POLL_MS } from "@/features/vote/ResultsPage";
import { ProposePage } from "@/features/vote/ProposePage";
import type { Allowances, Poll, VoteReceipt } from "@/lib/api/vote";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
let calls: { url: string; method: string; headers: Headers; body: string | null }[];
let routes: (url: string, init: RequestInit) => Response | null;

beforeEach(() => {
  calls = []; push.mockClear(); replace.mockClear(); routes = () => null;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers), body: (init.body as string) ?? null });
    return routes(url, init) ?? json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); window.localStorage.clear(); });

const poll = (over: Partial<Poll> = {}): Poll => ({
  id: "p1", kind: "WEEKLY", title: "What should every employer do?", choiceMode: "SINGLE", status: "OPEN", publicInterest: false,
  startsAt: "2026-11-01T00:00:00Z", endsAt: new Date(Date.now() + 2 * 86400000).toISOString(), questionId: null, topicId: null, totalVotes: 0,
  options: [{ id: "a", label: "Pay on time" }, { id: "b", label: "Pay a bonus" }], myVote: null, costToVoteMilli: 0, label: "Open poll", ...over,
});
const allowance = (over: Partial<Allowances> = {}): Allowances => ({
  freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 10, freeReactionsLeftToday: 20, freeVotesLeftToday: 3,
  costs: { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 1380, textPostMilli: 500, voicePostMilli: 1000, reactionAfterFreeMilli: 100, voteAfterFreeMilli: 200, minPackKobo: 13800, extraVoice30Kobo: 15000, extraVoice60Kobo: 20000, textMaxChars: 500, freeVoiceSeconds: 10 },
  extraVoiceTokens: [], ...over,
});
const receipt = (cost = 0): VoteReceipt => ({
  vote: { id: "v1", pollId: "p1", optionIds: ["a"], createdAt: "2026-11-05T10:00:00Z" },
  results: { pollId: "p1", status: "OPEN", totalVotes: 1, options: [{ id: "a", label: "Pay on time", votes: 1, percent: 100 }, { id: "b", label: "Pay a bonus", votes: 0, percent: 0 }], leadingOptionId: "a", asOf: "2026-11-05T10:00:00Z", myVote: ["a"] },
  charge: { costMilli: cost, usedFreePost: false, usedFreeDaily: cost === 0, balanceMilli: 4000 },
});

async function pickAndConfirm() {
  const u = userEvent.setup();
  await u.click(screen.getByRole("radio", { name: /Pay on time/ }));
  await u.click(screen.getByRole("button", { name: "Vote" }));
  await u.click(screen.getByRole("button", { name: /Confirm vote/ }));
}

describe("helpers", () => {
  it("says units and stages", () => {
    expect(unitsText(200)).toBe("0.2 units");
    expect(unitsText(0)).toBe("0 units");
    expect(unitsText(1000)).toBe("1 unit");
    expect(unitsText(12500)).toBe("12.5 units");
    expect(stageHref("q1", "vote")).toBe("/q/q1/vote");
    expect(stageHref("q1", "next")).toBe("/q/q1/next");
    expect(updatedAgo("2026-11-05T10:00:00Z", Date.parse("2026-11-05T12:00:00Z"))).toBe("2 hours ago");
  });
  it("picks the open poll first, then the latest closed", () => {
    const closed = poll({ id: "c1", status: "CLOSED" });
    expect(pickPoll([closed, poll({ id: "o1" })])?.id).toBe("o1");
    expect(pickPoll([closed])?.id).toBe("c1");
  });
  it("reads the cost line from the allowance and config, never from the page", () => {
    expect(costLines(poll(), allowance(), null).confirm).toBe("Free: you have 3 free votes left today. After that a vote uses 0.2 units.");
    expect(costLines(poll({ costToVoteMilli: 200 }), allowance({ freeVotesLeftToday: 0, balanceMilli: 0 }), null).confirm).toBe("This vote uses 0.2 units. You have 0 units.");
    expect(costLines(poll({ publicInterest: true }), allowance(), null).confirm).toContain("always free");
  });
});

describe("PollCard: the vote flow", () => {
  it("casts one vote with an Idempotency-Key and shows the bars", async () => {
    routes = (url, init) => (url.endsWith("/polls/p1/votes") && init.method === "POST" ? json(receipt(), 201) : null);
    const onVoted = vi.fn();
    render(<PollCard poll={poll()} signedIn allowance={allowance()} config={null} onVoted={onVoted} />);
    await pickAndConfirm();
    await waitFor(() => expect(onVoted).toHaveBeenCalled());
    const c = calls.filter((x) => x.method === "POST");
    expect(c).toHaveLength(1);
    expect(c[0].headers.get("Idempotency-Key")).toBeTruthy();
    expect(c[0].headers.get("Authorization")).toBe("Bearer tok");
    expect(JSON.parse(c[0].body ?? "{}")).toEqual({ optionIds: ["a"] });
    expect((await screen.findAllByText("1 vote")).length).toBeGreaterThan(0);
  });

  it("402: a paid vote that is refused shows the error, never a result, and nothing is charged", async () => {
    routes = (url, init) => (url.endsWith("/votes") && init.method === "POST" ? json({ error: { code: "INSUFFICIENT_UNITS", message: "You need 0.2 unit to vote.", details: { costMilli: 200, balanceMilli: 0, minPackKobo: 13800 } } }, 402) : null);
    const onVoted = vi.fn();
    render(<PollCard poll={poll({ costToVoteMilli: 200 })} signedIn allowance={allowance({ freeVotesLeftToday: 0 })} config={null} onVoted={onVoted} />);
    await pickAndConfirm();
    expect(await screen.findByText("Your vote did not count")).toBeTruthy();
    expect(screen.getByText(/Nothing was charged/)).toBeTruthy();
    expect(onVoted).not.toHaveBeenCalled();
    expect(screen.queryByText(/votes$/)).toBeNull();
    expect(screen.getByRole("button", { name: /Confirm vote/ })).toBeTruthy();
  });

  it("402 shows the API's own message and that nothing was charged", async () => {
    routes = (url, init) => (url.endsWith("/votes") && init.method === "POST" ? json({ error: { code: "INSUFFICIENT_UNITS", message: "You need 0.2 unit to vote." } }, 402) : null);
    render(<PollCard poll={poll({ costToVoteMilli: 200 })} signedIn allowance={allowance({ freeVotesLeftToday: 0 })} config={null} />);
    await pickAndConfirm();
    expect(await screen.findByText("You need 0.2 unit to vote. Nothing was charged.")).toBeTruthy();
  });

  it("409 REQUEST_IN_PROGRESS says the vote is still being sent and keeps the key", async () => {
    let n = 0;
    routes = (url, init) => (url.endsWith("/votes") && init.method === "POST" ? (++n === 1 ? json({ error: { code: "REQUEST_IN_PROGRESS", message: "busy" } }, 409) : json(receipt(), 201)) : null);
    render(<PollCard poll={poll()} signedIn allowance={allowance()} config={null} />);
    await pickAndConfirm();
    expect(await screen.findByText("Your vote is still being sent")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: /Confirm vote/ }));
    await waitFor(() => expect(calls.filter((x) => x.method === "POST")).toHaveLength(2));
    const keys = calls.filter((x) => x.method === "POST").map((x) => x.headers.get("Idempotency-Key"));
    expect(keys[0]).toBe(keys[1]);
  });

  it("402 then a retry uses a fresh key (the first answer was final)", async () => {
    let n = 0;
    routes = (url, init) => (url.endsWith("/votes") && init.method === "POST" ? (++n === 1 ? json({ error: { code: "INSUFFICIENT_UNITS", message: "x" } }, 402) : json(receipt(200), 201)) : null);
    render(<PollCard poll={poll({ costToVoteMilli: 200 })} signedIn allowance={allowance({ freeVotesLeftToday: 0 })} config={null} />);
    await pickAndConfirm();
    await screen.findByText("Your vote did not count");
    await userEvent.setup().click(screen.getByRole("button", { name: /Confirm vote/ }));
    await waitFor(() => expect(calls.filter((x) => x.method === "POST")).toHaveLength(2));
    const keys = calls.filter((x) => x.method === "POST").map((x) => x.headers.get("Idempotency-Key"));
    expect(keys[0]).not.toBe(keys[1]);
    expect(await screen.findByText("Vote counted")).toBeTruthy();
  });

  it("network failure keeps the same key so the retry cannot charge twice", async () => {
    let n = 0;
    routes = (url, init) => { if (url.endsWith("/votes") && init.method === "POST") { if (++n === 1) throw new TypeError("offline"); return json(receipt(), 201); } return null; };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers), body: (init.body as string) ?? null });
      return routes(url, init) ?? json({}, 404);
    }));
    render(<PollCard poll={poll()} signedIn allowance={allowance()} config={null} />);
    await pickAndConfirm();
    expect(await screen.findByText("We could not confirm your vote")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: /Confirm vote/ }));
    await waitFor(() => expect(calls.filter((x) => x.method === "POST")).toHaveLength(2));
    const keys = calls.filter((x) => x.method === "POST").map((x) => x.headers.get("Idempotency-Key"));
    expect(keys[0]).toBe(keys[1]);
  });

  it("409 ALREADY_VOTED shows the already-voted state from the server", async () => {
    routes = (url, init) => {
      if (url.endsWith("/votes") && init.method === "POST") return json({ error: { code: "ALREADY_VOTED", message: "You have already voted in this poll." } }, 409);
      if (url.endsWith("/polls/p1")) return json(poll({ myVote: ["b"], totalVotes: 3, options: [{ id: "a", label: "Pay on time", votes: 2 }, { id: "b", label: "Pay a bonus", votes: 1 }] }));
      return null;
    };
    const onChanged = vi.fn();
    render(<PollCard poll={poll()} signedIn allowance={allowance()} config={null} onChanged={onChanged} />);
    await pickAndConfirm();
    expect(await screen.findByText("You have already voted")).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  it("a guest is asked to sign in and no request is sent", async () => {
    render(<PollCard poll={poll()} signedIn={false} allowance={null} config={null} />);
    await pickAndConfirm();
    expect(await screen.findByText("Sign in to vote")).toBeTruthy();
    expect(calls.filter((x) => x.method === "POST")).toHaveLength(0);
  });
});

describe("Results: live by polling", () => {
  it("reads the results again every few seconds while the poll is open", async () => {
    let hits = 0;
    const res = () => ({ pollId: "p1", status: "OPEN", totalVotes: 1 + hits, options: [{ id: "a", label: "Pay on time", votes: 1 + hits }, { id: "b", label: "Pay a bonus", votes: 0 }], leadingOptionId: "a", asOf: "x", myVote: ["a"] });
    routes = (url) => {
      if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "Q?", voiceCount: 0, answerCount: 0, proposalCount: 0, weekNumber: 4, topicTitle: null });
      if (url.endsWith("/questions/q1/polls")) return json({ items: [poll({ myVote: ["a"], totalVotes: 1 })] });
      if (url.endsWith("/polls/p1/results")) { hits += 1; return json(res()); }
      if (url.includes("/ads/placement")) return json({ ad: null });
      return null;
    };
    render(<ResultsPage questionId="q1" />);
    await screen.findByText("Explain my vote");
    const before = hits;
    await act(async () => { await new Promise((r) => setTimeout(r, RESULTS_POLL_MS + 400)); });
    expect(hits).toBeGreaterThan(before);
  }, 15000);

  it("a poll that closes while the page is open shows the closed banner and stops polling", async () => {
    let hits = 0;
    routes = (url) => {
      if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "Q?", voiceCount: 0, answerCount: 0, proposalCount: 0, weekNumber: 4, topicTitle: null });
      if (url.endsWith("/questions/q1/polls")) return json({ items: [poll({ myVote: ["a"], totalVotes: 1 })] });
      if (url.endsWith("/polls/p1/results")) {
        hits += 1;
        return json({ pollId: "p1", status: hits >= 2 ? "CLOSED" : "OPEN", totalVotes: 1, options: [{ id: "a", label: "Pay on time", votes: 1 }, { id: "b", label: "Pay a bonus", votes: 0 }], leadingOptionId: "a", asOf: "x", myVote: ["a"] });
      }
      if (url.includes("/ads/placement")) return json({ ad: null });
      if (url.includes("/feed/trending-questions")) return json({ items: [], nextCursor: null });
      return null;
    };
    render(<ResultsPage questionId="q1" />);
    await screen.findByText("Explain my vote");
    expect(screen.queryByText("This poll has closed")).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, RESULTS_POLL_MS + 400)); });
    expect(await screen.findByText("This poll has closed")).toBeTruthy();
    const seen = hits;
    await act(async () => { await new Promise((r) => setTimeout(r, RESULTS_POLL_MS + 400)); });
    expect(hits).toBe(seen);
  }, 20000);

  it("hidden results (403) show Vote to see the results", async () => {
    routes = (url) => {
      if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "Q?", voiceCount: 0, answerCount: 0, proposalCount: 0 });
      if (url.endsWith("/questions/q1/polls")) return json({ items: [poll()] });
      if (url.endsWith("/polls/p1/results")) return json({ error: { code: "FORBIDDEN", message: "no" } }, 403);
      return null;
    };
    render(<ResultsPage questionId="q1" />);
    expect(await screen.findByText("Vote to see the results")).toBeTruthy();
  });
});

describe("Proposals", () => {
  const prop = { id: "pr1", questionId: "q1", author: { id: "u", handle: "bola.k", displayName: "Bola Kareem" }, kind: "TEXT" as const, body: "Put the salary date in every letter.", clip: null, label: "PROPOSED" as const, supportCount: 3, challengeCount: 1, improveCount: 0, groupId: null, improvesId: null, myStance: null, createdAt: new Date().toISOString(), isMine: false };

  it("Support sends the stance and redraws from the answer", async () => {
    routes = (url, init) => (url.endsWith("/proposals/pr1/stance") && init.method === "PUT" ? json({ ...prop, supportCount: 4, myStance: "SUPPORT" }) : null);
    render(<ProposalItem p={prop} groups={new Map()} signedIn questionId="q1" onNeedSignIn={() => undefined} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Support/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(JSON.parse(calls.find((c) => c.method === "PUT")?.body ?? "{}")).toEqual({ kind: "SUPPORT" });
    await waitFor(() => expect(screen.getByRole("button", { name: /Support/ }).textContent).toContain("4"));
  });

  it("a guest tapping Support is asked to sign in and nothing is sent", async () => {
    const need = vi.fn();
    render(<ProposalItem p={prop} groups={new Map()} signedIn={false} questionId="q1" onNeedSignIn={need} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Support/ }));
    expect(need).toHaveBeenCalled();
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("Propose: a similar proposal is offered before posting, then the post carries a key and goes to What Next?", async () => {
    routes = (url, init) => {
      if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "What would help?", voiceCount: 0, answerCount: 0, proposalCount: 1 });
      if (url.endsWith("/config/public")) return json({ costs: { textMaxChars: 500 } });
      if (url.includes("/proposals/similar")) return json({ items: [prop] });
      if (url.endsWith("/questions/q1/proposals") && init.method === "POST") return json({ proposal: prop, charge: { costMilli: 0, usedFreePost: false, usedFreeDaily: false, balanceMilli: 0 }, similar: [] }, 201);
      return null;
    };
    render(<ProposePage questionId="q1" />);
    const u = userEvent.setup();
    const ta = await screen.findByPlaceholderText("Who should do what, and by when?");
    await u.type(ta, "Put the salary date in every offer letter");
    expect(await screen.findByText("This looks like a proposal already here", {}, { timeout: 3000 })).toBeTruthy();
    expect(calls.find((c) => c.url.includes("/similar"))?.url).toContain("text=");
    await u.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/next"));
    const post = calls.find((c) => c.method === "POST" && c.url.endsWith("/proposals"));
    expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
    expect(JSON.parse(post?.body ?? "{}")).toEqual({ kind: "TEXT", body: "Put the salary date in every offer letter" });
  }, 15000);

  it("Propose: Post checks again when the text moved on since the last check, and a match stops that tap", async () => {
    let similar = 0;
    routes = (url, init) => {
      if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "What would help?", voiceCount: 0, answerCount: 0, proposalCount: 1 });
      if (url.endsWith("/config/public")) return json({ costs: { textMaxChars: 500 } });
      if (url.includes("/proposals/similar")) { similar += 1; return json({ items: [prop] }); }
      if (url.includes("/feed/trending-questions")) return json({ items: [], nextCursor: null });
      if (init.method === "POST") return json({ proposal: prop, charge: { costMilli: 0, usedFreePost: false, usedFreeDaily: false, balanceMilli: 0 }, similar: [] }, 201);
      return null;
    };
    render(<ProposePage questionId="q1" />);
    const u = userEvent.setup();
    await u.type(await screen.findByPlaceholderText("Who should do what, and by when?"), "Put the salary date in every offer letter");
    await u.click(screen.getByRole("button", { name: "Post" })); // before the 600 ms check has run
    await waitFor(() => expect(similar).toBeGreaterThan(0));
    expect(await screen.findByText("This looks like a proposal already here")).toBeTruthy();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    await u.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/next"));
  }, 15000);

  it("Propose: a 429 shows the drawn slow-down message and does not leave the page", async () => {
    routes = (url, init) => {
      if (url.endsWith("/questions/q1")) return json({ id: "q1", topicId: null, text: "What would help?", voiceCount: 0, answerCount: 0, proposalCount: 0 });
      if (url.endsWith("/config/public")) return json({ costs: { textMaxChars: 500 } });
      if (url.includes("/similar")) return json({ items: [] });
      if (init.method === "POST") return json({ error: { code: "RATE_LIMITED", message: "Slow down." } }, 429);
      return null;
    };
    render(<ProposePage questionId="q1" />);
    const u = userEvent.setup();
    await u.type(await screen.findByPlaceholderText("Who should do what, and by when?"), "Pay on the 25th");
    await u.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByText("Slow down a moment")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
