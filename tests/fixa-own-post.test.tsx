// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { TalkCard } from "@/features/talk/TalkCard";
import type { Answer } from "@/lib/api/talk";

const answer = (over: Partial<Answer> = {}): Answer => ({
  id: "a1", questionId: "q1", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: null, avatarUrl: null }, kind: "TEXT", body: "Two hours.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], ...over,
}) as Answer;

beforeEach(() => { window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function menu(a: Answer) {
  render(<TalkCard answer={a} signedIn push={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /^More:/ }));
}

describe("V-FIX-A: Edit and Delete follow the API's own isMine flag", () => {
  it("my anonymous answer (author null) offers Edit and Delete, not Report", async () => {
    await menu(answer({ author: null, isMine: true }));
    expect(screen.getByRole("button", { name: "Edit this post" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete this post" })).toBeTruthy();
    expect(screen.queryByText("Report this voice")).toBeNull();
  });
  it("someone else's anonymous answer offers only Report", async () => {
    await menu(answer({ author: null, isMine: false }));
    expect(screen.getByText("Report this voice")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit this post" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete this post" })).toBeNull();
  });
  it("a named answer by someone else offers only Report", async () => {
    await menu(answer({ isMine: false }));
    expect(screen.queryByRole("button", { name: "Delete this post" })).toBeNull();
  });
});
