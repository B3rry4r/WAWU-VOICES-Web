// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let search = "a=a1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/features/share", () => ({ ShareSheet: () => null }));

import { PostedScreen } from "@/features/talk/PostedScreen";
import { FriendsScreen } from "@/features/friends/FriendsScreen";
import { MoodPickScreen } from "@/features/mood/MoodPickScreen";
import { hidesTabBar } from "@/components/shell/nav";
import { ShellSlotsContext } from "@/components/shell/ShellSlots";
import { INVITE_COOKIE } from "@/lib/invite";
import { inviteMessage, whatsappHref, smsHref } from "@/features/share/invite-share";
import { qrMatrix, qrSvgPath } from "@/lib/qr";

const LINK = "http://stand-in.test/go/ab12cd7";
type Call = { url: string; method: string; body?: unknown };
let calls: Call[] = [];
let friends: unknown[] = [];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const ans = { id: "a1", questionId: "q1", author: { id: "u1", handle: "me", displayName: "Me", state: null, avatarUrl: null }, kind: "TEXT", body: "Hopeful.", clip: null, createdAt: new Date().toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: "HOPEFUL" };
const sit = { answerId: "a1", questionId: "q1", mood: "HOPEFUL", showNameOnCard: false, defaultScope: "NIGERIA", showSwitch: false, nigeria: { percent: null, count: 3 }, world: { percent: null, count: 3 }, cardLine: "You’re one of the first.", updatedAt: "x" };
let shareWord = true;
let claim429 = 0;
function stub() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const c: Call = { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const u = c.url;
    if (u.endsWith("/answers/a1")) return json(ans);
    if (u.endsWith("/answers/a2")) return json({ ...ans, id: "a2", mood: null });
    if (u.endsWith("/me/invite/claim") && claim429 > 0) { claim429--; return new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many tries.", details: { retryAfterSeconds: 1 } } }), { status: 429, headers: { "Retry-After": "1" } }); }
    if (u.endsWith("/where-you-sit")) return json(sit);
    if (u.includes("/me/allowance")) return json({ freePostsRemaining: 5 });
    if (u.endsWith("/share/links")) return json({ code: "c1", url: "x", cardStatus: "PENDING" });
    if (u.endsWith("/me/invite")) return json({ code: "ab12cd7", url: LINK, friendsAnswered: friends.length });
    if (u.includes("/me/friends")) return json({ count: friends.length, items: friends, nextCursor: null });
    if (u.endsWith("/me/invite/claim")) return new Response(null, { status: 204 });
    if (u.endsWith("/me/settings")) { if (c.method === "PATCH") shareWord = (c.body as { shareMyWord: boolean }).shareMyWord; return json({ shareMyWord: shareWord }); }
    if (u.endsWith("/questions/q1")) return json({ id: "q1", status: "LIVE", text: "How do you feel about Nigeria right now?", hint: null, moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"] });
    if (u.endsWith("/config/public")) return json({ voiceFreeSeconds: 10 });
    return new Response("{}", { status: 404 });
  }));
}
const opened = vi.fn();
const shared = vi.fn(async () => undefined);
const written = vi.fn(async () => undefined);
beforeEach(() => {
  calls = []; friends = []; shareWord = true; claim429 = 0; search = "a=a1";
  window.localStorage.clear();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  document.cookie = `${INVITE_COOKIE}=; Max-Age=0; Path=/`;
  opened.mockReset(); shared.mockReset(); written.mockReset();
  vi.stubGlobal("open", opened);
  Object.defineProperty(navigator, "share", { value: shared, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: written }, configurable: true });
  stub();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("You’re live (LCH-05)", () => {
  it("shows the message exactly, the buttons in order, and sends nothing until a tap", async () => {
    render(<PostedScreen qid="q1" />);
    await screen.findByText("Send it to 3 people.");
    const msg = inviteMessage("HOPEFUL", LINK);
    await waitFor(() => expect(screen.getByTestId("invite-message").textContent).toBe(msg));
    const names = screen.getAllByRole("link").concat(screen.getAllByRole("button")).map((e) => e.textContent);
    expect(names.indexOf("Share on WhatsApp")).toBeLessThan(names.indexOf("SMS"));
    const wa = screen.getByRole("link", { name: "Share on WhatsApp" });
    expect(wa.getAttribute("href")).toBe(whatsappHref(msg));
    expect(screen.getByRole("link", { name: "SMS" }).getAttribute("href")).toBe(smsHref(msg, "android"));
    // untouched: nothing opened, shared or copied; nothing sent to any sharing route; no contacts
    expect(opened).not.toHaveBeenCalled();
    expect(shared).not.toHaveBeenCalled();
    expect(written).not.toHaveBeenCalled();
    expect(calls.some((c) => /contacts/i.test(c.url))).toBe(false);
    expect(screen.queryByText("Back to the conversation")).toBeNull();
  });
  it("Copy link copies the personal link, More opens the share sheet with the message", async () => {
    render(<PostedScreen qid="q1" />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Copy link" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(written).toHaveBeenCalledWith(LINK);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(shared).toHaveBeenCalledWith({ text: inviteMessage("HOPEFUL", LINK) });
  });
  it("the QR code encodes the personal link, and the friends row says how many answered", async () => {
    friends = [{ handle: "kemi.b", displayName: "Kemi Bello", answeredAt: new Date().toISOString(), word: "HOPEFUL", wordShared: true }, { handle: "segun", displayName: null, answeredAt: new Date().toISOString(), word: null, wordShared: false }];
    render(<PostedScreen qid="q1" />);
    const qr = await screen.findByTestId("invite-qr");
    await waitFor(() => expect(qr.getAttribute("data-link")).toBe(LINK));
    expect(qr.querySelector("path")?.getAttribute("d")).toBe(qrSvgPath(qrMatrix(LINK)));
    await screen.findByText("2 of your friends have answered");
    expect(screen.getByText("Ask the person next to you, then compare")).toBeTruthy();
    expect(hidesTabBar("/friends")).toBe(true);
  });
  it("counts the link the person arrived by, once, then forgets the code", async () => {
    document.cookie = `${INVITE_COOKIE}=zz11yy2; Path=/`;
    render(<PostedScreen qid="q1" />);
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/me/invite/claim"))).toHaveLength(1));
    expect(calls.find((c) => c.url.endsWith("/me/invite/claim"))?.body).toEqual({ code: "zz11yy2" });
    await waitFor(() => expect(document.cookie).not.toContain(INVITE_COOKIE + "=zz11yy2"));
  });
  it("does not claim anything without a kept code", async () => {
    render(<PostedScreen qid="q1" />);
    await screen.findByText("Send it to 3 people.");
    expect(calls.some((c) => c.url.endsWith("/me/invite/claim"))).toBe(false);
  });
  it("sends a Share my word choice made before sign-in, before the claim", async () => {
    window.localStorage.setItem("voices-share-word", "off");
    document.cookie = `${INVITE_COOKIE}=zz11yy2; Path=/`;
    render(<PostedScreen qid="q1" />);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/me/invite/claim"))).toBe(true));
    const order = calls.filter((c) => c.method !== "GET" && /settings|claim/.test(c.url)).map((c) => (c.url.endsWith("settings") ? "settings" : "claim"));
    expect(order).toEqual(["settings", "claim"]);
    expect(shareWord).toBe(false);
    expect(window.localStorage.getItem("voices-share-word")).toBeNull();
  });
});

describe("Your friends (Friends board)", () => {
  it("lists handle and word, and Word kept private for a friend who turned it off", async () => {
    friends = [
      { handle: "kemi.b", displayName: "Kemi Bello", answeredAt: new Date(Date.now() - 2 * 3600_000).toISOString(), word: "HOPEFUL", wordShared: true },
      { handle: "ifeoma.n", displayName: null, answeredAt: new Date(Date.now() - 3 * 3600_000).toISOString(), word: null, wordShared: false },
    ];
    render(<FriendsScreen />);
    await screen.findByText("2 of your friends have answered");
    expect(screen.getByText("@kemi.b")).toBeTruthy();
    expect(screen.getByText("HOPEFUL")).toBeTruthy();
    expect(screen.getByText("Answered 2h ago")).toBeTruthy();
    expect(screen.getByText("Word kept private")).toBeTruthy();
    expect(screen.getByText("A friend who keeps their word private still counts as answered.")).toBeTruthy();
    expect(screen.getByTestId("friends-link").textContent).toBe("stand-in.test/go/ab12cd7");
  });
});

describe("Share my word on the pick screen", () => {
  it("is on by default; signed in it is saved at once", async () => {
    render(<MoodPickScreen qid="q1" />);
    const sw = await screen.findByRole("switch", { name: "Share my word with the friend who invited me" });
    await waitFor(() => expect((sw as HTMLInputElement).checked || sw.getAttribute("aria-checked") === "true").toBe(true));
    await userEvent.click(sw);
    await waitFor(() => expect(shareWord).toBe(false));
  });
  it("before sign-in it waits in the browser", async () => {
    window.localStorage.clear();
    render(<MoodPickScreen qid="q1" />);
    const sw = await screen.findByRole("switch", { name: "Share my word with the friend who invited me" });
    await userEvent.click(sw);
    expect(window.localStorage.getItem("voices-share-word")).toBe("off");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });
});

describe("tab bar and retries (lead ruling LC, 9 Nov)", () => {
  const slots = (hideTabs: () => () => void) => ({ railEl: null, barEl: null, claimBar: () => () => undefined, hideTabs });
  it("only the mood Posted screen hides the tab bar; an ordinary Posted screen keeps it", async () => {
    const hide = vi.fn(() => () => undefined);
    const { unmount } = render(<ShellSlotsContext.Provider value={slots(hide)}><PostedScreen qid="q1" /></ShellSlotsContext.Provider>);
    await screen.findByText("Send it to 3 people.");
    expect(hide).toHaveBeenCalled();
    unmount();
    const hide2 = vi.fn(() => () => undefined);
    search = "a=a2";
    render(<ShellSlotsContext.Provider value={slots(hide2)}><PostedScreen qid="q1" /></ShellSlotsContext.Provider>);
    await screen.findByText("Your voice is live");
    expect(hide2).not.toHaveBeenCalled();
    expect(hidesTabBar("/q/q1/posted")).toBe(false);
  });
  it("a 429 on the claim keeps the code and tries again after Retry-After", async () => {
    document.cookie = `${INVITE_COOKIE}=zz11yy2; Path=/`;
    claim429 = 1;
    render(<PostedScreen qid="q1" />);
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/me/invite/claim"))).toHaveLength(1));
    expect(document.cookie).toContain(`${INVITE_COOKIE}=zz11yy2`);
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/me/invite/claim"))).toHaveLength(2), { timeout: 4000 });
    await waitFor(() => expect(document.cookie).not.toContain(`${INVITE_COOKIE}=zz11yy2`));
  });
});
