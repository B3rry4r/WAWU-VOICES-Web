// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiError, calls, cats, me, mockApi, profile, signIn } from "./w6-helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back: vi.fn() }), usePathname: () => "/" }));

import { MePage } from "@/features/profile/MePage";
import { PersonPage } from "@/features/profile/PersonPage";
import { SettingsPage } from "@/features/profile/SettingsPage";
import { EditProfilePage } from "@/features/profile/EditProfilePage";
import { RulesPage } from "@/features/profile/RulesPage";

beforeEach(() => { window.localStorage.clear(); push.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const answers = { items: [], nextCursor: null };
const meRoutes = { "GET /me": me, "GET /me/answers": answers, "GET /me/saved": answers, "GET /me/blocks": { items: [{ user: { ...profile, id: "u9", handle: "musa.d" }, blockedAt: "2026-11-04T10:00:00Z" }], nextCursor: null } };

describe("Me", () => {
  it("a guest sees a plain sign-in line, no profile call fails the page", async () => {
    mockApi({});
    render(<MePage />);
    expect(await screen.findByText("Sign in to see this")).toBeTruthy();
  });
  it("shows the figures from the API and no link to Voice Units until it is built", async () => {
    signIn(); mockApi(meRoutes);
    render(<MePage />);
    expect(await screen.findByText("@ada.okafor")).toBeTruthy();
    expect(screen.getByText("1,240")).toBeTruthy(); // reactions received
    expect(screen.getAllByText(/12\.5 units/).length).toBeGreaterThan(0);
    expect(document.querySelector('a[href="/wallet"]')).toBeNull();
    expect(document.querySelector('a[href="/profile/edit"]')).toBeTruthy();
    expect(await screen.findByText("No voices yet")).toBeTruthy();
  });
  it("Saved tab shows its empty state", async () => {
    signIn(); mockApi(meRoutes);
    render(<MePage />);
    await userEvent.click(await screen.findByRole("tab", { name: /Saved/ }));
    expect(await screen.findByText("Nothing saved yet")).toBeTruthy();
  });
  it("a pending deletion shows the 14-day words, not the profile", async () => {
    signIn(); mockApi({ "GET /me": { ...me, status: "DELETION_PENDING" } });
    render(<MePage />);
    expect(await screen.findByTestId("deletion-pending")).toBeTruthy();
    expect(screen.getAllByText(/14 days/).length).toBeGreaterThan(0);
    expect(screen.getByText(/unspent Voice Units are gone/)).toBeTruthy();
  });
  it("a load failure offers Try again", async () => {
    signIn(); mockApi({ "GET /me": () => apiError(500, "INTERNAL", "Something broke.") });
    render(<MePage />);
    expect(await screen.findByText("We could not load this")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });
});

describe("Person", () => {
  const tunde = { ...profile, id: "u2", handle: "tunde.a", displayName: "Tunde" };
  const page = (blocked = false) => ({ profile: tunde, isBlockedByMe: blocked, recentAnswers: [], nextCursor: null });
  it("a guest can read the profile but has no report or block menu", async () => {
    mockApi({ "GET /people/00000000-0000-4000-8000-000000000002": page() });
    render(<PersonPage segment="00000000-0000-4000-8000-000000000002" />);
    expect(await screen.findByText("@tunde.a")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /More: report or block/ })).toBeNull();
    const first = calls.find((c) => c.path.startsWith("/people/"));
    expect(first).toBeTruthy();
  });
  it("the blocker sees a minimal profile with Unblock and no posts", async () => {
    signIn(); mockApi({ "GET /people/00000000-0000-4000-8000-000000000002": page(true), "DELETE /me/blocks/u2": null });
    render(<PersonPage segment="00000000-0000-4000-8000-000000000002" />);
    expect(await screen.findByText("You blocked @tunde.a")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Unblock @tunde.a" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/me/blocks/u2")).toBe(true));
  });
  it("a signed-in viewer reports a person: USER target, reason and also-block go to POST /reports", async () => {
    signIn(); mockApi({ "GET /people/00000000-0000-4000-8000-000000000002": page(), "POST /reports": { id: "r1", status: "OPEN", blocked: true } });
    render(<PersonPage segment="00000000-0000-4000-8000-000000000002" />);
    await userEvent.click(await screen.findByRole("button", { name: "More: report or block @tunde.a" }));
    await userEvent.click(screen.getByRole("button", { name: "Report @tunde.a" }));
    const send = screen.getByRole("button", { name: "Send report" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await userEvent.click(screen.getByLabelText("Scam or spam"));
    await userEvent.click(screen.getByLabelText("Also block @tunde.a"));
    await userEvent.click(send);
    await waitFor(() => expect(calls.find((c) => c.path === "/reports")?.body).toEqual({ targetType: "USER", targetId: "u2", reason: "SCAM_OR_SPAM", alsoBlock: true }));
    expect(await screen.findByText("Thanks. We got your report.")).toBeTruthy();
  });
  it("an unknown handle says so", async () => {
    signIn(); mockApi({ "GET /search": { people: [], questions: [], answers: [], topics: [], totals: {}, nextCursor: null } });
    render(<PersonPage segment="nobody.here" />);
    expect(await screen.findByText("We could not find this person")).toBeTruthy();
  });
  it("a handle in the URL is resolved to the id through search, exact match only", async () => {
    signIn(); mockApi({ "GET /search": { people: [{ ...tunde, handle: "tunde.ab", id: "x" }, tunde], questions: [], answers: [], topics: [], totals: {}, nextCursor: null }, "GET /people/u2": page() });
    render(<PersonPage segment="tunde.a" />);
    expect(await screen.findByText("@tunde.a")).toBeTruthy();
    expect(calls.some((c) => c.path === "/people/u2")).toBe(true);
  });
});

describe("Settings", () => {
  it("saves a switch on toggle and puts it back when the save fails", async () => {
    signIn();
    let fail = false;
    mockApi({ ...meRoutes, "PATCH /me/settings": ({ body }: { body: unknown }) => (fail ? new Response("<html>", { status: 502 }) : { ...me.settings, ...(body as object) }) });
    render(<SettingsPage />);
    const sw = (await screen.findByRole("switch", { name: /Flash polls/ })) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    await userEvent.click(sw);
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ notifyFlashPolls: true }));
    fail = true;
    await userEvent.click(screen.getByRole("switch", { name: /Poll results/ }));
    expect(await screen.findByText("Could not save that change. Try again.")).toBeTruthy();
    expect((screen.getByRole("switch", { name: /Poll results/ }) as HTMLInputElement).checked).toBe(true);
  });
  it("shows only built rows: no ad-free pass, and the legal rows only for pages that exist", async () => {
    signIn(); mockApi(meRoutes);
    render(<SettingsPage />);
    await screen.findByText("Community rules");
    for (const t of ["Ad-free pass", "Help and contact"]) expect(screen.queryByText(t)).toBeNull();
    for (const h of ["rules", "terms", "privacy", "refunds"]) expect(document.querySelector(`a[href="/settings/legal/${h}"]`)).toBeTruthy();
  });
  it("appearance saves the theme and applies it at once", async () => {
    signIn(); mockApi({ ...meRoutes, "PATCH /me/settings": ({ body }: { body: unknown }) => ({ ...me.settings, ...(body as object) }) });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("tab", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ theme: "dark" }));
  });
  it("delete says the 14-day rule and the unit loss before confirm, needs the handle and the tick, then shows the pending screen", async () => {
    signIn(); mockApi({ ...meRoutes, "DELETE /me": () => new Response(null, { status: 202 }) });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Delete account/ }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getAllByText(/14 days/).length).toBeGreaterThan(0);
    expect(dlg.getByText(/unspent Voice Units are gone/)).toBeTruthy();
    const go = dlg.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await userEvent.type(dlg.getByLabelText(/Type @ada.okafor to confirm/), "ada.okafor");
    expect(go.disabled).toBe(true);
    await userEvent.click(dlg.getByLabelText(/I understand my unspent Voice Units will be lost/));
    expect(go.disabled).toBe(false);
    await userEvent.click(go);
    await waitFor(() => expect(calls.find((c) => c.method === "DELETE" && c.path === "/me")?.body).toEqual({ confirmHandle: "ada.okafor", understandUnitsForfeited: true }));
    expect(await screen.findByTestId("deletion-pending")).toBeTruthy();
  });
  it("the last admin's refusal is shown in the server's words", async () => {
    signIn(); mockApi({ ...meRoutes, "DELETE /me": () => apiError(409, "CONFLICT", "You are the only admin. Give the admin role to someone else before you delete your account.") });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Delete account/ }));
    const dlg = within(await screen.findByRole("dialog"));
    await userEvent.type(dlg.getByLabelText(/Type @ada.okafor/), "ada.okafor");
    await userEvent.click(dlg.getByLabelText(/I understand/));
    await userEvent.click(dlg.getByRole("button", { name: "Delete my account" }));
    expect(await dlg.findByText(/only admin/)).toBeTruthy();
  });
  it("blocked accounts list unblocks one person", async () => {
    signIn(); mockApi({ ...meRoutes, "DELETE /me/blocks/u9": null });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Blocked accounts/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Unblock @musa.d" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/me/blocks/u9")).toBe(true));
    expect(await screen.findByText("You have not blocked anyone.")).toBeTruthy();
  });
  it("export polls until ready, then offers the download", async () => {
    signIn();
    let n = 0;
    mockApi({ ...meRoutes, "POST /me/export": { id: "e", status: "PENDING", downloadUrl: null, requestedAt: "x" }, "GET /me/export": () => (++n < 1 ? { status: "PENDING" } : { id: "e", status: "READY", downloadUrl: "https://files.example/e.zip", requestedAt: "x" }) });
    render(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Export my data/ }));
    const a = (await screen.findByText("Download my data")) as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("https://files.example/e.zip");
  });
});

