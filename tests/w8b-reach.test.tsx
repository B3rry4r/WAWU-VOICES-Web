// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { readPollSummary, readThemes, cardRows } from "@/features/reach/weekly-map";
import { whenLabel, isToday } from "@/features/reach/shared";
import { NotificationsPage, targetHref } from "@/features/notifications/NotificationsPage";
import { ShareSheet, textWithoutLink } from "@/features/share";
import { isChromeless } from "@/components/shell/nav";
import { SharePageView, agoShort } from "@/features/share/SharePageView";
import { WeeklyPage } from "@/features/reach/WeeklyPage";
import type { Notification, SharePage, WeeklyReport } from "@/lib/api/reach";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
let calls: { url: string; method: string; headers: Headers; body: string | null }[];
let routes: (url: string, init: RequestInit) => Response | null;

beforeEach(() => {
  calls = [];
  push.mockClear();
  routes = () => null;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "tok", refreshToken: "r" }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers), body: (init.body as string) ?? null });
    return routes(url, init) ?? json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const note = (over: Partial<Notification>): Notification => ({ id: "n1", type: "REPLY", title: "@kemi.b replied to your voice:", body: "Two hours.", targetType: null, targetId: null, actorCount: 1, read: false, createdAt: new Date().toISOString(), ...over });

describe("weekly mapping", () => {
  it("reads the poll line, the themes and the top three rows", () => {
    expect(readPollSummary({ line: "41% A stable naira led the vote." })).toMatchObject({ pct: 41, text: "A stable naira led the vote.", pollId: null });
    expect(readPollSummary({ pct: 40, text: "t", pollId: "p", title: "Q?" })).toEqual({ pct: 40, text: "t", pollId: "p", title: "Q?" });
    expect(readPollSummary({})).toBeNull();
    expect(readThemes([{ label: "A", count: 3 }, { nope: 1 }])).toEqual([{ text: "A", voices: 3 }]);
    const r = { emotions: [{ name: "Hope", share: 17, change: 1 }, { name: "Anger", share: 44, change: 6 }] } as WeeklyReport;
    expect(cardRows(r, null)).toEqual([{ label: "Anger", pct: 44 }, { label: "Hope", pct: 17 }]);
  });
  it("labels times in Lagos time", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(whenLabel("2026-11-05T11:48:00Z", now)).toBe("12 min");
    expect(whenLabel("2026-11-04T11:00:00Z", now)).toBe("Yesterday");
    expect(isToday("2026-11-05T23:30:00Z", now)).toBe(false); // 00:30 on the 6th in Lagos
  });
  it("links only screens that exist", () => {
    expect(targetHref({ targetType: "weekly_report", targetId: "r1" })).toBe("/weekly/r1");
    expect(targetHref({ targetType: "question", targetId: "q1" })).toBe("/q/q1");
    // lead ruling WF, 6 Nov (RW7): Voice Units notices open the units screen.
    expect(targetHref({ targetType: "wallet", targetId: "w" })).toBe("/units");
  });
});

