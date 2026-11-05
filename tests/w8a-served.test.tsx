// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NewsCard } from "@/features/news/NewsCard";
import { SERVED } from "@/features/news/served";
import type { NewsAnswer } from "@/lib/api/news";

afterEach(cleanup);

const post = {
  id: "a1", questionId: "q1", author: null, kind: "VOICE", body: null,
  clip: { id: "c1", status: "READY", durationMs: 24000, maxDurationMs: 30000, peaks: null, transcript: { status: "READY", language: "en", text: "They said fuel would come down." } },
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 5, replyCount: 2, agreeCount: 0, disagreeCount: 0, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], categoryName: null,
} as NewsAnswer;

describe("controls whose route main does not serve yet", () => {
  it("are off by default", () => {
    expect(Object.values(SERVED).every((v) => v === false)).toBe(true);
  });
  it("draw no like, react, reply or play control, only the counts and the transcript", () => {
    render(<NewsCard post={post} signedIn repliesHref="/news/a1" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("They said fuel would come down.")).toBeTruthy();
    expect(screen.getByLabelText("5 likes")).toBeTruthy();
    expect(screen.getByText("Anonymous")).toBeTruthy();
  });
});
