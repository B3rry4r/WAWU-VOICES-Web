// @vitest-environment jsdom
// C22: on the lists drawn by Answers (Home, Category, Search) every control of a voice card does what it does on the conversation page.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/features/share", () => ({ ShareSheet: () => <div role="dialog" aria-label="Share sheet">Share sheet</div> }));

import { Answers } from "@/components/feed/parts";
import type { Answer } from "@/lib/api/feed";

const voice = (id = "a1"): Answer => ({
  id, questionId: "q9", author: { id: "u1", handle: "tunde.a", displayName: "Tunde", state: "Ibadan", avatarUrl: null }, kind: "VOICE", body: null,
  clip: { id: "c1", status: "READY", durationMs: 8000, maxDurationMs: 10000, peaks: [], transcript: null },
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 3, replyCount: 2, agreeCount: 1, disagreeCount: 1, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [],
}) as unknown as Answer;

// The three screens draw the list this way: Home (two cards), Category (one or two), Search (unfolded).
const LISTS: [string, () => React.ReactElement][] = [
  ["Home", () => <Answers items={[voice()]} />],
  ["Category", () => <Answers items={[voice()]} />],
  ["Search", () => <Answers items={[voice()]} unfolded />],
];

beforeEach(() => {
  push.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe.each(LISTS)("%s list: controls on a voice card", (_name, list) => {
  it("the three dots open the This voice sheet and do not navigate", async () => {
    render(list());
    await userEvent.click(screen.getByRole("button", { name: /^More/ }));
    expect(await screen.findByText("This voice")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("Share opens the share sheet and does not navigate", async () => {
    render(list());
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("dialog", { name: "Share sheet" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("Like, React, Play and speed do not navigate", async () => {
    render(list());
    await userEvent.click(screen.getByRole("button", { name: /^Like,/ }));
    await userEvent.click(screen.getByRole("button", { name: "React" }));
    await userEvent.click(screen.getByRole("button", { name: /^Play voice/ }));
    const speed = screen.queryByRole("button", { name: /^Playback speed/ });
    if (speed) await userEvent.click(speed);
    expect(push).not.toHaveBeenCalled();
  });

  it("a tap on the card body opens the conversation once", async () => {
    render(list());
    await userEvent.click(screen.getByRole("article"));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/q/q9");
  });

  it("a button inside the open More sheet does not open the question", async () => {
    render(list());
    await userEvent.click(screen.getByRole("button", { name: /^More/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Copy link" }));
    expect(push).not.toHaveBeenCalledWith("/q/q9");
    expect(push).not.toHaveBeenCalled();
  });

  it("Reply opens the thread, not the question page", async () => {
    render(list());
    await userEvent.click(screen.getByRole("button", { name: /^Reply,/ }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/q/q9/a/a1");
  });

  it("has no button inside a link", () => {
    const { container } = render(list());
    expect(container.querySelector("a button, a [role=button]")).toBeNull();
  });
});

describe("Answers: a card TalkCard hides leaves nothing clickable", () => {
  it("a blocked author leaves no frame and no link behind", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })));
    // the block list is module-wide, so this card has its own author
    const b = voice("b1");
    b.author = { ...b.author!, id: "u-blocked" };
    const { container } = render(<Answers items={[b]} />);
    await userEvent.click(screen.getByRole("button", { name: /^More/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Block @tunde.a" }));
    await waitFor(() => expect(screen.queryByRole("article")).toBeNull());
    expect(container.querySelector("a, .cursor-pointer")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("a guest sees the sign-in toast on React, once on the screen", async () => {
    window.localStorage.clear();
    render(<Answers items={[voice("a1"), voice("a2")]} />);
    await userEvent.click(screen.getAllByRole("button", { name: "React" })[0]);
    await waitFor(() => expect(screen.getAllByText(/Sign in to react/).length).toBe(1));
    expect(push).not.toHaveBeenCalled();
  });
});
