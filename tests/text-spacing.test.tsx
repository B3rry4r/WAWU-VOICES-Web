// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { AnswerCard, ProposalCard } from "@/components/vx";
import { PostRow, ReplyRow } from "@/features/profile/PostRow";

vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const TEXT = "First line.\n\nSecond paragraph.\n- a\n- b";
const css = readFileSync("src/components/vx/vx.css", "utf8");
const rule = (cls: string) => css.split("\n").find((l) => l.startsWith(`.${cls} {`)) ?? "";

afterEach(cleanup);

describe("a person's own words keep the spacing they typed", () => {
  it("the css rules for the text classes say pre-wrap and still wrap long words", () => {
    for (const c of ["vx-answer__text", "vx-prop__text"]) {
      expect(rule(c)).toContain("white-space: pre-wrap");
      expect(rule(c)).toContain("overflow-wrap: anywhere");
    }
  });
  it("an answer card draws the text with its line breaks", () => {
    const { container } = render(<AnswerCard author={{ name: "Ada" } as never} time="1m" text={TEXT} />);
    const el = container.querySelector(".vx-answer__text")!;
    expect(el.textContent).toBe(TEXT);
  });
  it("a proposal card draws the text with its line breaks", () => {
    const { container } = render(<ProposalCard author="@ada" time="1m" text={TEXT} />);
    const el = container.querySelector(".vx-prop__text")!;
    expect(el.textContent).toBe(TEXT);
  });
  it("the profile post row and reply row keep the text and use the pre-wrap class", () => {
    const me = { id: "u1", handle: "me", displayName: "Me", state: null, avatarUrl: null, verified: false };
    const a = { id: "a1", questionId: "q1", author: me, kind: "TEXT", body: TEXT, clip: null, createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null };
    const r = { id: "r1", author: me, kind: "TEXT", body: TEXT, clip: null, createdAt: new Date().toISOString(), stance: "AGREE", helpfulCount: 0 };
    const one = render(<PostRow a={a as never} />);
    expect(one.container.querySelector(".vx-answer__text")!.textContent).toBe(TEXT);
    one.unmount();
    const two = render(<ReplyRow r={r as never} />);
    expect(two.container.querySelector(".vx-answer__text")!.textContent).toBe(TEXT);
  });
});
