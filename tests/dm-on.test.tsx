// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

// The switch mocked ON: flipping DMS_LIVE later brings the entry and the routes back.
vi.mock("@/features/dm/live", () => ({ DMS_LIVE: true }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("@/features/dm/InboxPage", () => ({ InboxPage: () => <p>inbox</p> }));

import { AppShell } from "@/components/shell/AppShell";
import MessagesPage from "@/app/messages/page";

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation((url: string) => Promise.resolve({ unread: url === "/dm/unread" ? 2 : 0 }));
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
});
afterEach(cleanup);

describe("DMs on (switch mocked)", () => {
  it("the Messages entry is back and /dm/unread is asked", async () => {
    render(<AppShell>x</AppShell>);
    await waitFor(() => expect(screen.getAllByLabelText("Messages, 2 unread").length).toBeGreaterThan(0));
    expect(apiFetch.mock.calls.some((c) => c[0] === "/dm/unread")).toBe(true);
  });
  it("/messages renders the inbox", () => {
    render(<MessagesPage />);
    expect(screen.getByText("inbox")).toBeTruthy();
  });
});
