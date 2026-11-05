// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let path = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
const apiFetch = vi.fn().mockResolvedValue({ unread: 0 });
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { AppShell } from "@/components/shell/AppShell";

beforeEach(() => {
  window.localStorage.clear();
  path = "/";
});
afterEach(cleanup);

describe("guest entry in the shell", () => {
  it("a guest sees the country pill and Sign in coming back to this page", async () => {
    path = "/discover";
    render(<AppShell>x</AppShell>);
    const signIn = (await screen.findAllByRole("link", { name: "Sign in" }))[0];
    expect(signIn.getAttribute("href")).toBe("/sign-in?next=%2Fdiscover");
    const pill = screen.getAllByRole("link", { name: "Country: Nigeria. Change country" })[0];
    expect(pill.getAttribute("href")).toBe("/join/country");
    expect(screen.queryByRole("link", { name: /^Notifications/ })).toBeNull();
  });
  it("signed in: no Sign in, no country pill, the bell shows", async () => {
    window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
    render(<AppShell>x</AppShell>);
    expect((await screen.findAllByRole("link", { name: /^Notifications/ })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Country:/ })).toBeNull();
  });
  it("a sub-screen's phone bar is hidden but the desktop top row still has Sign in", async () => {
    path = "/weekly";
    render(<AppShell>x</AppShell>);
    expect((await screen.findAllByRole("link", { name: "Sign in" })).length).toBe(1);
  });
});
