// @vitest-environment jsdom
// The Users screen: everyone newest first, the numbers, search, paging, and the same refusal Money gives a non-admin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminUsersPage } from "@/features/admin/UsersPage";
import { ADMIN_PAGES, canOpen } from "@/features/admin/roles";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const me = (roles: string[]) => ({ id: "u", handle: "ada.admin", roles, profile: { displayName: "Ada Admin" } });

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const person = (n: number, over: Record<string, unknown> = {}) => ({
  profile: { id: `id-${n}`, handle: `person.${n}`, displayName: null, countryCode: "NG", languages: [], joinedAt: "2026-11-13T10:00:00Z", voiceCount: 0, replyCount: 0, reactionsReceived: 0 },
  status: "ACTIVE",
  roles: [],
  strikes: 0,
  createdAt: "2026-11-13T10:30:00Z",
  mailTo: `person${n}@example.com`,
  displayName: `Person ${n}`,
  state: "Lagos",
  verified: false,
  postCount: n,
  hasProfile: true,
  ...over,
});
const COUNTS = { total: 1234, today: 7, verified: 56, byStatus: { ACTIVE: 1200, SUSPENDED: 20, BANNED: 4, DELETION_PENDING: 5, DELETED: 5 } };

type Call = { url: string };
function stub(users: (url: URL) => Response, roles = ["ADMIN"]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      calls.push({ url: u });
      if (u.endsWith("/me")) return json(200, me(roles));
      if (u.includes("/admin/today")) return json(200, null);
      if (u.includes("/admin/users")) return users(new URL(u, "http://x"));
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }),
  );
  return calls;
}
const page = (items: unknown[], extra: Record<string, unknown> = {}) => json(200, { items, nextCursor: null, total: items.length, counts: COUNTS, ...extra });
const mount = () => render(<AdminFrame><AdminUsersPage /></AdminFrame>);

describe("Users page", () => {
  it("is in the nav for admins only", () => {
    expect(ADMIN_PAGES.some((p) => p.id === "users" && p.href === "/admin/users")).toBe(true);
    expect(canOpen(["ADMIN"], "users")).toBe(true);
    for (const r of ["EDITOR", "MODERATOR", "AD_MANAGER"] as const) expect(canOpen([r], "users")).toBe(false);
  });

  it("lists people from the API with the three numbers", async () => {
    stub(() => page([person(1, { verified: true, status: "SUSPENDED" }), person(2, { displayName: null, mailTo: null, state: null, hasProfile: false })]));
    mount();
    expect(await screen.findByText("Person 1")).toBeTruthy();
    expect(screen.getByTestId("users-all").textContent).toContain("1,234");
    expect(screen.getByTestId("users-today").textContent).toContain("7");
    expect(screen.getByTestId("users-verified").textContent).toContain("56");
    const t = screen.getByRole("table", { name: "Users" });
    expect(within(t).getByText("person1@example.com")).toBeTruthy();
    expect(within(t).getByText("@person.1")).toBeTruthy();
    expect(within(t).getByLabelText("Verified")).toBeTruthy();
    expect(within(t).getByText("Suspended")).toBeTruthy();
    // a person with no name yet is still listed
    expect(within(t).getByText("No name yet")).toBeTruthy();
    // 13 Nov 2026 10:30 UTC is 11:30am in Lagos
    expect(within(t).getAllByText("13 Nov 2026, 11:30am").length).toBe(2);
    const link = within(t).getByText("Person 1").closest("a");
    expect(link?.getAttribute("href")).toBe("/admin/money/wallets?handle=person.1");
    expect(document.body.textContent).not.toMatch(/—|Rant/);
  });

  it("searches and filters by status, and says how many match", async () => {
    const calls = stub((u) => (u.searchParams.get("q") === "chioma" ? page([person(3)], { total: 1 }) : page([person(1), person(2)])));
    mount();
    await screen.findByText("Person 1");
    await userEvent.type(screen.getByLabelText("Search"), "chioma");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Person 3")).toBeTruthy();
    expect(screen.queryByText("Person 1")).toBeNull();
    expect(screen.getByTestId("users-match").textContent).toBe("1 person matches");
    expect(calls.some((c) => c.url.includes("q=chioma"))).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText("Status"), "BANNED");
    await waitFor(() => expect(calls.some((c) => c.url.includes("status=BANNED") && c.url.includes("q=chioma"))).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("Person 1")).toBeTruthy();
  });

  it("shows more with the cursor", async () => {
    const calls = stub((u) => (u.searchParams.get("cursor") === "c1" ? page([person(3)], { nextCursor: null }) : page([person(1), person(2)], { nextCursor: "c1", total: 3 })));
    mount();
    await screen.findByText("Person 2");
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Person 3")).toBeTruthy();
    expect(screen.getByText("Person 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(calls.filter((c) => c.url.includes("cursor=c1"))).toHaveLength(1);
  });

  it("says so when no one is there, and when a search finds no one", async () => {
    stub((u) => page([], { total: 0, counts: { ...COUNTS, total: 0 } }));
    mount();
    expect(await screen.findByText("No one has registered yet")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Search"), "zzz");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("No one found")).toBeTruthy();
  });

  it("shows an error with Try again, and loads again", async () => {
    let fail = true;
    stub(() => (fail ? json(500, { error: { code: "INTERNAL", message: "no", requestId: "r" } }) : page([person(1)])));
    mount();
    expect(await screen.findByText("This did not load")).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Person 1")).toBeTruthy();
  });

  it("is refused for a non-admin, the way Money is, and no users call is made", async () => {
    const calls = stub(() => page([person(1)]), ["EDITOR"]);
    mount();
    expect(await screen.findByText("We could not find that")).toBeTruthy();
    expect(calls.some((c) => c.url.includes("/admin/users"))).toBe(false);
  });
});
