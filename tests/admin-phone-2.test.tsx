// @vitest-environment jsdom
// V-ADMIN-PHONE-2: the Profile fixes (post names, refused delete, focus after delete, no Report on myself) and the admin class guards.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiError, calls, me, mockApi, profile, signIn } from "./w6-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { MePage } from "@/features/profile/MePage";
import { PersonPage } from "@/features/profile/PersonPage";

beforeEach(() => { window.localStorage.clear(); calls.length = 0; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ans = (id: string, body: string) => ({
  id, questionId: "q1", author: { id: "u1", handle: "ada.okafor", displayName: "Ada", state: null, avatarUrl: null }, kind: "TEXT", body, clip: null,
  createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0,
  reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [],
});
const mine = { items: [ans("a1", "First post about the road"), ans("a2", "Second post about power"), ans("a3", "Third post about food")].map((answer) => ({ type: "answer", answer })), nextCursor: null };
const saved = { items: [], nextCursor: null };

async function openDelete(index: number) {
  await userEvent.click((await screen.findAllByRole("button", { name: /^More: edit, delete, copy link/ }))[index]);
  await userEvent.click(await screen.findByRole("button", { name: "Delete this post" }));
  await userEvent.click(await screen.findByRole("button", { name: "Delete voice" }));
}

describe("Profile: my posts", () => {
  it("each three-dot button has its own name and keeps 'edit, delete, copy link'", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": mine, "GET /me/saved": saved });
    render(<MePage />);
    const names = (await screen.findAllByRole("button", { name: /^More: edit, delete, copy link/ })).map((b) => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(3);
    expect(names[0]).toContain("First post about the road");
    expect(names[1]).toContain("Second post about power");
  });

  it("a refused delete shows the server's own words and the row stays", async () => {
    signIn();
    mockApi({ "GET /me": me, "GET /me/answers": mine, "GET /me/saved": saved, "DELETE /answers/a1": () => apiError(409, "CONFLICT", "This post is part of an open report, so it cannot be deleted yet.") });
    render(<MePage />);
    await openDelete(0);
    expect(await screen.findByText("This post is part of an open report, so it cannot be deleted yet.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^More: edit, delete, copy link/ })).toHaveLength(3);
  });

  it("a refused delete with no words from the server shows the plain line", async () => {
    signIn();
    mockApi({ "GET /me": me, "GET /me/answers": mine, "GET /me/saved": saved, "DELETE /answers/a1": () => new Response("", { status: 500 }) });
    render(<MePage />);
    await openDelete(0);
    expect(await screen.findByText("Something went wrong on our side. Try again in a moment.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^More: edit, delete, copy link/ })).toHaveLength(3);
  });

  it("after a delete, focus goes to the next row's three dots", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": mine, "GET /me/saved": saved, "DELETE /answers/a1": null });
    render(<MePage />);
    await openDelete(0);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^More: edit, delete, copy link/ })).toHaveLength(2));
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toContain("Second post about power"));
  });

  it("after deleting the last row, focus goes to the list heading, not the page body", async () => {
    signIn(); mockApi({ "GET /me": me, "GET /me/answers": mine, "GET /me/saved": saved, "DELETE /answers/a3": null });
    render(<MePage />);
    await openDelete(2);
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^More: edit, delete, copy link/ })).toHaveLength(2));
    await waitFor(() => expect(document.activeElement?.tagName).toBe("H2"));
  });
});

describe("A person's page opened for my own account", () => {
  const ID = "00000000-0000-4000-8000-000000000001";
  it("offers no Report and no Block on myself", async () => {
    signIn(); mockApi({ ["GET /people/" + ID]: { profile: { ...profile, id: "u1" }, isBlockedByMe: false, recentAnswers: [], nextCursor: null }, "GET /me": me });
    render(<PersonPage segment={ID} />);
    await screen.findByText("@ada.okafor", {}, { timeout: 3000 }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole("button", { name: /More: report or block/ })).toBeNull();
  });
  it("still offers them on someone else", async () => {
    signIn(); mockApi({ ["GET /people/" + ID]: { profile: { ...profile, id: "u2", handle: "tunde.a" }, isBlockedByMe: false, recentAnswers: [], nextCursor: null }, "GET /me": me });
    render(<PersonPage segment={ID} />);
    expect(await screen.findByRole("button", { name: "More: report or block @tunde.a" })).toBeTruthy();
  });
});

describe("Admin phone classes", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  it("Users: numbers stack on a phone and wrap; the row link is 44 px", () => {
    const s = read("src/features/admin/UsersPage.tsx");
    expect(s).toContain("grid-cols-1");
    expect(s).toContain("dt:grid-cols-3");
    expect(s).not.toContain("mb-5 grid grid-cols-3");
    expect(s).toContain("max-dt:min-h-[44px]");
  });
  it("switches, week-day pickers and 'Get a new link' are 44 px below 1024", () => {
    expect(read("src/features/admin/ui.tsx")).toContain("h-11 w-14");
    expect(read("src/features/admin/CalendarPage.tsx")).toContain("max-dt:min-h-[44px]\" value={target");
    expect(read("src/features/admin/VerificationPage.tsx")).toContain("max-dt:min-h-[44px] max-dt:items-center\" onClick={() => void open()}");
  });
  it("the shared design-system switch is 44 px tall below 1024, and the Prices button rows wrap", () => {
    expect(read("src/features/admin/admin.css")).toContain(".ad-root .vx-switch { height: var(--touch-min); }");
    expect(read("src/features/admin/money/PricesPage.tsx")).not.toContain('<div className="flex items-center gap-3">');
  });
  it("the calendar table scrolls inside its own box", () => {
    expect(read("src/features/admin/CalendarPage.tsx")).toContain("overflow-x-auto rounded-xl border border-line bg-surface\">\n            {weeks.length");
  });
});
