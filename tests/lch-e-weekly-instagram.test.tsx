// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminWeeklyPage } from "@/features/admin/WeeklyPage";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/weekly" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = { id: "u", handle: "ngozi.e", roles: ["EDITOR"], profile: { displayName: "Ngozi Eze" } };
const report = (status: string) => ({
  id: "r1", topicId: "t1", weekNumber: 2, status, draftedAt: "2026-11-05T17:00:00Z", pollClosedAt: null, publishAt: "2026-11-09T17:00:00Z", headline: "H", mood: "M", summary: "S", themes: [], sentiment: null, pollSummary: null,
  quotes: [], basedOnVoices: 10, basedOnVotes: 5, languagesRead: ["English"], checks: [], emotions: [], cardTitle: null, editorNote: null,
});

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

function stub(status: string, calls: string[]) {
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${u}`);
    if (u.endsWith("/me")) return json(200, me);
    if (u.includes("/admin/today")) return json(200, null);
    if (u.endsWith("/instagram")) return new Response(new Blob(["zip"]), { status: 200, headers: { "content-type": "application/zip" } });
    if (u.includes("/admin/weekly-reports")) return json(200, { items: [report(status)], nextCursor: null });
    return json(404, { error: { code: "NOT_FOUND", message: "no" } });
  }));
}

describe("LCH-13: Download Instagram pictures", () => {
  it("is on a published report, asks for the zip with the token, and says nothing was posted", async () => {
    const calls: string[] = [];
    stub("PUBLISHED", calls);
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    const b = await screen.findByRole("button", { name: "Download Instagram pictures" });
    await userEvent.setup().click(b);
    await waitFor(() => expect(screen.getByText("The pictures are saved. Nothing has been posted.")).toBeTruthy());
    expect(calls.some((c) => c.endsWith("/admin/weekly-reports/r1/instagram"))).toBe(true);
  });
  it("is not offered on a draft", async () => {
    stub("DRAFT", []);
    render(<AdminFrame><AdminWeeklyPage /></AdminFrame>);
    await screen.findByRole("button", { name: "Hold" });
    expect(screen.queryByRole("button", { name: "Download Instagram pictures" })).toBeNull();
  });
});
