// @vitest-environment jsdom
// V-ADMIN-GATE: only a real refusal shows "could not find that"; a failed check retries, then offers "Try again".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AdminFrame } from "@/features/admin/AdminFrame";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ replace: () => undefined, push: () => undefined, back: () => undefined }), useSearchParams: () => new URLSearchParams("") }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const admin = { id: "u", handle: "ngozi.e", roles: ["ADMIN"], profile: { displayName: "Ngozi Eze" } };
const meCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter((c) => String(c[0]).endsWith("/me")).length;

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const settle = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("admin gate", () => {
  it("403 shows the not an admin page, with no retry", async () => {
    const f = vi.fn(async () => json(403, { error: { code: "FORBIDDEN", message: "no" } }));
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(5000);
    expect(screen.getByText("This account is not an admin")).toBeTruthy();
    expect(meCalls(f)).toBe(1);
  });
  it("401 that a refresh cannot fix shows the admin sign-in page", async () => {
    // /me answers 401, the refresh is refused: the session is cleared.
    const f = vi.fn(async (u: string) => (String(u).endsWith("/me") ? json(401, { error: { code: "UNAUTHORIZED", message: "no" } }) : json(401, { error: { code: "INVALID", message: "no" } })));
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(5000);
    expect(screen.getByRole("heading", { name: "VOICES admin" })).toBeTruthy();
    expect(meCalls(f)).toBe(1);
  });
  it("503 then success on the retry opens the admin", async () => {
    let n = 0;
    const f = vi.fn(async (u: string) => {
      if (String(u).endsWith("/me")) return ++n === 1 ? json(503, { error: { code: "UNAVAILABLE", message: "x" } }) : json(200, admin);
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(0);
    expect(screen.queryByText("We could not find that")).toBeNull();
    expect(screen.queryByText("We could not check your access")).toBeNull();
    await settle(1000);
    expect(meCalls(f)).toBe(2);
    expect(screen.queryByText("We could not find that")).toBeNull();
    expect(screen.getAllByText("secret").length).toBeGreaterThan(0);
  });
  it("503 three times shows Try again, never the admin, and the button checks again", async () => {
    let ok = false;
    const f = vi.fn(async (u: string) => (String(u).endsWith("/me") ? (ok ? json(200, admin) : json(503, { error: { code: "UNAVAILABLE", message: "x" } })) : json(404, { error: { code: "NOT_FOUND", message: "no" } })));
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(1000);
    await settle(3000);
    expect(meCalls(f)).toBe(3);
    expect(screen.getByText("We could not check your access")).toBeTruthy();
    expect(screen.queryByText("We could not find that")).toBeNull();
    expect(screen.queryByText("secret")).toBeNull();
    ok = true;
    await act(async () => { screen.getByRole("button", { name: "Try again" }).click(); });
    await settle(0);
    expect(meCalls(f)).toBe(4);
    expect(screen.getAllByText("secret").length).toBeGreaterThan(0);
  });
  it("a network error is retried twice then shows Try again", async () => {
    const f = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    vi.stubGlobal("fetch", f);
    render(<AdminFrame><p>secret</p></AdminFrame>);
    await settle(1000);
    await settle(3000);
    expect(meCalls(f)).toBe(3);
    expect(screen.getByText("We could not check your access")).toBeTruthy();
    expect(screen.queryByText("We could not find that")).toBeNull();
  });
});
