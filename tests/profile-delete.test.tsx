// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiError, calls, me, mockApi, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/features/share", () => ({ ShareSheet: () => <div data-testid="share-sheet" /> }));

import { MePage } from "@/features/profile/MePage";
import { PostRow } from "@/features/profile/PostRow";
import type { Answer } from "@/lib/api/profile";

const mine = { id: "u1", handle: "ada.okafor", displayName: "Ada Okafor", state: null, avatarUrl: null };
const ans = (over: Partial<Answer>): Answer => ({
  id: "a1", questionId: "q1", questionText: "How long is your wait?", author: mine, kind: "TEXT", body: "Two hours.", clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0,
  reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], ...over,
}) as Answer;
const list = (...a: Answer[]) => ({ items: a.map((x) => ({ type: "answer", answer: x })), nextCursor: null });
const two = list(ans({ id: "a1", body: "Two hours." }), ans({ id: "a2", body: "Nobody knows.", author: null }));

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const dots = () => screen.getAllByRole("button", { name: /^More:/ });

describe("Delete and edit from my own Profile", () => {
  it("shows the three dots on my rows and not on another person's row", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": two, "GET /me/saved": { items: [], nextCursor: null } });
    render(<MePage />);
    await screen.findByText("Two hours.");
    expect(dots()).toHaveLength(2);
    cleanup();
    render(<PostRow a={ans({ isMine: false, author: { ...mine, id: "u9", handle: "tunde.a" } })} />);
    expect(screen.queryByRole("button", { name: /^More:/ })).toBeNull();
  });

  it("Delete confirms, calls deleteAnswer once, removes the row and lowers the counts", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": two, "GET /me/saved": { items: [], nextCursor: null }, "DELETE /answers/a1": null });
    render(<MePage />);
    await screen.findByText("Two hours.");
    expect(screen.getByRole("tab", { name: /My voices/ }).textContent).toMatch(/48/);
    await userEvent.click(dots()[0]);
    await userEvent.click(screen.getByRole("button", { name: "Delete this post" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete voice" }));
    await waitFor(() => expect(screen.queryByText("Two hours.")).toBeNull());
    expect(calls.filter((c) => c.method === "DELETE" && c.path === "/answers/a1")).toHaveLength(1);
    expect(screen.getByText("Your post is deleted.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /My voices/ }).textContent).toMatch(/47/);
    expect(screen.getByText("Nobody knows.")).toBeTruthy();
  });

  it("a failed delete keeps the row, says why, and can be tried again", async () => {
    signIn();
    let fail = true;
    mockApi({ "GET /me": me, "GET /me/answers": two, "GET /me/saved": { items: [], nextCursor: null }, "DELETE /answers/a1": () => (fail ? apiError(500, "INTERNAL", "Something broke.") : null) });
    render(<MePage />);
    await screen.findByText("Two hours.");
    await userEvent.click(dots()[0]);
    await userEvent.click(screen.getByRole("button", { name: "Delete this post" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete voice" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Delete voice" })).toBeNull());
    expect(screen.getByText("Two hours.")).toBeTruthy();
    expect(screen.queryByText("Your post is deleted.")).toBeNull();
    expect(screen.getByRole("tab", { name: /My voices/ }).textContent).toMatch(/48/);
    fail = false;
    await userEvent.click(dots()[0]);
    await userEvent.click(screen.getByRole("button", { name: "Delete this post" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete voice" }));
    await waitFor(() => expect(screen.queryByText("Two hours.")).toBeNull());
  });

  it("Edit saves and shows the new text with its line breaks", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": two, "GET /me/saved": { items: [], nextCursor: null }, "PATCH /answers/a1": (i: { body: unknown }) => ans({ id: "a1", body: (i.body as { body: string }).body, editedAt: new Date().toISOString() }) });
    render(<MePage />);
    await screen.findByText("Two hours.");
    await userEvent.click(dots()[0]);
    await userEvent.click(screen.getByRole("button", { name: "Edit this post" }));
    const box = screen.getByLabelText("Your words");
    await userEvent.clear(box);
    await userEvent.type(box, "Three hours.{Enter}Really.");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const p = await screen.findByText(/Three hours\./);
    expect(p.textContent).toBe("Three hours.\nReally.");
    expect(p.className).toContain("whitespace-pre-line");
    expect(screen.queryByText("Two hours.")).toBeNull();
  });

  it("a post without my name can be deleted the same way", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": two, "GET /me/saved": { items: [], nextCursor: null }, "DELETE /answers/a2": null });
    render(<MePage />);
    const row = (await screen.findByText("Nobody knows.")).closest(".pf-post") as HTMLElement;
    expect(within(row).getByTestId("anon-tag")).toBeTruthy();
    await userEvent.click(within(row).getByRole("button", { name: /^More:/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete this post" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete voice" }));
    await waitFor(() => expect(screen.queryByText("Nobody knows.")).toBeNull());
    expect(calls.filter((c) => c.method === "DELETE" && c.path === "/answers/a2")).toHaveLength(1);
  });
});
