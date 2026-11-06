// @vitest-environment jsdom
// WF-4 (walk-fix web wiring): RW1 counts, RW2 appeal, RW7 notices, RW6 day swap, RW5 flash poll, C-M7, B-L2, C-M8.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { voicesOf } from "@/lib/feed-format";
import { NotificationsPage, noticeWords, targetHref } from "@/features/notifications/NotificationsPage";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminModerationPage } from "@/features/admin/ModerationPage";
import { AdminCalendarPage } from "@/features/admin/CalendarPage";
import { AdminOverridePage } from "@/features/admin/OverridePage";
import { changedFields } from "@/features/admin/AdsPage";
import { paymentRef, shortRef } from "@/features/units/PaymentDoneScreen";
import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/lib/api/reach";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/admin" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };
let calls: { url: string; method: string; body: unknown }[];
let routes: (url: string, method: string, body: unknown) => Response | null;

beforeEach(() => {
  calls = [];
  push.mockClear();
  routes = () => null;
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (u: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: u, method: init.method ?? "GET", body });
    return routes(u, init.method ?? "GET", body) ?? json(404, NOT_FOUND);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("RW1: one voices count", () => {
  it("reads voicesCount, then answerCount, never the number of voice clips", () => {
    expect(voicesOf({ voiceCount: 2, answerCount: 5, voicesCount: 5 })).toBe(5);
    expect(voicesOf({ voiceCount: 2, answerCount: 5 })).toBe(5);
    expect(voicesOf({ voiceCount: 0, voicesCount: 8 })).toBe(8);
    expect(voicesOf({ voiceCount: 3 })).toBe(3);
  });
});

const note = (over: Partial<Notification>): Notification => ({ id: "n1", type: "REPLY", title: "@kemi.b replied to your voice", body: "“Two hours is generous.”", targetType: "answer", targetId: "a1", questionId: "q1", actorCount: 1, read: true, createdAt: new Date().toISOString(), appeal: null, ...over });
const page = (items: Notification[]) => json(200, { items, nextCursor: null, unread: 0 });

describe("RW7: notice words and where a tap lands", () => {
  it("names the person, bold, and adds the reply's quote after a colon", () => {
    render(<p>{noticeWords(note({}))}</p>);
    expect(screen.getByText("@kemi.b").tagName).toBe("B");
    expect(document.body.textContent).toBe("@kemi.b replied to your voice: “Two hours is generous.”");
    cleanup();
    render(<p>{noticeWords(note({ type: "REACTIONS", title: "@tunde.a and 41 others reacted to your voice", body: "“Two hours.”" }))}</p>);
    expect(document.body.textContent).toBe("@tunde.a and 41 others reacted to your voice");
  });
  it("opens the thread for an answer or reply, the units screen, the weekly report, and nothing for a moderation notice", () => {
    expect(targetHref(note({}))).toBe("/q/q1/a/a1");
    expect(targetHref(note({ questionId: null }))).toBeNull();
    expect(targetHref({ type: "UNITS_ADDED", targetType: "wallet", targetId: "p1" })).toBe("/units");
    expect(targetHref({ type: "WEEKLY_REPORT", targetType: "weekly_report", targetId: "r1" })).toBe("/weekly/r1");
    expect(targetHref({ type: "FLASH_POLL", targetType: "poll", targetId: "p1" })).toBe("/");
    expect(targetHref(note({ type: "MODERATION_NOTICE", targetType: "answer" }))).toBeNull();
  });
  it("a tap on a reply pushes the thread (so Back returns to the list) and marks it read", async () => {
    routes = (u) => (u.includes("/notifications/read") ? json(200, { unread: 0 }) : u.includes("/notifications") ? page([note({ read: false })]) : null);
    render(<NotificationsPage />);
    await userEvent.setup().click(await screen.findByText("@kemi.b"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/a/a1"));
    expect(calls.some((c) => c.url.endsWith("/notifications/read"))).toBe(true);
  });
  it("still opens the thread when marking it read fails", async () => {
    routes = (u) => (u.includes("/notifications/read") ? json(500, { error: { code: "INTERNAL", message: "x" } }) : u.includes("/notifications") ? page([note({ read: false })]) : null);
    render(<NotificationsPage />);
    await userEvent.setup().click(await screen.findByText("@kemi.b"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/q/q1/a/a1"));
  });
  it("a result notice opens the live thread it belongs to", async () => {
    routes = (u) => (u.includes("/result-threads") ? json(200, { items: [{ id: "t9", status: "OPEN" }], nextCursor: null }) : u.includes("/notifications") ? page([note({ id: "n3", type: "RESULT_CHECKED", title: "Your result was checked and marked Verified", body: "PU 012, Ward 3, Ikeja", targetType: "result_post", targetId: "p1", questionId: null })]) : null);
    render(<NotificationsPage />);
    await userEvent.setup().click(await screen.findByText(/Your result was checked/));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/live/t9"));
  });
});

describe("RW2: Appeal on a notice", () => {
  const removal = (state: "AVAILABLE" | "SENT") => note({ id: "m1", type: "MODERATION_NOTICE", title: "A post of yours was taken down", body: "It attacks people.", appeal: { state, targetType: "ANSWER", targetId: "a9" } });

  it("an open appeal opens a sheet; Send posts the note to /appeals and the notice reads Appeal sent", async () => {
    routes = (u, m) => (m === "POST" && u.endsWith("/appeals") ? json(201, { id: "ap1", status: "OPEN" }) : u.includes("/notifications") ? page([removal("AVAILABLE")]) : null);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole("button", { name: "Appeal" }));
    const box = await screen.findByLabelText("Tell us why we got it wrong");
    expect((box as HTMLTextAreaElement).maxLength).toBe(500);
    // WF-6b (A-L6): Send is disabled while the box is empty, so there is nothing to send and no error to show
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/appeals"))).toBe(false);
    await user.type(box, "I was angry about prices, not about people.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/appeals"))).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/appeals"))!.body).toEqual({ targetType: "ANSWER", targetId: "a9", note: "I was angry about prices, not about people." });
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(await screen.findByText("Appeal sent. Another moderator will look again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Appeal" })).toBeNull();
  });
  it("WF-5: the sheet's sent state says 'Another moderator will look again.' once", async () => {
    routes = (u, m) => (m === "POST" && u.endsWith("/appeals") ? json(201, { id: "ap1", status: "OPEN" }) : u.includes("/notifications") ? page([removal("AVAILABLE")]) : null);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole("button", { name: "Appeal" }));
    expect(screen.getAllByText(/Another moderator will look again/).length).toBe(1);
    await user.type(await screen.findByLabelText("Tell us why we got it wrong"), "Please look again.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("button", { name: "Done" });
    const sheet = screen.getByRole("dialog");
    expect((sheet.textContent ?? "").match(/Another moderator will look again/g)?.length).toBe(1);
  });
  it("a notice whose appeal is already sent shows the sent line and no button", async () => {
    routes = (u) => (u.includes("/notifications") ? page([removal("SENT")]) : null);
    render(<NotificationsPage />);
    expect(await screen.findByText("Appeal sent. Another moderator will look again.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Appeal" })).toBeNull();
  });
  it("a second try (409) shows the sent state, not an error", async () => {
    routes = (u, m) => (m === "POST" && u.endsWith("/appeals") ? json(409, { error: { code: "CONFLICT", message: "Your appeal is already with us." } }) : u.includes("/notifications") ? page([removal("AVAILABLE")]) : null);
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await user.click(await screen.findByRole("button", { name: "Appeal" }));
    await user.type(await screen.findByLabelText("Tell us why we got it wrong"), "Please look again.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getAllByText("Appeal sent. Another moderator will look again.").length).toBeGreaterThan(0));
    expect(screen.queryByText("We could not send your appeal. Try again in a moment.")).toBeNull();
  });
  it("a suspended person stays signed in: a 403 ACCOUNT_SUSPENDED on a write keeps the session and the appeal still goes", async () => {
    routes = (u) => (u.includes("/answers/a1/like") ? json(403, { error: { code: "ACCOUNT_SUSPENDED", message: "This account cannot post right now." } }) : null);
    await expect(apiFetch("/answers/a1/like", { method: "PUT", authed: true })).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    expect(JSON.parse(window.localStorage.getItem("voices-web-session") ?? "null")).toMatchObject({ accessToken: "t" });
  });
});

const frame = (el: React.ReactElement) => render(<AdminFrame>{el}</AdminFrame>);

describe("RW2: moderators read the appeal note", () => {
  it("the item detail shows who appealed, when, and the note", async () => {
    const item = { id: "i1", queue: "APPEAL", targetType: "ANSWER", targetId: "a9", reasons: ["APPEAL"], reportCount: 1, priority: false, summary: "Asking for a second look", createdAt: "2026-11-05T10:00:00Z", status: "OPEN", questionText: null, listenCount: 0, postKind: "TEXT" };
    routes = (u) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/moderation/items/")) return json(200, { listenCount: 0, item, author: { id: "u1", handle: "dayo.vwf", joinedAt: "2026-10-01T10:00:00Z", postCount: 3, strikeCount: 0 }, content: { kind: "ANSWER", body: "Words", createdAt: "2026-11-05T10:00:00Z" }, transcript: null, playUrl: null, appeals: [{ id: "ap1", note: "I was angry about prices, not about people.", status: "OPEN", createdAt: "2026-11-06T08:30:00Z" }], screening: [], context: null, audit: [] });
      if (u.includes("/admin/moderation/items")) return json(200, { items: [item], nextCursor: null, counts: { APPEAL: 1, REPORTED: 0, open: 1, oldestOpenAt: null } });
      return null;
    };
    frame(<AdminModerationPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /Appeals/ }));
    await user.click(await screen.findByRole("listitem"));
    expect(await screen.findByText("I was angry about prices, not about people.")).toBeTruthy();
    expect(screen.getAllByText(/@dayo\.vwf · 6 Nov/).length).toBeGreaterThan(0);
  });
  it("the empty queue no longer promises screening", async () => {
    routes = (u) => (u.endsWith("/me") ? json(200, me(["MODERATOR"])) : u.includes("/admin/moderation/items") ? json(200, { items: [], nextCursor: null, counts: { REPORTED: 0, open: 0, oldestOpenAt: null } }) : null);
    frame(<AdminModerationPage />);
    expect(await screen.findByText("New items land here as people report them.")).toBeTruthy();
  });
});

