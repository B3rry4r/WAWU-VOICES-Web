// @vitest-environment jsdom
// G1 round 1: Weekly, Weekly archive, Newsroom, Live results, Notifications say the busy words when the API is down or busy.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const down = (status: number) => vi.fn(async () => new Response(status === 502 ? "<html>Bad gateway</html>" : JSON.stringify({ error: { code: "UNAVAILABLE", message: "We are busy. Try again in a minute.", requestId: "x" } }), { status, headers: { "content-type": status === 502 ? "text/html" : "application/json" } }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const h = (C: (p: object) => JSX.Element, props: object) => <C {...props} />;

async function pages() {
  return [
    ["Weekly", (await import("@/features/reach/WeeklyPage")).WeeklyPage, {}],
    ["Weekly archive", (await import("@/features/reach/WeeklyArchivePage")).WeeklyArchivePage, {}],
    ["Newsroom", (await import("@/features/news/NewsroomPage")).NewsroomPage, {}],
    ["Live results", (await import("@/features/results/LiveResultsPage")).LiveResultsPage, { threadId: "t1" }],
    ["Notifications", (await import("@/features/notifications/NotificationsPage")).NotificationsPage, {}],
  ] as const;
}

describe("G1: the pages that load say the busy words when the API is down or busy", () => {
  for (const status of [502, 503, 504]) {
    it(`a ${status} says 'We are busy. Try again in a minute.' on every one`, async () => {
      for (const [name, Page, props] of await pages()) {
        vi.stubGlobal("fetch", down(status));
        const { unmount } = render(h(Page as unknown as (p: object) => JSX.Element, props));
        expect(await screen.findByText("We are busy.", {}, { timeout: 3000 }), name).toBeTruthy();
        expect(screen.getByText("Try again in a minute."), name).toBeTruthy();
        expect(document.body.textContent, name).not.toContain("Check your connection");
        unmount();
      }
    });
  }
  it("a 500 keeps the old words", async () => {
    for (const [name, Page, props] of await pages()) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "INTERNAL", message: "x" } }), { status: 500, headers: { "content-type": "application/json" } })));
      const { unmount } = render(h(Page as unknown as (p: object) => JSX.Element, props));
      expect(await screen.findByText(/Check your connection and try again/, {}, { timeout: 3000 }), name).toBeTruthy();
      expect(document.body.textContent, name).not.toContain("We are busy.");
      unmount();
    }
  });
});