describe("Notifications", () => {
  const page = (items: Notification[], unread = items.filter((n) => !n.read).length) => json({ items, nextCursor: null, unread });

  it("asks for the tab's type, marks all read with empty ids, and one row with its id then opens it", async () => {
    routes = (url, init) => {
      if (url.includes("/notifications/read")) return json({ unread: 1 });
      if (url.includes("/notifications")) return page([note({}), note({ id: "n2", type: "WEEKLY_REPORT", title: "Week 6 report is out", body: null, targetType: "weekly_report", targetId: "r6" })]);
      return null;
    };
    const user = userEvent.setup();
    render(<NotificationsPage />);
    expect(await screen.findByText("Week 6 report is out")).toBeTruthy();
    expect(calls[0].headers.get("Authorization")).toBe("Bearer tok");
    await user.click(screen.getByRole("tab", { name: "Replies" }));
    await waitFor(() => expect(calls.some((c) => c.url.includes("type=replies"))).toBe(true));
    await user.click(await screen.findByText("Week 6 report is out"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/weekly/r6"));
    const one = calls.find((c) => c.url.endsWith("/notifications/read"))!;
    expect(one.method).toBe("POST");
    expect(JSON.parse(one.body!)).toEqual({ ids: ["n2"] });
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/notifications/read")).length).toBe(2));
    expect(JSON.parse(calls[calls.length - 1].body!)).toEqual({ ids: [] });
  });

  it("puts the row back and says so when marking fails", async () => {
    routes = (url) => (url.includes("/notifications/read") ? json({ error: { code: "INTERNAL", message: "x" } }, 500) : url.includes("/notifications") ? page([note({})]) : null);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    expect(await screen.findByText("Could not mark them as read. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeTruthy();
  });

  it("shows the empty state, the error state, and the guest state", async () => {
    routes = (url) => (url.includes("/notifications") ? page([]) : null);
    render(<NotificationsPage />);
    expect(await screen.findByText("Nothing new yet")).toBeTruthy();
    cleanup();
    routes = () => json({ error: { code: "INTERNAL", message: "x" } }, 500);
    render(<NotificationsPage />);
    expect(await screen.findByText("We could not load your notifications")).toBeTruthy();
    cleanup();
    window.localStorage.clear();
    render(<NotificationsPage />);
    expect(await screen.findByText("Sign in to see your notifications")).toBeTruthy();
  });
});

describe("ShareSheet", () => {
  const link = (over = {}) => ({ code: "abc1234", url: "https://v.test/s/abc1234", cardStatus: "READY", imageUrl: "https://v.test/card.png", storyImageUrl: null, squareImageUrl: null, previewText: "Hello\nAdd your voice: https://v.test/s/abc1234", ...over });

  it("makes the link, shows the card, records the intent for each target and offers no target a browser cannot open", async () => {
    routes = (url, init) => (url.endsWith("/share/links") ? json(link(), 201) : url.includes("/events") ? new Response(null, { status: 204 }) : null);
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShareSheet objectType="ANSWER" objectId="a1" onClose={onClose} />);
    expect(await screen.findByAltText("The card that goes out with your link")).toBeTruthy();
    const made = calls.find((c) => c.url.endsWith("/share/links"))!;
    expect(JSON.parse(made.body!)).toEqual({ objectType: "ANSWER", objectId: "a1" });
    expect(made.headers.get("Authorization")).toBe("Bearer tok");
    expect(screen.getByText("A card and a link go out. The audio file never does.")).toBeTruthy();
    expect(screen.queryByText("TikTok")).toBeNull();
    const wa = screen.getByRole("link", { name: "WhatsApp" });
    expect(wa.getAttribute("href")).toContain("https://wa.me/?text=");
    await user.click(wa);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/share/abc1234/events"))).toBe(true));
    const ev = calls.find((c) => c.url.endsWith("/events"))!;
    expect(JSON.parse(ev.body!)).toEqual({ kind: "intent", target: "WHATSAPP" });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => undefined) }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://v.test/s/abc1234");
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/events")).map((c) => JSON.parse(c.body!).target)).toContain("COPY_LINK"));
  });

  it("a guest sends X-Guest-Id and no token, and the native share button shows only when the browser has it", async () => {
    window.localStorage.clear();
    routes = (url) => (url.endsWith("/share/links") ? json(link(), 201) : null);
    render(<ShareSheet objectType="QUESTION" objectId="q1" onClose={() => undefined} />);
    await screen.findByAltText("The card that goes out with your link");
    const made = calls.find((c) => c.url.endsWith("/share/links"))!;
    expect(made.headers.get("Authorization")).toBeNull();
    expect(made.headers.get("X-Guest-Id")).toMatch(/[0-9a-f-]{36}/);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    cleanup();
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => undefined), configurable: true });
    routes = (url) => (url.endsWith("/share/links") ? json(link(), 201) : url.includes("/events") ? new Response(null, { status: 204 }) : null);
    const user = userEvent.setup();
    render(<ShareSheet objectType="QUESTION" objectId="q1" onClose={() => undefined} />);
    await user.click(await screen.findByRole("button", { name: "More" }));
    expect(navigator.share).toHaveBeenCalled();
    delete (navigator as unknown as Record<string, unknown>).share;
  });

  it("says so when the link cannot be made", async () => {
    routes = () => json({ error: { code: "INTERNAL", message: "x" } }, 500);
    render(<ShareSheet objectType="ANSWER" objectId="a1" onClose={() => undefined} />);
    expect(await screen.findByText("We could not make your link. Close this and try again.")).toBeTruthy();
  });
});