describe("Edit profile, more", () => {
  it("a pending deletion shows the pending screen, not the form", async () => {
    signIn(); mockApi({ ...meRoutes, "GET /me": { ...me, status: "DELETION_PENDING" } });
    render(<EditProfilePage />);
    expect(await screen.findByTestId("deletion-pending")).toBeTruthy();
    expect(screen.queryByLabelText("Handle")).toBeNull();
  });
  it("a reserved handle says it is not available, not taken", async () => {
    signIn(); mockApi({ ...meRoutes, "GET /categories": cats, "GET /me/categories": { categories: [] }, "GET /me/handle-check": { handle: "admin", available: false, reason: "RESERVED" } });
    render(<EditProfilePage />);
    const f = await screen.findByLabelText("Handle");
    await userEvent.clear(f); await userEvent.type(f, "admin");
    expect(await screen.findByText("That handle is not available.")).toBeTruthy();
  });
});

describe("Rules", () => {
  it("has the six rules and the four steps, the four legal tabs (all built) and no date until the owner approves the text", () => {
    render(<RulesPage />);
    expect(screen.getAllByRole("listitem").length).toBe(10);
    expect(screen.getByText("Speak your mind, disagree hard")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Rules", "Terms", "Privacy", "Refunds"]);
    expect(screen.queryByText("Report a problem")).toBeNull();
    expect(screen.queryByText(/Last updated/)).toBeNull();
  });
});

describe("EditProfile", () => {
  const routes = (extra = {}) => ({ ...meRoutes, "GET /categories": cats, "GET /me/categories": { categories: [{ categoryId: "c0", alertsOn: true }, { categoryId: "c1", alertsOn: true }, { categoryId: "c2", alertsOn: false }] }, ...extra });
  it("a taken handle shows the message and blocks Save", async () => {
    signIn(); mockApi(routes({ "GET /me/handle-check": { handle: "tunde.a", available: false } }));
    render(<EditProfilePage />);
    const f = await screen.findByLabelText("Handle");
    await userEvent.clear(f); await userEvent.type(f, "tunde.a");
    expect(await screen.findByText("That handle is taken.")).toBeTruthy();
    expect((screen.getAllByRole("button", { name: "Save changes" }).at(-1) as HTMLButtonElement).disabled).toBe(true);
  });
  it("bad characters are refused before any call", async () => {
    signIn(); mockApi(routes());
    render(<EditProfilePage />);
    const f = await screen.findByLabelText("Handle");
    await userEvent.clear(f); await userEvent.type(f, "ada!");
    expect(await screen.findByText(/only letters, numbers, dots and underscores/i)).toBeTruthy();
    expect(calls.some((c) => c.path === "/me/handle-check")).toBe(false);
  });
  it("needs 3 topics and sends only what changed", async () => {
    signIn(); mockApi(routes({ "PATCH /me/profile": profile, "PUT /me/categories": {} }));
    render(<EditProfilePage />);
    const place = await screen.findByLabelText("Where you are (optional)");
    await userEvent.clear(place); await userEvent.type(place, "Kano");
    await userEvent.click(screen.getByRole("button", { name: "Love" })); // 4 topics
    await userEvent.click(screen.getByRole("button", { name: "Love" })); // back to 3
    await userEvent.click(screen.getByRole("button", { name: "Money" })); // 2 topics: too few
    expect(await screen.findByText("Pick at least 3 topics.")).toBeTruthy();
    expect((screen.getAllByRole("button", { name: "Save changes" }).at(-1) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Money" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Save changes" }).at(-1)!);
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH" && c.path === "/me/profile")?.body).toEqual({ state: "Kano", city: null }));
    expect(calls.some((c) => c.path === "/me/categories" && c.method === "PUT")).toBe(false);
    expect(await screen.findByText("Profile saved")).toBeTruthy();
  });
  it("shows the photo control now that the API confirms uploads (POST /uploads/{fileId}/complete)", async () => {
    signIn(); mockApi(routes());
    render(<EditProfilePage />);
    await screen.findByLabelText("Handle");
    expect(screen.getByText("Add photo")).toBeTruthy();
  });
});
