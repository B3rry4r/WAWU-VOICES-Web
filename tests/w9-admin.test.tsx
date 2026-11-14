// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { canOpen, roleLine } from "@/features/admin/roles";
import { refusalWords } from "@/features/admin/ui";
import { ApiError } from "@/lib/api/client";
import { fromLocalInput, toLocalInput } from "@/features/admin/time";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminWeeklyPage } from "@/features/admin/WeeklyPage";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/weekly", useRouter: () => ({ replace: () => undefined, push: () => undefined, back: () => undefined }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("roles", () => {
  it("each page opens only for the roles the API accepts", () => {
    expect(canOpen(["MODERATOR"], "moderation")).toBe(true);
    expect(canOpen(["MODERATOR"], "ads")).toBe(false);
    expect(canOpen(["MODERATOR"], "weekly")).toBe(false);
    expect(canOpen(["AD_MANAGER"], "ads")).toBe(true);
    expect(canOpen(["AD_MANAGER"], "moderation")).toBe(false);
    expect(canOpen(["EDITOR"], "calendar")).toBe(true);
    expect(canOpen(["ADMIN"], "ads")).toBe(true);
    expect(canOpen([], "today")).toBe(false);
    expect(roleLine(["ADMIN", "EDITOR"])).toBe("Editor and admin");
  });
  it("shows the API's own words, field messages first, never a code", () => {
    expect(refusalWords(new ApiError(422, "VALIDATION_FAILED", "Some details need fixing.", true, { fields: [{ path: "publishAt", message: "The publish time cannot be in the past." }] }))).toBe("The publish time cannot be in the past.");
    expect(refusalWords(new ApiError(403, "FORBIDDEN", "You cannot moderate your own account.", true))).toBe("You cannot moderate your own account.");
    expect(refusalWords(new ApiError(500, "HTTP_500", "Request failed (500)", false))).toBe("That did not go through. Try again.");
  });
  it("reads times in Lagos", () => {
    expect(toLocalInput("2026-11-30T09:30:00Z")).toBe("2026-11-30T10:30");
    expect(fromLocalInput("2026-11-30T10:30")).toBe("2026-11-30T09:30:00.000Z");
  });
});

describe("AdminFrame gate", () => {
  it("a person with no admin role gets the not an admin page and no admin chrome", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me([])) : json(403, { error: { code: "FORBIDDEN", message: "no" } }))));
    render(<AdminFrame><div>secret admin page</div></AdminFrame>);
    await waitFor(() => expect(screen.getByText("This account is not an admin")).toBeTruthy());
    expect(screen.queryByText("secret admin page")).toBeNull();
  });
  it("a guest gets the admin sign-in page and makes no API call", async () => {
    window.localStorage.clear();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><div>secret admin page</div></AdminFrame>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "VOICES admin" })).toBeTruthy());
    expect(f).not.toHaveBeenCalled();
  });
  it("a moderator sees Today and Moderation in the nav and nothing else", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me(["MODERATOR"])) : json(404, { error: { code: "NOT_FOUND", message: "no" } }))));
    render(<AdminFrame><div>page</div></AdminFrame>);
    await waitFor(() => expect(screen.getAllByRole("link", { name: /Moderation/ }).length).toBeGreaterThan(0));
    const nav = screen.getByRole("navigation", { name: "Admin pages" });
    expect(nav.textContent).toContain("Today");
    for (const gone of ["Adverts", "Weekly report", "News tags", "Topic calendar", "Override the day", "Posted results"]) expect(nav.textContent).not.toContain(gone);
  });
});

