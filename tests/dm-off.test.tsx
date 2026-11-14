// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// Owner order, 14 Nov 2026: DMs are off. These run against the REAL DMS_LIVE value (no mock of live.ts).
let path = "/";
const notFound = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => notFound(),
}));
const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { DMS_LIVE } from "@/features/dm/live";
import { NAV } from "@/components/shell/nav";
import { AppShell } from "@/components/shell/AppShell";
import MessagesPage from "@/app/messages/page";
import ConversationRoute from "@/app/messages/[id]/page";
import NewMessageRoute from "@/app/messages/new/[userId]/page";

const signIn = () => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));

beforeEach(() => { apiFetch.mockReset(); apiFetch.mockResolvedValue({ unread: 0 }); notFound.mockClear(); window.localStorage.clear(); path = "/"; });
afterEach(cleanup);

describe("DMs are off", () => {
  it("the switch is false", () => { expect(DMS_LIVE).toBe(false); });

  it("the signed-in shell has no Messages entry and makes no /dm/ request", async () => {
    signIn();
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Notifications").length).toBeGreaterThan(0));
    expect(screen.queryByLabelText(/^Messages/)).toBeNull();
    expect(screen.queryByText("Messages")).toBeNull();
    expect(document.querySelector('a[href^="/messages"]')).toBeNull();
    expect(apiFetch.mock.calls.filter((c) => String(c[0]).includes("/dm/"))).toEqual([]);
  });

  it("the phone bar and the desktop rail list the same four items as before DMs", () => {
    render(<AppShell>x</AppShell>);
    const labels = [...document.querySelectorAll("nav a")].map((a) => a.textContent?.trim());
    expect(labels.filter((l) => l === "Messages")).toEqual([]);
    expect(NAV.map((n) => n.label)).toEqual(["Home", "Discover", "Speak", "Profile"]);
    expect(document.querySelectorAll('nav[aria-label="Main"] a[href="/messages"]').length).toBe(0);
  });

  it("the three message routes answer not-found", () => {
    expect(() => MessagesPage()).toThrow("NEXT_NOT_FOUND");
    expect(() => ConversationRoute({ params: { id: "c1" } })).toThrow("NEXT_NOT_FOUND");
    expect(() => NewMessageRoute({ params: { userId: "u1" } })).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(3);
  });
});
