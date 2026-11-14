// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/features/news/served", () => ({ SERVED: { likes: true, reactions: true, replies: true, clipPlay: true, photoUpload: true, tagFollows: true, me: true } }));
import { NewsCard } from "@/features/news/NewsCard";
import { ProposalCard } from "@/components/vx";
import type { NewsAnswer } from "@/lib/api/news";

afterEach(cleanup);
const base = {
  id: "a1", questionId: "q1", author: { id: "u", handle: "chidi.e", displayName: "Chidi", state: "Lagos", avatarUrl: null }, kind: "TEXT", body: "Fuel.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: { tag: "UNVERIFIED_NEWS", sourceName: null, sourceUrl: null, chosenBy: "@chidi.e", chosenAt: new Date().toISOString() },
  likeCount: 1, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], categoryName: null,
} as unknown as NewsAnswer;
const withAuthor = (x: object) => ({ ...base, author: { ...base.author, ...x } }) as unknown as NewsAnswer;

describe("Admin pill and tick on the news list and What Next", () => {
  it("news card: pill for admin true, tick for verified, neither for a plain author, none when nameless", () => {
    render(<NewsCard post={withAuthor({ admin: true, verified: true })} signedIn={false} repliesHref="/n" />);
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByLabelText("Verified")).toBeTruthy();
    cleanup();
    render(<NewsCard post={withAuthor({ admin: false, verified: false })} signedIn={false} repliesHref="/n" />);
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByLabelText("Verified")).toBeNull();
    cleanup();
    render(<NewsCard post={{ ...base, author: null } as unknown as NewsAnswer} signedIn={false} repliesHref="/n" />);
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.getByText("Anonymous")).toBeTruthy();
  });
  it("proposal card shows the pill only for admin true", () => {
    render(<ProposalCard author="@a" time="1h" text="x" admin verified />);
    expect(screen.getByText("Admin")).toBeTruthy();
    cleanup();
    render(<ProposalCard author="@a" time="1h" text="x" />);
    expect(screen.queryByText("Admin")).toBeNull();
  });
});
