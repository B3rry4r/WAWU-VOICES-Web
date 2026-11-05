// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlashPoll } from "@/components/feed/FlashPoll";
import type { Poll } from "@/lib/api/polls";

const poll: Poll = {
  id: "p1", kind: "FLASH", title: "Is your bank app working right now?", choiceMode: "SINGLE", status: "OPEN", publicInterest: false,
  startsAt: "2026-11-05T10:00:00Z", endsAt: "2999-01-01T00:00:00Z", questionId: null, topicId: null, totalVotes: 100, myVote: null, costToVoteMilli: 0,
  options: [{ id: "a", label: "Yes, it is fine", votes: 60 }, { id: "b", label: "Not at all", votes: 40 }],
};

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return handler(url, init); }));
  return calls;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("FlashPoll", () => {
  it("sends the vote once with an Idempotency-Key and shows the figures that come back", async () => {
    const calls = mockFetch((url) =>
      url.includes("/votes")
        ? json(201, { vote: { id: "v", pollId: "p1", optionIds: ["b"], createdAt: "x" }, results: { pollId: "p1", status: "OPEN", totalVotes: 101, options: [{ id: "a", label: "Yes, it is fine", votes: 60 }, { id: "b", label: "Not at all", votes: 41 }], leadingOptionId: "a", asOf: "x", myVote: ["b"] }, charge: {} })
        : json(404, { error: { code: "NOT_FOUND", message: "no" } }),
    );
    render(<FlashPoll poll={poll} signedIn />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("radio", { name: "Not at all" }));
    await u.click(screen.getByRole("button", { name: "Vote" }));
    await u.click(screen.getByRole("button", { name: "Confirm vote" }));
    await waitFor(() => expect(screen.getByText("101 votes")).toBeTruthy());
    const votes = calls.filter((c) => c.url.includes("/votes"));
    expect(votes).toHaveLength(1);
    expect(JSON.parse(String(votes[0].init.body))).toEqual({ optionIds: ["b"] });
    expect(new Headers(votes[0].init.headers).get("Idempotency-Key")).toBeTruthy();
    expect(new Headers(votes[0].init.headers).get("Authorization")).toBe("Bearer t");
  });

  it("a refused vote stays on the confirm step and says why", async () => {
    mockFetch((url) => (url.includes("/votes") ? json(402, { error: { code: "INSUFFICIENT_UNITS", message: "x" } }) : json(404, { error: { code: "NOT_FOUND", message: "no" } })));
    render(<FlashPoll poll={poll} signedIn />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("radio", { name: "Yes, it is fine" }));
    await u.click(screen.getByRole("button", { name: "Vote" }));
    await u.click(screen.getByRole("button", { name: "Confirm vote" }));
    await waitFor(() => expect(screen.getByText("You do not have enough Voice Units to vote on this poll.")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Confirm vote" })).toBeTruthy();
  });

  it("a guest sees the results, with no vote button", () => {
    render(<FlashPoll poll={poll} signedIn={false} />);
    expect(screen.queryByRole("button", { name: "Vote" })).toBeNull();
    expect(screen.getByText("100 votes")).toBeTruthy();
  });
});
