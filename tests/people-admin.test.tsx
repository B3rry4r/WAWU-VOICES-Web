// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AnswerCard } from "@/components/vx";
import { answerCardProps } from "@/lib/feed-format";
import type { Answer } from "@/lib/api/feed";

afterEach(cleanup);

const answer = (author: unknown): Answer =>
  ({ id: "a1", kind: "TEXT", body: "Hello", createdAt: "2026-11-14T10:00:00Z", labels: [], likeCount: 0, iLiked: false, replyCount: 0, reactionCount: 0, reactionBreakdown: [], author }) as unknown as Answer;
const draw = (author: unknown) => render(<AnswerCard {...answerCardProps(answer(author))} />).container;

describe("the Admin pill", () => {
  it("shows after the name only when admin is true", () => {
    expect(draw({ handle: "ada", displayName: "Ada", avatarUrl: null, admin: true }).querySelector(".vx-answer__name")?.textContent).toBe("@adaAdmin");
    cleanup();
    expect(draw({ handle: "ada", displayName: "Ada", avatarUrl: null, admin: false }).textContent).not.toContain("Admin");
    cleanup();
    expect(draw({ handle: "ada", displayName: "Ada", avatarUrl: null }).textContent).not.toContain("Admin");
    cleanup();
    expect(draw({ handle: "ada", displayName: "Ada", avatarUrl: null, admin: "true" }).textContent).not.toContain("Admin");
  });
  it("never shows on a post without a name", () => {
    expect(draw(null).textContent).not.toContain("Admin");
    cleanup();
    const props = { ...answerCardProps(answer(null)), author: { name: "Anonymous", admin: true } };
    expect(render(<AnswerCard {...props} />).container.textContent).not.toContain("Admin");
  });
  it("keeps the name in its own truncating span and the three dots beside it", () => {
    const c = draw({ handle: "a_very_long_handle_for_a_person_with_a_tick", displayName: "x", avatarUrl: null, admin: true });
    const name = c.querySelector(".vx-answer__name")!;
    expect(name.firstElementChild?.className).toBe("vx-answer__nm");
    expect(name.querySelector(".vx-badge")?.textContent).toBe("Admin");
    expect(c.querySelector('.vx-answer__head button[aria-label^="More"]')).not.toBeNull();
  });
});