const q = (id: string, day: string | null, text: string, over: Record<string, unknown> = {}) => ({ id, kind: "DAILY", slotIndex: 1, day, text, hint: null, status: "SCHEDULED", pinned: false, isSpare: false, categoryId: null, voiceCount: 0, ...over });
const topic = { id: "t1", weekNumber: 2, title: "Money", blurb: null, countryCode: "NG", startsOn: "2026-11-12", endsOn: "2026-11-18", status: "SCHEDULED", sensitive: false, whatNextPrompt: null, questionCount: 3, voiceCount: 0 };
const calendarRoutes = (spare: unknown[] = []) => (u: string, m: string, body: unknown): Response | null => {
  if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
  if (u.includes("/admin/topics/t1")) return json(200, { topic, questions: [q("q1", "2026-11-12", "First question?"), q("q2", "2026-11-13", "Second question?")], spare, poll: null });
  if (u.includes("/admin/topics")) return json(200, { items: [{ topicId: "t1", weekNumber: 2, title: "Money", startsOn: "2026-11-12", status: "SCHEDULED" }], nextCursor: null, counts: { live: 0, scheduled: 1, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 3 } });
  void m; void body;
  return null;
};

describe("RW6: the Calendar day control", () => {
  it("choosing a taken day says what swaps, confirms, then calls move", async () => {
    routes = (u, m, b) => (m === "POST" && u.includes("/admin/questions/q1/move") ? json(200, { question: q("q1", "2026-11-13", "First question?"), swappedWith: q("q2", "2026-11-12", "Second question?") }) : calendarRoutes()(u, m, b));
    frame(<AdminCalendarPage />);
    const user = userEvent.setup();
    const day = await screen.findByLabelText("Day for: First question?");
    expect(within(day).getAllByRole("option")).toHaveLength(7);
    await user.selectOptions(day, "2026-11-13");
    const box = await screen.findByRole("group", { name: "Swap days" });
    expect(within(box).getByText("This swaps with “Second question?”.")).toBeTruthy();
    expect(calls.some((c) => c.url.includes("/move"))).toBe(false);
    await user.click(within(box).getByRole("button", { name: "Swap" }));
    await waitFor(() => expect(calls.find((c) => c.url.includes("/q1/move"))?.body).toEqual({ day: "2026-11-13" }));
    expect(await screen.findByText("The two questions swapped days.")).toBeTruthy();
  });
  it("a free day moves at once; a started question is refused in plain words", async () => {
    routes = (u, m, b) => (m === "POST" && u.includes("/move") ? json(409, { error: { code: "CONFLICT", message: "A question that has started cannot move." } }) : calendarRoutes()(u, m, b));
    frame(<AdminCalendarPage />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Day for: First question?"), "2026-11-15");
    expect(await screen.findByText("This question has started.")).toBeTruthy();
  });
  it("a question that is live or closed has no day control", async () => {
    routes = (u, m, b) => (u.includes("/admin/topics/t1") ? json(200, { topic, questions: [q("q1", "2026-11-12", "Live one?", { status: "LIVE" })], spare: [], poll: null }) : calendarRoutes()(u, m, b));
    frame(<AdminCalendarPage />);
    await screen.findByText("Live one?");
    expect(screen.queryByLabelText("Day for: Live one?")).toBeNull();
  });
});

describe("RW5: start a held flash question as a flash poll", () => {
  const held = [q("f1", null, "Should fuel price be fixed?", { kind: "FLASH", isSpare: true, slotIndex: null })];
  it("asks first, then POSTs a FLASH poll for that question", async () => {
    routes = (u, m, b) => (m === "POST" && u.endsWith("/admin/polls") ? json(201, { id: "p1" }) : calendarRoutes(held)(u, m, b));
    frame(<AdminCalendarPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Start as flash poll" }));
    expect(screen.getByText("Starts now and stays open for 24 hours.")).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/admin/polls"))).toBe(false);
    await user.click(screen.getByRole("button", { name: "Start now" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/admin/polls"))).toBe(true));
    const sent = calls.find((c) => c.url.endsWith("/admin/polls"))!.body as Record<string, unknown>;
    expect(sent).toMatchObject({ kind: "FLASH", questionId: "f1", title: "Should fuel price be fixed?", choiceMode: "SINGLE", options: ["Yes", "No"] });
    expect(Date.parse(sent.endsAt as string) - Date.parse(sent.startsAt as string)).toBe(24 * 3600000);
  });
  it("shows the API's words when a flash poll is already open", async () => {
    routes = (u, m, b) => (m === "POST" && u.endsWith("/admin/polls") ? json(409, { error: { code: "CONFLICT", message: "A flash poll is already open." } }) : calendarRoutes(held)(u, m, b));
    frame(<AdminCalendarPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Start as flash poll" }));
    await user.click(screen.getByRole("button", { name: "Start now" }));
    expect(await screen.findByText("A flash poll is already open.")).toBeTruthy();
  });
  it("a plain follow-up question has no Start as flash poll button", async () => {
    routes = calendarRoutes([q("s1", null, "Follow up?", { kind: "FOLLOW_UP", isSpare: true, slotIndex: null })]);
    frame(<AdminCalendarPage />);
    await screen.findByText(/held for follow-ups and flash polls/);
    expect(screen.queryByRole("button", { name: "Start as flash poll" })).toBeNull();
  });
});

describe("C-M7: the override log", () => {
  it("By shows the person's name, not the handle", async () => {
    const o = { id: "o1", headline: "Power out", status: "ENDED", contentKind: "TEXT", body: "b", imageUrl: null, linkUrl: null, audioUrl: null, startsAt: "2026-11-05T10:00:00Z", endsAt: "2026-11-05T12:00:00Z", emergency: false, notifyAlert: false, keepWeeklyTheme: true, dropReplaced: false, replaced: null, questionId: "q1", by: "ngozi.e", byName: "Ngozi E.", createdAt: "2026-11-05T09:00:00Z", result: "Ended" };
    routes = (u) => (u.endsWith("/me") ? json(200, me(["EDITOR"])) : u.includes("/admin/overrides") ? json(200, { items: [o], nextCursor: null }) : u.includes("/admin/today") ? json(200, null) : null);
    frame(<AdminOverridePage />);
    expect(await screen.findByText("Ngozi E.")).toBeTruthy();
    expect(screen.queryByText("ngozi.e")).toBeNull();
  });
});

describe("B-L2: one payment reference", () => {
  it("prefers reference, keeps VU- whole, and only shortens the provider's own voices- reference", () => {
    expect(paymentRef({ reference: "VU-261106-C049DDBA", receiptNo: null, txRef: "voices-aaaa" })).toBe("VU-261106-C049DDBA");
    expect(paymentRef({ receiptNo: "VU-1", txRef: "voices-aaaa" })).toBe("VU-1");
    expect(paymentRef({ txRef: "voices-aaaa" })).toBe("voices-aaaa");
    expect(shortRef("VU-261106-C049DDBA")).toBe("VU-261106-C049DDBA");
  });
});

describe("C-M8: an advert edit sends only what changed", () => {
  const ad = { brand: "Zobo", kind: "FEED_CARD", headline: "Fresh zobo", body: "b", linkUrl: "https://zobo.ng", ctaLabel: "Order", categoryIds: [], states: [], startsOn: "2026-11-06", endsOn: "2026-11-30", frequencyCapPerDay: 3, priceKobo: 5000000 } as never;
  it("dates only: just the dates, no content field", () => {
    const out = changedFields(ad, { brand: "Zobo", kind: "FEED_CARD", headline: "Fresh zobo", body: "b", linkUrl: "https://zobo.ng", ctaLabel: "Order", startsOn: "2026-11-08", endsOn: "2026-11-30", frequencyCapPerDay: 3, priceKobo: 5000000 });
    expect(out).toEqual({ startsOn: "2026-11-08" });
  });
  it("nothing changed: nothing to send", () => {
    expect(changedFields(ad, { brand: "Zobo", kind: "FEED_CARD", headline: "Fresh zobo" })).toEqual({});
  });
});
