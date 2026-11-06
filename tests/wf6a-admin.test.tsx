// @vitest-environment jsdom
// WF-6a (admin screens): C-N3 rejected advert pill, C-N4 account item "Reported", C-N5 summary inside the card, C-N6 spare count.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminModerationPage } from "@/features/admin/ModerationPage";
import { AdminAdsPage } from "@/features/admin/AdsPage";
import { AdminCalendarPage } from "@/features/admin/CalendarPage";
import { AdminWeeklyPage } from "@/features/admin/WeeklyPage";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("C-N3: a rejected advert keeps its pill short and its note wraps inside the table", () => {
  it("the pill says Rejected and the long note sits under it as plain text", async () => {
    const long = "Betting adverts are not allowed on Voices, ever, in any placement";
    const ad = { id: "a1", brand: "Lucky Stake", kind: "FEED_CARD", status: "REJECTED", rejectReason: long, live: false, views: 0, taps: 0, listens: 0, startsOn: null, endsOn: null, ageBands: [], categoryIds: [], states: [], headline: "h", body: null, linkUrl: null, ctaLabel: null, imageUrl: null, audioClipId: null, frequencyCapPerDay: 3, priceKobo: null, changeRequest: null, checks: [] };
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["AD_MANAGER"]));
      if (u.includes("/admin/ads")) return json(200, { items: [ad], nextCursor: null, counts: {} });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    const note = await screen.findByText(long);
    expect(note.className).toContain("break-words");
    const pill = screen.getByText("Rejected");
    expect(pill.textContent).toBe("Rejected");
    expect(pill.className).toContain("whitespace-nowrap");
    expect(note.closest("td")).toBe(pill.closest("td"));
  });
});

describe("C-N4: an account item says Reported, a post says Posted", () => {
  const item = (over: Record<string, unknown>) => ({ id: "i1", queue: "REPORTED", targetType: "USER", targetId: "u2", reasons: ["threat"], reportCount: 1, priority: false, summary: "Reported 1 time", createdAt: new Date(Date.now() - 24 * 60_000).toISOString(), status: "OPEN", questionText: null, listenCount: 0, postKind: null, ...over });
  const detail = (it: unknown, content: unknown) => ({ listenCount: 0, item: it, author: { id: "u2", handle: "mary.k", joinedAt: "2026-10-01T10:00:00Z", postCount: 3, strikeCount: 0 }, content, transcript: null, playUrl: null, screening: [], context: null, audit: [] });
  async function open(it: ReturnType<typeof item>, content: unknown) {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/moderation/items/")) return json(200, detail(it, content));
      if (u.includes("/admin/moderation/items")) return json(200, { items: [it], nextCursor: null, counts: { REPORTED: 1, open: 1, oldestOpenAt: null } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
  }
  it("the account item reads Reported 24m ago, from when it was reported", async () => {
    await open(item({}), { kind: null, body: "bio", createdAt: "2026-10-01T10:00:00Z" });
    expect(await screen.findByText("Reported 24m ago")).toBeTruthy();
    expect(screen.queryByText(/^Posted /)).toBeNull();
  });
  it("a post item still reads Posted", async () => {
    await open(item({ targetType: "ANSWER", targetId: "a9" }), { kind: "TEXT", body: "hello", createdAt: new Date(Date.now() - 5 * 60_000).toISOString() });
    expect(await screen.findByText("Posted 5m ago")).toBeTruthy();
    expect(screen.queryByText(/^Reported 24m/)).toBeNull();
  });
});

describe("C-N6: the spare line does not count the held flash question", () => {
  it("one plain spare and one held flash: the line says 1 more question, the flash has its own row", async () => {
    const q = (id: string, over: Record<string, unknown>) => ({ id, kind: "DAILY", slotIndex: null, day: null, text: `Q ${id}`, hint: null, status: "SCHEDULED", pinned: false, isSpare: true, categoryId: null, voiceCount: 0, ...over });
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/topics/t1")) return json(200, { topic: { id: "t1", weekNumber: 1, title: "T", startsOn: "2026-11-05", status: "LIVE", sensitive: false }, questions: [], spare: [q("s1", {}), q("f1", { kind: "FLASH", text: "Is your bank app working?" })], poll: null });
      if (u.includes("/admin/topics")) return json(200, { items: [{ weekNumber: 1, topicId: "t1", title: "T", startsOn: "2026-11-05", status: "LIVE" }], nextCursor: null, counts: { live: 1, scheduled: 0, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 2 } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminCalendarPage /></AdminFrame>);
    expect(await screen.findByText("1 more question held for follow-ups and flash polls")).toBeTruthy();
    expect(screen.getByText("Is your bank app working?")).toBeTruthy();
  });
  it("only a held flash question: no spare line at all", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/topics/t1")) return json(200, { topic: { id: "t1", weekNumber: 1, title: "T", startsOn: "2026-11-05", status: "LIVE", sensitive: false }, questions: [], spare: [{ id: "f1", kind: "FLASH", slotIndex: null, day: null, text: "Flash only", hint: null, status: "SCHEDULED", pinned: false, isSpare: true, categoryId: null, voiceCount: 0 }], poll: null });
      if (u.includes("/admin/topics")) return json(200, { items: [{ weekNumber: 1, topicId: "t1", title: "T", startsOn: "2026-11-05", status: "LIVE" }], nextCursor: null, counts: { live: 1, scheduled: 0, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 1 } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminCalendarPage /></AdminFrame>);
    expect(await screen.findByText("Flash only")).toBeTruthy();
    expect(screen.queryByText(/held for follow-ups and flash polls/)).toBeNull();
  });
});

describe("C-N5: the weekly summary is inside the report card", () => {
  it("the summary text is a child of the card article, not below it", async () => {
    const report = { id: "r1", topicId: "t", weekNumber: 1, status: "APPROVED", draftedAt: "2026-11-06T12:06:00Z", pollClosedAt: null, publishAt: "2026-11-06T12:09:00Z", headline: "Tired but steady", mood: "Tired but steady", summary: "Most voices say the light comes and goes.", themes: [], sentiment: {}, pollSummary: {}, quotes: [], basedOnVoices: 8, basedOnVotes: 0, languagesRead: [], checks: [], emotions: [], cardTitle: null, editorNote: null };
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/weekly-reports")) return json(200, { items: [report], nextCursor: null });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    const text = await screen.findByText("Most voices say the light comes and goes.");
    await waitFor(() => expect(text.closest("article")?.getAttribute("aria-label")).toBe("Weekly report"));
    void userEvent;
  });
});
