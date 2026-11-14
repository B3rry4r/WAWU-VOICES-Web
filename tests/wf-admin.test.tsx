// @vitest-environment jsdom
// WF-3 (walk-fix, admin screens): hidden unfed tabs, results label, advert edit, appeal banner, suspended words.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminModerationPage } from "@/features/admin/ModerationPage";
import { AdminNewsPage } from "@/features/admin/NewsPage";
import { AdminAdsPage } from "@/features/admin/AdsPage";
import { unitLabel } from "@/features/admin/ResultsPage";
import { refusalWords } from "@/features/admin/ui";
import { ApiError } from "@/lib/api/client";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ngozi.e", roles, profile: { displayName: "Ngozi Eze" } });
const NOT_FOUND = { error: { code: "NOT_FOUND", message: "no" } };

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const modItem = (id: string, over: Record<string, unknown> = {}) => ({ id, queue: "REPORTED", targetType: "ANSWER", targetId: id, reasons: ["threat"], reportCount: 1, priority: false, summary: "Reported 1 time", createdAt: "2026-11-05T10:00:00Z", status: "OPEN", questionText: null, listenCount: 0, postKind: null, ...over });
const modDetail = (item: unknown) => ({ listenCount: 0, item, author: null, content: { kind: "ANSWER", body: "Words", createdAt: "2026-11-05T10:00:00Z" }, transcript: null, playUrl: null, screening: [], context: null, audit: [] });

describe("RW3: unfed tabs are hidden", () => {
  it("Moderation shows Reported, This is about me and Appeals only", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/moderation/items/")) return json(200, modDetail(modItem("a")));
      if (u.includes("/admin/moderation/items")) return json(200, { items: [modItem("a")], nextCursor: null, counts: { REPORTED: 1, open: 1, oldestOpenAt: null } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
    const tabs = await screen.findByRole("tablist", { name: "Moderation queues" });
    await waitFor(() => expect(tabs.textContent).toContain("Reported"));
    expect(tabs.textContent).toContain("This is about me");
    expect(tabs.textContent).toContain("Appeals");
    expect(tabs.textContent).not.toContain("New");
    expect(tabs.textContent).not.toContain("Sensitive topics");
  });
  it("News shows Asking for Verified News first, then Flagged as misleading and All changes (V-FIX-B round 2: requests now exist)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["EDITOR"]));
      if (u.includes("/admin/news/items")) return json(200, { items: [], nextCursor: null, waiting: 0, counts: { flagged: 0, askingVerified: 0, allChanges: 0 } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminNewsPage /></AdminFrame>);
    const tabs = await screen.findByRole("tablist", { name: "News queues" });
    expect(tabs.textContent).toContain("Flagged as misleading");
    expect(tabs.textContent).toContain("All changes");
    expect(tabs.textContent).toContain("Asking for Verified News");
    expect(tabs.textContent!.indexOf("Asking for Verified News")).toBeLessThan(tabs.textContent!.indexOf("Flagged as misleading"));
  });
});

describe("C-M5: results label", () => {
  it("never doubles the PU and Ward prefixes people type themselves", () => {
    const base = { lga: "Ikeja", state: "Lagos" };
    expect(unitLabel({ ...base, pollingUnit: "PU 012", ward: "Ward 3" })).toBe("PU 012, Ward 3, Ikeja, Lagos");
    expect(unitLabel({ ...base, pollingUnit: "012", ward: "3" })).toBe("PU 012, Ward 3, Ikeja, Lagos");
    expect(unitLabel({ ...base, pollingUnit: "polling unit 7", ward: "ward: 9" })).toBe("PU 7, Ward 9, Ikeja, Lagos");
    expect(unitLabel({ ...base, pollingUnit: "Puwa 4", ward: "Wardell" })).toBe("PU Puwa 4, Ward Wardell, Ikeja, Lagos");
  });
});

describe("C-M10 and C-L3: moderation words", () => {
  it("a decided appeal does not say the poster can appeal", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/action")) return json(200, {});
      if (u.includes("/admin/moderation/items/")) return json(200, { ...modDetail(modItem("p", { queue: "APPEAL", targetType: "USER", summary: "Appeal", reasons: [] })), appealKind: "SUSPENSION" });
      if (u.includes("/admin/moderation/items")) return json(200, { items: u.includes("queue=APPEAL") ? [modItem("p", { queue: "APPEAL", targetType: "USER", summary: "Appeal", reasons: [] })] : [], nextCursor: null, counts: { APPEAL: 1, open: 1, oldestOpenAt: null } });
      void init;
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("tab", { name: /Appeals/ }));
    expect(await screen.findByText("Appeal about an account")).toBeTruthy();
    expect(screen.getByText("Asking for a second look")).toBeTruthy();
    await u.type(await screen.findByLabelText(/Reason \(the poster sees this\)/), "Looked again");
    await u.click(screen.getByRole("button", { name: "Lift the suspension" }));
    await waitFor(() => expect(screen.getByText("Appeal accepted. The poster sees your reason.")).toBeTruthy());
    expect(screen.queryByText(/can appeal/)).toBeNull();
  });
  it.each([
    ["REMOVAL", "Put it back", "Keep it removed"],
    ["WARNING", "Remove the warning", "Keep the warning"],
    ["SUSPENSION", "Lift the suspension", "Keep it"],
  ])("an appeal about a %s says %s or %s, and nothing else", async (kind, undo, keep) => {
    const item = modItem("p", { queue: "APPEAL", targetType: "ANSWER", summary: "Appeal", reasons: [] });
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/action")) { sent.push(JSON.parse(String(init?.body))); return json(200, {}); }
      if (u.includes("/admin/moderation/items/")) return json(200, { ...modDetail(item), appealKind: kind });
      if (u.includes("/admin/moderation/items")) return json(200, { items: u.includes("queue=APPEAL") ? [item] : [], nextCursor: null, counts: { APPEAL: 1, open: 1, oldestOpenAt: null } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("tab", { name: /Appeals/ }));
    expect(await screen.findByRole("button", { name: undo })).toBeTruthy();
    expect(screen.getByRole("button", { name: keep })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Warn" })).toBeNull();
    await u.type(await screen.findByLabelText(/Reason \(the poster sees this\)/), "The warning stands");
    await u.click(screen.getByRole("button", { name: keep }));
    await waitFor(() => expect(screen.getByText("Appeal declined. The poster sees your reason.")).toBeTruthy());
    expect(sent).toEqual([{ action: "KEEP", reason: "The warning stands" }]);
  });
  it("a bare account report shows its report count", async () => {
    const it0 = modItem("r", { targetType: "USER", summary: "", reasons: ["other"], reportCount: 1 });
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["MODERATOR"]));
      if (u.includes("/admin/moderation/items/")) return json(200, modDetail(it0));
      if (u.includes("/admin/moderation/items")) return json(200, { items: [it0], nextCursor: null, counts: { REPORTED: 1, open: 1, oldestOpenAt: null } });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminModerationPage /></AdminFrame>);
    expect(await screen.findByText("Reported 1 time")).toBeTruthy();
    expect(screen.getByText("Report about an account")).toBeTruthy();
  });
});

