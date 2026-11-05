// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("@/features/news/served", () => ({ SERVED: { likes: true, reactions: true, replies: true, clipPlay: true, photoUpload: true, tagFollows: true, me: true } }));
import { NewsCard } from "@/features/news/NewsCard";
import type { NewsAnswer } from "@/lib/api/news";

const base: NewsAnswer = {
  id: "a1", questionId: "q1", author: { id: "u", handle: "chidi.e", displayName: "Chidi Eze", state: "Lagos", avatarUrl: null }, kind: "TEXT", body: "Fuel queues are back.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: { tag: "UNVERIFIED_NEWS", sourceName: null, sourceUrl: null, chosenBy: "@chidi.e", chosenAt: new Date().toISOString() },
  likeCount: 412, replyCount: 58, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], categoryName: "Money",
};

let calls: { url: string; method: string; headers: Headers }[];
let fail = false;
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

beforeEach(() => {
  calls = [];
  fail = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers) });
    if (fail) return json({ error: { code: "INTERNAL", message: "no" } }, 500);
    if (url.endsWith("/like")) return json({ answerId: "a1", iLiked: init.method === "PUT", likeCount: init.method === "PUT" ? 413 : 412 });
    if (url.endsWith("/reaction")) return json({ answerId: "a1", myReaction: "WELL_SAID", reactionCount: 1, reactionBreakdown: [{ kind: "WELL_SAID", count: 1 }] });
    return json({}, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("NewsCard", () => {
  it("likes as a guest with an X-Guest-Id and no token, and shows no React button", async () => {
    const user = userEvent.setup();
    render(<NewsCard post={base} signedIn={false} repliesHref="/news/a1" />);
    expect(screen.queryByRole("button", { name: "React" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Like, 412 likes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Like, 413 likes" })).toBeTruthy());
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].headers.get("X-Guest-Id")).toMatch(/[0-9a-f-]{36}/);
    expect(calls[0].headers.get("Authorization")).toBeNull();
  });

  it("puts the like back and says so when the server fails", async () => {
    fail = true;
    const user = userEvent.setup();
    render(<NewsCard post={base} signedIn={false} repliesHref="/news/a1" />);
    await user.click(screen.getByRole("button", { name: "Like, 412 likes" }));
    expect(await screen.findByText("Could not save your like. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Like, 412 likes" })).toBeTruthy();
  });

  it("signed in: sets one reaction with an Idempotency-Key", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
    const user = userEvent.setup();
    render(<NewsCard post={base} signedIn repliesHref="/news/a1" />);
    await user.click(screen.getByRole("button", { name: "React" }));
    await user.click(screen.getByRole("radio", { name: /Well said/ }));
    await waitFor(() => expect(screen.getByText("1 reactions")).toBeTruthy());
    const r = calls.find((c) => c.url.endsWith("/reaction"));
    expect(r?.method).toBe("PUT");
    expect(r?.headers.get("Idempotency-Key")).toBeTruthy();
  });

  it("links replies to the post and draws no share button until the share sheet exists", () => {
    render(<NewsCard post={base} signedIn repliesHref="/news/a1" />);
    expect(screen.getByRole("link", { name: "Replies, 58" }).getAttribute("href")).toBe("/news/a1");
    expect(screen.queryByRole("button", { name: /share/i })).toBeNull();
    expect(screen.getByText("Money")).toBeTruthy();
  });
});
