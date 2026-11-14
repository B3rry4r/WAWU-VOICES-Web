// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AnswerCard, Avatar } from "@/components/vx";
import { answerCardProps } from "@/lib/feed-format";
import type { Answer } from "@/lib/api/feed";

afterEach(cleanup);

const PIC = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const answer = (author: unknown): Answer =>
  ({ id: "a1", kind: "TEXT", body: "Hello", createdAt: "2026-11-14T10:00:00Z", labels: [], likeCount: 0, iLiked: false, replyCount: 0, reactionCount: 0, reactionBreakdown: [], author }) as unknown as Answer;

describe("a person's picture on a post", () => {
  it("answerCardProps passes the author's picture and the card draws it", () => {
    const p = answerCardProps(answer({ handle: "ada", displayName: "Ada", avatarUrl: PIC, state: "Lagos" }));
    expect(p.author.avatar).toBe(PIC);
    const { container } = render(<AnswerCard {...p} />);
    const img = container.querySelector(".vx-avatar img");
    expect(img?.getAttribute("src")).toBe(PIC);
    expect(img?.getAttribute("loading")).toBe("lazy");
  });
  it("shows initials when the author has no picture", () => {
    const p = answerCardProps(answer({ handle: "ada", displayName: "Ada", avatarUrl: null }));
    const { container } = render(<AnswerCard {...p} />);
    expect(container.querySelector(".vx-avatar img")).toBeNull();
    expect(container.querySelector(".vx-avatar")?.textContent).toBeTruthy();
  });
  it("falls back to initials when the image fails, in the same circle", () => {
    const { container } = render(<Avatar name="Ada Obi" src="https://img.example/broken.png" />);
    const circle = container.querySelector(".vx-avatar");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".vx-avatar")).toBe(circle);
    expect(circle?.textContent).toBe("AO");
  });
  it("a post with no name draws no picture", () => {
    const p = answerCardProps(answer(null));
    expect(p.author).toEqual({ name: "Anonymous" });
    const { container } = render(<AnswerCard {...p} />);
    expect(container.querySelector(".vx-avatar img")).toBeNull();
  });
});
