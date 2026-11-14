// @vitest-environment jsdom
// ADMIN-LOGIN-FIX: showing the admin sign-in form leaves nothing behind; an ordinary sign-in or join never goes to /admin;
// the admin's own unverified-email detour comes back to the admin address, profile or not.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { SignIn } from "@/features/entry/SignIn";
import { Verify } from "@/features/entry/Verify";
import { holdReturn, peekReturn, takeReturn, holdAdminReturn, takeAdminReturn, saveDraft } from "@/lib/auth/entry-draft";

const nav = vi.hoisted(() => ({ path: "/admin", search: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ replace: nav.replace, push: nav.push, back: () => undefined }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const USER = { id: "1", fullName: "N", email: "n@x.ng", phone: "+2348000000000", status: "ACTIVE" };
const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const held = () => window.sessionStorage.getItem("voices-return-to");

function stubApi(opts: { unverified?: boolean; profileComplete?: boolean; admin?: boolean } = {}) {
  let loggedIn = false;
  const f = vi.fn(async (u: string) => {
    const url = String(u);
    if (url.endsWith("/auth/login")) {
      if (opts.unverified) return json(403, { statusCode: 403, message: "Verify your email", code: "EMAIL_NOT_VERIFIED" });
      loggedIn = true;
      return json(200, { accessToken: "a", refreshToken: "b", user: USER });
    }
    if (url.endsWith("/me")) return loggedIn ? json(200, { id: "1", handle: "h", roles: opts.admin ? ["ADMIN"] : [], profileComplete: opts.profileComplete ?? true, profile: { displayName: "N" } }) : json(401, {});
    if (url.includes("/admin/")) return json(404, {});
    return json(200, {});
  });
  vi.stubGlobal("fetch", f);
  return f;
}
async function typeAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email or phone number"), { target: { value: "n@x.ng" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longenough" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in" })); });
  await settle(0);
}

beforeEach(() => { vi.useFakeTimers(); nav.path = "/admin/money"; nav.search = ""; nav.replace.mockClear(); nav.push.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear(); window.sessionStorage.clear(); });

describe("the admin form leaves nothing behind", () => {
  it("showing it writes nothing to sessionStorage", async () => {
    stubApi();
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    expect(screen.getByRole("heading", { name: "VOICES admin" })).toBeTruthy();
    expect(held()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("a: guest opens /admin/money, leaves, signs in the ordinary way: lands on Home", async () => {
    stubApi();
    const first = render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    first.unmount();
    nav.path = "/sign-in";
    render(<SignIn />);
    await settle(0);
    await typeAndSubmit();
    expect(nav.replace).toHaveBeenCalledWith("/");
    expect(nav.replace).not.toHaveBeenCalledWith(expect.stringMatching(/^\/admin/));
  });

  it("a: with ?next= the ordinary sign-in goes to the page asked for", async () => {
    stubApi();
    nav.path = "/sign-in";
    nav.search = "next=%2Fq%2Fabc";
    render(<SignIn />);
    await settle(0);
    await typeAndSubmit();
    expect(nav.replace).toHaveBeenCalledWith("/q/abc");
  });

  it("a stale /admin value from the live build is ignored and removed by an ordinary sign-in", async () => {
    window.sessionStorage.setItem("voices-return-to", "/admin/money");
    window.sessionStorage.setItem("voices-return-kind", "page");
    stubApi();
    nav.path = "/sign-in";
    render(<SignIn />);
    await settle(0);
    expect(held()).toBeNull();
    await typeAndSubmit();
    expect(nav.replace).toHaveBeenCalledWith("/");
    expect(held()).toBeNull();
  });

  it("the ordinary return never reads a value inside /admin, even one set after the form mounted", () => {
    window.sessionStorage.setItem("voices-return-to", "/admin/money");
    expect(peekReturn()).toBeNull();
    expect(takeReturn()).toBeNull();
    expect(held()).toBeNull();
    holdAdminReturn("/admin/money");
    expect(peekReturn()).toBeNull();
    expect(takeReturn()).toBeNull();
  });

  it("b: an admin return left from a detour is dropped when a person joins the ordinary way", async () => {
    holdAdminReturn("/admin/money");
    stubApi();
    nav.path = "/sign-in";
    nav.search = "mode=join";
    render(<SignIn />);
    await settle(0);
    expect(held()).toBeNull();
    expect(takeAdminReturn()).toBeNull();
  });

  it("the return paths that already work keep working", () => {
    holdReturn("/speak?q=1", "post");
    expect(peekReturn()).toBe("/speak?q=1");
    expect(takeReturn()).toBe("/speak?q=1");
    expect(takeReturn()).toBeNull();
    holdAdminReturn("/elsewhere");
    expect(held()).toBeNull();
    holdAdminReturn("/admin/money?x=1#a");
    expect(takeAdminReturn()).toBe("/admin/money?x=1#a");
  });

  it("c: an admin signs in at /admin/money and lands on /admin/money", async () => {
    stubApi({ admin: true });
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    await typeAndSubmit();
    expect(nav.replace).toHaveBeenCalledWith("/admin/money");
    expect(held()).toBeNull();
  });
});

describe("the admin email detour", () => {
  it("holds the admin return only then, and the code step brings an admin with no profile back to it", async () => {
    stubApi({ unverified: true });
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    expect(held()).toBeNull();
    await typeAndSubmit();
    expect(nav.push).toHaveBeenCalledWith("/join/verify");
    expect(held()).toBe("/admin/money");
    cleanup();

    // the code step: the code is accepted, the account has no VOICES profile
    saveDraft({ email: "n@x.ng", codeSentAt: Date.now(), codeLifeSec: 300 });
    const f = vi.fn(async (u: string) => {
      const url = String(u);
      if (url.includes("/verify/confirm") || url.includes("confirm")) return json(200, { data: { accessToken: "a", refreshToken: "b", user: USER } });
      if (url.endsWith("/me")) return json(200, { id: "1", handle: "h", roles: ["ADMIN"], profileComplete: false, profile: null });
      return json(200, {});
    });
    vi.stubGlobal("fetch", f);
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    render(<Verify />);
    await settle(0);
    // already signed in and the admin return held: goes straight on to the admin address
    expect(nav.replace).toHaveBeenCalledWith("/admin/money");
    expect(nav.replace).not.toHaveBeenCalledWith("/join/topics");
  });

  it("finding 4: the query string and hash of the admin address come back", async () => {
    nav.path = "/admin/money";
    window.history.replaceState(null, "", "/admin/money?x=1#a");
    stubApi({ admin: true });
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    await typeAndSubmit();
    expect(nav.replace).toHaveBeenCalledWith("/admin/money?x=1#a");
    window.history.replaceState(null, "", "/");
  });
});
