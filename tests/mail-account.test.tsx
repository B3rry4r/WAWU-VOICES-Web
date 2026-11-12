// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";

vi.hoisted(() => { process.env.NEXT_PUBLIC_WAWU_ID_BASE = "http://127.0.0.1:15060"; });

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { WawuIdStandIn } from "./support/wawu-id-standin";
import { ForgotPassword } from "@/features/entry/ForgotPassword";
import { ResetPassword } from "@/features/entry/ResetPassword";
import { SignIn } from "@/features/entry/SignIn";
import { register, signIn, signOut, startEmailVerification, confirmEmailVerification } from "@/lib/api/auth";

/*
 * Ma2 (V-44): Forgot password and the reset page on VOICES, and `app: "voices"` on every WAWU ID call, so a VOICES person
 * gets VOICES' reset mail and never meets the WHO MADE THIS site. WAWU ID is a local stand-in over real HTTP.
 */
const idp = new WawuIdStandIn(15060);
beforeAll(async () => { await idp.start(); });
afterAll(async () => { await idp.stop(); });

const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const QUESTION = { id: "q1", text: "When salary arrives, how many hours pass before it disappears?", voiceCount: 12480, endsAt: new Date(Date.now() + 9 * 3600e3).toISOString(), category: null, recentVoices: [] };

beforeEach(() => {
  search = "";
  push.mockClear(); replace.mockClear(); back.mockClear();
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    if (String(input).startsWith(idp.url)) return realFetch(input, init);
    return String(input).endsWith("/questions/today") ? json(QUESTION) : json({ error: { code: "NOT_FOUND", message: "no" } }, 404);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); idp.users.clear(); idp.resetTokens.clear(); idp.calls.length = 0; });

const idCalls = (path: string) => idp.calls.filter((c) => c.path === path);

describe("Forgot password", () => {
  it("is linked from Sign in, and only from Sign in", async () => {
    render(<SignIn />);
    const link = (await screen.findByRole("link", { name: "Forgot password?" })) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/forgot-password");
    cleanup();
    search = "mode=join";
    render(<SignIn />);
    await screen.findByRole("button", { name: "Send code" });
    expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
  });

  it("asks WAWU ID for an email link as VOICES and says the same thing for any address", async () => {
    idp.seed("ada@example.com", "old-password-1", "Ada Okafor", "+2348032147720");
    render(<ForgotPassword />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "Ada@Example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));
    await screen.findByText("Check your email");
    expect(idCalls("/auth/forgot-password")[0].body).toEqual({ identifier: "ada@example.com", method: "email", app: "voices" });
    expect(screen.getByText(/It works for 1 hour and can only be used once/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/—|WHO MADE THIS|Who Made This|wawuafrica/);
    cleanup();
    render(<ForgotPassword />);
    await user.type(await screen.findByLabelText("Email"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Send link" }));
    await screen.findByText("Check your email");
  });

  it("checks the email before asking", async () => {
    render(<ForgotPassword />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send link" }));
    expect(await screen.findByText("Enter the email address on your account.")).toBeTruthy();
    expect(idCalls("/auth/forgot-password")).toHaveLength(0);
  });
});

describe("Reset password", () => {
  it("takes the token and email from the link, sets the password, and a second use of the link is refused", async () => {
    idp.seed("ada@example.com", "old-password-1", "Ada Okafor", "+2348032147720");
    idp.resetTokens.set("ada@example.com", "tok-123");
    search = "token=tok-123&email=ada%40example.com";
    render(<ResetPassword />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("New password"), "short");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Use at least 8 characters.")).toBeTruthy();
    expect(idCalls("/auth/reset-password")).toHaveLength(0);
    await user.clear(screen.getByLabelText("New password"));
    await user.type(screen.getByLabelText("New password"), "a-new-password-9");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("Your password is changed");
    expect(idCalls("/auth/reset-password")[0].body).toEqual({ token: "tok-123", email: "ada@example.com", password: "a-new-password-9", app: "voices" });
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    expect(window.localStorage.getItem("voices-web-session")).toBeNull();
    // the same link again: WAWU ID refuses it (401), and the page says so
    cleanup();
    render(<ResetPassword />);
    await user.type(await screen.findByLabelText("New password"), "another-password-9");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("The link has expired or was already used");
    expect(screen.getByRole("link", { name: "Send a new link" }).getAttribute("href")).toBe("/forgot-password");
  });

  it("says the link does not work when the token or email is missing, without calling WAWU ID", async () => {
    search = "email=ada%40example.com";
    render(<ResetPassword />);
    await screen.findByText("The link has expired or was already used");
    expect(idp.calls).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/—/);
  });
});

describe("app: voices on every WAWU ID call", () => {
  it("sends it on register, the email code, confirm, sign-in and sign-out, and the token refresh body carries it too", async () => {
    await register({ fullName: "Ada Okafor", email: "ada@example.com", phoneNational: "8032147720", password: "old-password-1", country: "Nigeria", dialCode: "+234" });
    await startEmailVerification("ada@example.com");
    await confirmEmailVerification("ada@example.com", "123456");
    signOut();
    await signIn("ada@example.com", "old-password-1");
    await waitFor(() => expect(idCalls("/auth/logout").length).toBeGreaterThan(0));
    const named = idp.calls;
    // the refresh call is made by the client's own fetch (src/lib/api/client.ts); read its body here
    expect(readFileSync("src/lib/api/client.ts", "utf8")).toContain('JSON.stringify({ refreshToken: current, app: "voices" })');
    expect(named.length).toBeGreaterThanOrEqual(5);
    for (const c of named) expect((c.body as { app?: string }).app, c.path).toBe("voices");
  });
});