const ad = (status: string) => ({ id: "a1", brand: "Zobo", kind: "FEED_CARD", status, live: false, headline: "Fresh zobo", body: null, linkUrl: "https://zobo.ng", ctaLabel: null, imageUrl: null, audioClipId: null, categoryIds: [], states: [], ageBands: [], startsOn: null, endsOn: null, frequencyCapPerDay: 3, priceKobo: null, views: 0, taps: 0, listens: 0, rejectReason: null, changeRequest: null, checks: [] });

describe("C-M8, C-L5: adverts", () => {
  it("an advert that waits can be edited, and the edit goes out as a PATCH", async () => {
    const sent: { method?: string; url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (u.endsWith("/me")) return json(200, me(["AD_MANAGER"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/ads/a1") && init?.method === "PATCH") {
        sent.push({ method: init.method, url: u, body: JSON.parse(String(init.body)) });
        return json(200, { ...ad("AWAITING_APPROVAL"), headline: "Cold zobo" });
      }
      if (u.includes("/admin/ads")) return json(200, { items: [ad("AWAITING_APPROVAL")], nextCursor: null, awaitingApproval: 1 });
      if (u.includes("/categories")) return json(200, { items: [] });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    const u = userEvent.setup();
    await u.click(await screen.findByRole("button", { name: "Edit advert" }));
    const headline = await screen.findByLabelText("Headline");
    expect((headline as HTMLInputElement).value).toBe("Fresh zobo");
    await u.clear(headline);
    await u.type(headline, "Cold zobo");
    await u.click(screen.getByRole("button", { name: "Save advert" }));
    await waitFor(() => expect(sent.length).toBe(1));
    // lead ruling WF, 6 Nov (C-M8): an edit sends only what changed.
    expect(sent[0].body).toEqual({ headline: "Cold zobo" });
  });
  it("an approved advert has no Edit control (the API wants it paused first)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["AD_MANAGER"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/ads")) return json(200, { items: [ad("APPROVED")], nextCursor: null, awaitingApproval: 0 });
      if (u.includes("/categories")) return json(200, { items: [] });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    await screen.findByRole("button", { name: "Pause" });
    expect(screen.queryByRole("button", { name: "Edit advert" })).toBeNull();
  });
  it("the empty state does not mention brands", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, me(["AD_MANAGER"]));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/ads")) return json(200, { items: [], nextCursor: null, awaitingApproval: 0 });
      if (u.includes("/categories")) return json(200, { items: [] });
      return json(404, NOT_FOUND);
    }));
    render(<AdminFrame><AdminAdsPage /></AdminFrame>);
    expect(await screen.findByText("No adverts yet")).toBeTruthy();
    expect(screen.queryByText(/Brands/)).toBeNull();
    for (const h of document.querySelectorAll("th")) expect(h.className).toContain("whitespace-nowrap");
  });
});

describe("C-L6: a suspended admin person", () => {
  it("gets a plain admin message, never the posting line", () => {
    const w = refusalWords(new ApiError(403, "ACCOUNT_SUSPENDED", "This account cannot post right now.", true));
    expect(w).toBe("This account is suspended, so changes are paused. Ask an admin for help.");
    expect(w).not.toMatch(/post/);
  });
});
