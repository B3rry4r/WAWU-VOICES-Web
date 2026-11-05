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

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/weekly" }));
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
  it("a person with no admin role gets the not-found page and no admin chrome", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u.endsWith("/me") ? json(200, me([])) : json(403, { error: { code: "FORBIDDEN", message: "no" } }))));
    render(<AdminFrame><div>secret admin page</div></AdminFrame>);
    await waitFor(() => expect(screen.getByText("We could not find that")).toBeTruthy());
    expect(screen.queryByText("secret admin page")).toBeNull();
  });
  it("a guest gets the same page and makes no API call", async () => {
    window.localStorage.clear();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><div>secret admin page</div></AdminFrame>);
    await waitFor(() => expect(screen.getByText("We could not find that")).toBeTruthy());
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
