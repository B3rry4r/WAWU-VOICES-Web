// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

let path = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { AppShell } from "@/components/shell/AppShell";
import { PhoneBar } from "@/components/shell/ShellSlots";
import { announceUnread } from "@/components/shell/unread";

const SESSION = "voices-web-session";
const signIn = () => window.localStorage.setItem(SESSION, JSON.stringify({ accessToken: "t", refreshToken: "r" }));
const logoBar = () => document.querySelector("header.sh-topbar");

beforeEach(() => {
  apiFetch.mockReset();
  window.localStorage.clear();
  path = "/";
});
afterEach(cleanup);

describe("phone top bar rule", () => {
  it.each(["/", "/discover", "/profile", "/speak"])("%s shows the logo bar", (p) => {
    path = p;
    render(<AppShell>x</AppShell>);
    expect(logoBar()?.querySelector(".sh-topbar__logo")).toBeTruthy();
    expect(logoBar()?.className).not.toContain("sh-topbar--none");
  });
  it.each(["/notifications", "/weekly", "/q/abc", "/search", "/profile/edit", "/units/buy"])("%s hides it", (p) => {
    path = p;
    render(<AppShell>x</AppShell>);
    expect(logoBar()?.querySelector(".sh-topbar__logo")).toBeNull();
    expect(logoBar()?.className).toContain("sh-topbar--none");
  });
  it("a page's own PhoneBar still lands in the bar", () => {
    path = "/c/money";
    render(<AppShell><PhoneBar><span>Own bar</span></PhoneBar></AppShell>);
    expect(logoBar()?.textContent).toContain("Own bar");
    expect(logoBar()?.querySelector(".sh-topbar__logo")).toBeNull();
  });
  it("chromeless routes draw no shell", () => {
    path = "/sign-in";
    render(<AppShell>plain</AppShell>);
    expect(logoBar()).toBeNull();
  });
  it("full-screen routes have no tab bar", () => {
    path = "/q/abc/write";
    render(<AppShell>x</AppShell>);
    expect(document.querySelector(".sh-bottombar")).toBeNull();
  });
});

describe("side nav and bell", () => {
  it("has a Weekly report row that lights on /weekly", () => {
    path = "/weekly";
    render(<AppShell>x</AppShell>);
    const link = screen.getAllByText("Weekly report")[0].closest("a")!;
    expect(link.getAttribute("href")).toBe("/weekly");
    expect(link.getAttribute("aria-current")).toBe("page");
    const discover = document.querySelector('.sh-sidenav a[href="/discover"]')!;
    expect(discover.getAttribute("aria-current")).toBeNull();
  });
  it("a guest has no bell and no call is made", () => {
    render(<AppShell>x</AppShell>);
    expect(screen.queryByLabelText(/^Notifications/)).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("a signed-in person gets the bell to /notifications with a dot from the API", async () => {
    signIn();
    apiFetch.mockResolvedValue({ unread: 3 });
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications, 3 unread").length).toBeGreaterThan(0));
    expect(apiFetch.mock.calls[0][0]).toBe("/notifications/unread-count");
    const bell = screen.getAllByLabelText("Notifications, 3 unread")[0];
    expect(bell.getAttribute("href")).toBe("/notifications");
    expect(bell.querySelector('[data-testid="bell-dot"]')).toBeTruthy();
  });
  it("no dot at zero, and the bell follows the Notifications page", async () => {
    signIn();
    apiFetch.mockResolvedValue({ unread: 0 });
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications").length).toBeGreaterThan(0));
    expect(document.querySelector('[data-testid="bell-dot"]')).toBeNull();
    act(() => announceUnread(5));
    await waitFor(() => expect(document.querySelector('[data-testid="bell-dot"]')).toBeTruthy());
  });
});