describe("one link per message", () => {
  const url = "https://v.test/s/abc1234";
  const preview = `Are you fine?\nAdd your voice: ${url}`;
  const count = (h: string) => (decodeURIComponent(h).match(/https:\/\/v\.test\/s\/abc1234/g) ?? []).length;
  it("each target's built address carries the link exactly once", async () => {
    routes = (u) => (u.endsWith("/share/links") ? json({ code: "abc1234", url, cardStatus: "READY", imageUrl: "https://v.test/c.png", storyImageUrl: null, squareImageUrl: null, previewText: preview }, 201) : null);
    render(<ShareSheet objectType="QUESTION" objectId="q1" onClose={() => undefined} />);
    await screen.findByAltText("The card that goes out with your link");
    expect(textWithoutLink(preview, url)).toBe("Are you fine?");
    const href = (n: string) => screen.getByRole("link", { name: n }).getAttribute("href")!;
    for (const n of ["WhatsApp", "Facebook", "X", "Telegram", "SMS"]) expect(count(href(n)), n).toBe(1);
    expect(href("X")).toContain("url=");
    expect(decodeURIComponent(href("X"))).not.toContain("Add your voice:");
    expect(decodeURIComponent(href("WhatsApp"))).toContain("Add your voice: " + url);
  });
  it("the share page has no app chrome", () => {
    expect(isChromeless("/s/abc1234")).toBe(true);
    expect(isChromeless("/speak")).toBe(false);
    expect(isChromeless("/weekly")).toBe(false);
  });
});

describe("SharePageView", () => {
  const sp = { code: "abc1234", objectType: "QUESTION", topicLine: "Are you really fine?", countryAndTheme: "Nigeria · Week 1", arguments: [{ text: "Hides problems", voices: 610 }], leanLine: "Most lean towards: x", poll: null, proposalCount: null, topProposal: null, news: null, basedOnVoices: 1240, summaryUpdatedAt: new Date(Date.now() - 12 * 60000).toISOString(), summaryLabel: "AI summary, checked by an editor", featuredVoice: null, transcript: null, question: null, report: null, cardFallback: false, ctaLabel: "Add your voice", openGraph: { title: "t", description: "d", imageUrl: "https://v.test/c.png", url: "https://v.test/s/abc1234" } } as unknown as SharePage;
  it("renders on the server with the headline, the lean and one call to action that opens the recorder", () => {
    const html = renderToString(<SharePageView page={sp} now={Date.now()} />);
    expect(html).toContain("Are you really fine?");
    expect(html).toContain("Where it is heading");
    expect(html).toContain("updated 12 min ago");
    expect(html).toContain('href="/speak?from=abc1234"');
    expect(html).not.toMatch(/[—]/);
    expect(agoShort(new Date(Date.now() - 26 * 3600000).toISOString())).toBe("1d");
  });
});

describe("WeeklyPage", () => {
  it("shows the card, hides the PDF button, and the Share button opens the share sheet", async () => {
    const report = { emotions: [{ name: "Anger", share: 44, change: 6 }], id: "r1", topicId: "t1", weekNumber: 2, title: "Prices", range: "23 to 29 Nov 2026", mood: "Angry about prices.", summary: "s", themes: [{ label: "Prices rise", count: 3214 }], sentiment: {}, pollSummary: { line: "41% A stable naira led." }, quotes: [{ excerpt: "Noodles.", placeLabel: "A voice from Lagos", clipUrl: null }], basedOnVoices: 11872, basedOnVotes: 9406, label: "AI-assisted and human-reviewed", publishedAt: "2026-11-30T17:00:00Z" };
    routes = (url) => (url.endsWith("/weekly-reports/latest") ? json(report) : url.endsWith("/share/links") ? json({ code: "c", url: "u", cardStatus: "PENDING", imageUrl: null, storyImageUrl: null, squareImageUrl: null, previewText: "p" }, 201) : null);
    const user = userEvent.setup();
    render(<WeeklyPage />);
    expect(await screen.findByText("Week 2 · 23 to 29 Nov 2026")).toBeTruthy();
    expect(screen.getByText("Published 30 Nov, 6pm. People are split on some points; this is a summary, not a consensus.", { exact: false })).toBeTruthy();
    expect(screen.getByText("Noodles.", { exact: false })).toBeTruthy();
    expect(screen.queryByText("The poll in full")).toBeNull();
    const share = screen.getAllByRole("button", { name: "Share" })[0];
    await user.click(share);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(JSON.parse(calls.find((c) => c.url.endsWith("/share/links"))!.body!)).toEqual({ objectType: "WEEKLY_REPORT", objectId: "r1" });
  });
  it("says there is no report yet on a 404", async () => {
    routes = () => json({ error: { code: "NOT_FOUND", message: "x" } }, 404);
    render(<WeeklyPage />);
    expect(await screen.findByText("No weekly report yet")).toBeTruthy();
  });
});