describe("Weekly approval", () => {
  const report = {
    id: "r1", topicId: "t1", weekNumber: 2, status: "DRAFT", draftedAt: "2026-11-05T17:00:00Z", pollClosedAt: null, publishAt: null, headline: "H", mood: "M", summary: "S", themes: [], sentiment: null, pollSummary: null,
    quotes: [], basedOnVoices: 10, basedOnVotes: 5, languagesRead: ["English"], checks: [{ text: "No names, handles or phone numbers", ok: true }, { text: "A quote has no consent", ok: false }], emotions: [], cardTitle: null, editorNote: null,
  };
  it("shows the checks, and a refused approval shows the API's words without publishing", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${u}`);
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/approve")) return json(422, { error: { code: "VALIDATION_FAILED", message: "Some details need fixing.", details: { fields: [{ path: "quotes", message: "A quote has no consent or its post is gone. Fix it before approving." }] } } });
      if (u.includes("/admin/weekly-reports")) return json(200, { items: [report], nextCursor: null });
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    await waitFor(() => expect(screen.getByText("A quote has no consent")).toBeTruthy());
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: /^Approve and publish at/ }));
    await waitFor(() => expect(screen.getByText("A quote has no consent or its post is gone. Fix it before approving.")).toBeTruthy());
    expect(screen.getByRole("button", { name: /^Approve and publish at/ })).toBeTruthy();
  });
  it("Hold needs a reason before it sends", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/weekly-reports")) return json(200, { items: [report], nextCursor: null });
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    const u = userEvent.setup();
    await waitFor(() => screen.getByRole("button", { name: "Hold" }));
    await u.click(screen.getByRole("button", { name: "Hold" }));
    expect((screen.getByRole("button", { name: "Hold the report" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

import { AdminCalendarPage } from "@/features/admin/CalendarPage";
import { AdminModerationPage } from "@/features/admin/ModerationPage";
import { AdminAdsPage } from "@/features/admin/AdsPage";

describe("round 1", () => {
  it("editing a FLASH question sends its own kind, never DAILY", async () => {
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/questions/") && init?.method === "PATCH") { sent.push(JSON.parse(String(init.body))); return json(200, {}); }
      if (u.includes("/admin/topics/t1")) return json(200, { topic: { id: "t1", weekNumber: 1, title: "T", startsOn: "2026-11-05", status: "LIVE", sensitive: false }, questions: [{ id: "q1", kind: "FLASH", slotIndex: 1, day: "2026-11-05", text: "Is your bank app working right now?", hint: null, status: "LIVE", pinned: false, isSpare: false, categoryId: null, voiceCount: 0 }], spare: [], poll: null });
      if (u.includes("/admin/topics")) return json(200, { items: [{ weekNumber: 1, topicId: "t1", title: "T", startsOn: "2026-11-05", status: "LIVE" }], nextCursor: null, counts: { live: 1, scheduled: 0, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 1 } });
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    render(<AdminFrame><AdminCalendarPage /></AdminFrame>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: /Edit question/ }));
    await u.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent.length).toBe(1));
    expect(sent[0]).toMatchObject({ kind: "FLASH" });
  });

  it("moderation loads the list once and no item detail until one is opened", async () => {
    const calls: string[] = [];
    const item = (id: string) => ({ id, queue: "REPORTED", targetType: "ANSWER", targetId: id, reasons: ["threat"], reportCount: 3, priority: false, summary: "Reported 3 times · voice 0:14", createdAt: "2026-11-05T10:00:00Z", status: "OPEN", questionText: "Which promise?", listenCount: 220, postKind: "VOICE" });
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      calls.push(u);
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/moderation/items/")) return json(200, { listenCount: 220, item: item("a"), author: null, content: null, transcript: null, playUrl: null, screening: [], context: null, audit: [] });
      if (u.includes("/admin/moderation/items")) return json(200, { items: ["a", "b", "c", "d"].map(item), nextCursor: null, counts: { REPORTED: 4, open: 4, oldestOpenAt: null } });
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
    await waitFor(() => expect(screen.getAllByText(/Voice answer on “Which promise\?”/).length).toBe(4));
    expect(screen.getAllByText(/220 listens/).length).toBeGreaterThan(0);
    // only the first row's detail (the open item) is fetched
    expect(calls.filter((c) => c.includes("/admin/moderation/items/")).length).toBe(1);
    expect(calls.filter((c) => /\/admin\/moderation\/items(\?|$)/.test(c)).length).toBe(1);
  });

  it("an advert the API refuses to approve shows the API's reason and the checks as returned", async () => {
    const ad = { id: "a1", brand: "Zobo", kind: "FEED_CARD", status: "AWAITING_APPROVAL", live: false, headline: "H", body: null, linkUrl: null, ctaLabel: null, imageUrl: null, audioClipId: null, categoryIds: [], states: [], ageBands: [], startsOn: null, endsOn: null, frequencyCapPerDay: 3, priceKobo: null, views: 0, taps: 0, listens: 0, rejectReason: null, changeRequest: null, checks: [{ text: "Labelled Ad, with a working link", ok: false }] };
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["AD_MANAGER"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/decision")) return json(422, { error: { code: "VALIDATION_FAILED", message: "Some details need fixing.", details: { fields: [{ path: "linkUrl", message: "The advert needs a working link before it can be approved." }] } } });
      if (u.includes("/admin/ads")) return json(200, { items: [ad], nextCursor: null, awaitingApproval: 1 });
      if (u.includes("/categories")) return json(200, { items: [] });
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText("The advert needs a working link before it can be approved.")).toBeTruthy());
    expect(screen.getByLabelText("Needs a look")).toBeTruthy();
    expect(screen.queryByLabelText("Passed")).toBeNull();
  });

  it("no list is fetched for a role that may not open the page", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      calls.push(u);
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    await waitFor(() => expect(screen.getByText("We could not find that")).toBeTruthy());
    expect(calls.some((c) => c.includes("/admin/ads"))).toBe(false);
  });
});
