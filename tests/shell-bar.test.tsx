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
/** The two unread calls the bar makes, answered by address: the bell asks /notifications/unread-count, the messages icon /dm/unread. */
const unreadAnswers = (bell: number, dm = 0) => apiFetch.mockImplementation((url: string) => Promise.resolve(url === "/dm/unread" ? { unread: dm } : { unread: bell }));
const callsTo = (url: string) => apiFetch.mock.calls.filter((c) => c[0] === url).length;
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
    unreadAnswers(3);
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications, 3 unread").length).toBeGreaterThan(0));
    expect(apiFetch.mock.calls.map((c) => c[0]).sort()).toEqual(["/dm/unread", "/notifications/unread-count"]);
    const bell = screen.getAllByLabelText("Notifications, 3 unread")[0];
    expect(bell.getAttribute("href")).toBe("/notifications");
    expect(bell.querySelector('[data-testid="bell-dot"]')).toBeTruthy();
  });
  it("no dot at zero, and the bell follows the Notifications page", async () => {
    signIn();
    unreadAnswers(0);
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications").length).toBeGreaterThan(0));
    expect(document.querySelector('[data-testid="bell-dot"]')).toBeNull();
    act(() => announceUnread(5));
    await waitFor(() => expect(document.querySelector('[data-testid="bell-dot"]')).toBeTruthy());
  });
});

describe("one source for the bell", () => {
  it("phone and desktop bells share one unread call per mount, and the two messages icons share one /dm/unread call", async () => {
    signIn();
    unreadAnswers(2, 4);
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications, 2 unread").length).toBe(2));
    await waitFor(() => expect(screen.getAllByLabelText("Messages, 4 unread").length).toBe(2));
    expect(callsTo("/notifications/unread-count")).toBe(1);
    expect(callsTo("/dm/unread")).toBe(1);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
  it("a guest makes neither call", () => {
    render(<AppShell>x</AppShell>);
    expect(callsTo("/notifications/unread-count") + callsTo("/dm/unread")).toBe(0);
    expect(screen.queryByLabelText(/^Messages/)).toBeNull();
  });
  it("the bell is lit on /notifications", async () => {
    signIn();
    path = "/notifications";
    unreadAnswers(0);
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications").length).toBeGreaterThan(0));
    for (const b of screen.getAllByLabelText("Notifications")) {
      expect(b.getAttribute("aria-current")).toBe("page");
      expect(b.className).toContain("sh-iconbtn--on");
    }
  });
});
