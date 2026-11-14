// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { Answers } from "@/components/feed/parts";
import type { Answer } from "@/lib/api/feed";

const voice = (extra: Record<string, unknown> = {}): Answer => ({
  id: "a1", questionId: "q9", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: "Ibadan", avatarUrl: null }, kind: "TEXT", body: "Some words here",
  clip: null, createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 3, replyCount: 2, agreeCount: 1, disagreeCount: 1, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], ...extra,
}) as unknown as Answer;

beforeEach(() => { push.mockReset(); window.localStorage.clear(); vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.getSelection()?.removeAllRanges(); });

describe("C23: list cards", () => {
  it("the mood chip keeps to its word: it does not stretch across the grid", () => {
    render(<Answers items={[voice({ mood: "HOPEFUL" })]} />);
    const chip = screen.getByTestId("mood-chip");
    expect(chip.className).toContain("justify-self-start");
    expect(chip.className).toContain("inline-flex");
    expect((chip.parentElement as HTMLElement).className).toContain("gap-[6px]");
  });
  it("a click that ends a text selection does not open the question; a plain tap still does", () => {
    render(<Answers items={[voice()]} />);
    const text = screen.getByText("Some words here");
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.click(text);
    expect(push).not.toHaveBeenCalled();
    window.getSelection()!.removeAllRanges();
    fireEvent.click(text);
    expect(push).toHaveBeenCalledWith("/q/q9");
  });
  it("the keyboard link names the question when the answer has one", () => {
    render(<Answers items={[voice({ questionText: "How do you feel about Nigeria?" })]} />);
    expect(screen.getByRole("link", { name: "Open the conversation: How do you feel about Nigeria?" })).toBeTruthy();
  });
  it("without question text the link keeps the short name", () => {
    render(<Answers items={[voice()]} />);
    expect(screen.getByRole("link", { name: "Open the conversation" })).toBeTruthy();
  });
});
