// @vitest-environment jsdom
// ADMIN-LOGIN: no session shows the admin sign-in page; a session without a role shows "not an admin"; an admin is unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminFrame } from "@/features/admin/AdminFrame";

const nav = vi.hoisted(() => ({ path: "/admin", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ replace: nav.replace, push: nav.replace, back: () => undefined }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const admin = { id: "u", handle: "ngozi.e", roles: ["ADMIN"], profileComplete: true, profile: { displayName: "Ngozi Eze" } };
const plain = { id: "p", handle: "tunde.a", roles: [], profileComplete: true, profile: { displayName: "Tunde" } };
const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => String(c[0]));
const adminCalls = (f: ReturnType<typeof vi.fn>) => urls(f).filter((u) => /\/admin\//.test(u));
const signedIn = () => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => { vi.useFakeTimers(); nav.path = "/admin"; nav.replace.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("admin sign-in page", () => {
  for (const path of ["/admin", "/admin/money"]) {
    it(`no session at ${path} shows the sign-in page and calls nothing`, async () => {
      nav.path = path;
      const f = vi.fn(async () => json(404, {}));
      vi.stubGlobal("fetch", f);
      render(<AdminFrame><p>secret</p></AdminFrame>);
      await settle(0);
      expect(screen.getByRole("heading", { name: "VOICES admin" })).toBeTruthy();
      expect(screen.getByText("Sign in with your WAWU ID. Only admin accounts can open this area.")).toBeTruthy();
      expect(screen.getByLabelText("Password")).toBeTruthy();
      expect(screen.queryByText("We could not find that")).toBeNull();
      expect(screen.queryByText("secret")).toBeNull();
      expect(screen.queryByText("Join VOICES")).toBeNull();
      expect(f).not.toHaveBeenCalled();
    });
  }

  it("after sign-in the router goes to the admin address asked for, and the gate checks the new session", async () => {
    nav.path = "/admin/money";
    let loggedIn = false;
    const f = vi.fn(async (u: string) => {
      const url = String(u);
      if (url.endsWith("/auth/login")) { loggedIn = true; return json(200, { accessToken: "a", refreshToken: "b", user: { id: "1", fullName: "N", email: "n@x.ng", phone: "+2348000000000", status: "ACTIVE" } }); }
      if (url.endsWith("/me")) return loggedIn ? json(200, admin) : json(401, {});
      return json(404, {});
    });
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    fireEvent.change(screen.getByLabelText("Email or phone number"), { target: { value: "n@x.ng" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
    await settle(0);
    expect(nav.replace).toHaveBeenCalledWith("/admin/money");
    expect(screen.getAllByText("secret").length).toBeGreaterThan(0);
  });

  it("signed in without a role shows the not an admin page and calls no admin API", async () => {
    signedIn();
    const f = vi.fn(async (u: string) => (String(u).endsWith("/me") ? json(200, plain) : json(404, {})));
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    expect(screen.getByRole("heading", { name: "This account is not an admin" })).toBeTruthy();
    expect(screen.getByText(/You are signed in as @tunde\.a\. Ask an admin to give this account access, or sign in with another account\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to VOICES" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("secret")).toBeNull();
    expect(adminCalls(f)).toEqual([]);
    await act(async () => { screen.getByRole("button", { name: "Sign in with another account" }).click(); });
    await settle(0);
    expect(window.localStorage.getItem("voices-web-session")).toContain("null");
    expect(screen.getByRole("heading", { name: "VOICES admin" })).toBeTruthy();
    expect(screen.queryByText("We could not find that")).toBeNull();
  });

  it("an admin sees the area and can sign out to the sign-in page", async () => {
    signedIn();
    const f = vi.fn(async (u: string) => (String(u).endsWith("/me") ? json(200, admin) : json(404, {})));
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    expect(screen.getAllByText("secret").length).toBeGreaterThan(0);
    await act(async () => { screen.getAllByRole("button", { name: "Sign out" })[0].click(); });
    await settle(0);
    expect(screen.getByRole("heading", { name: "VOICES admin" })).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("a failed check with a session retries, offers Try again and never shows the sign-in page", async () => {
    signedIn();
    const f = vi.fn(async () => json(503, { error: { code: "UNAVAILABLE", message: "x" } }));
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    expect(screen.queryByRole("heading", { name: "VOICES admin" })).toBeNull();
    await settle(1000);
    await settle(3000);
    expect(screen.getByText("We could not check your access")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "VOICES admin" })).toBeNull();
    expect(screen.queryByText("This account is not an admin")).toBeNull();
  });
});
