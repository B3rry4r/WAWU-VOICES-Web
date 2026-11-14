// @vitest-environment jsdom
// G1 on the share page: a lost connection and a 502 or 504 say the busy words, like the 503 of LCH-09.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiError, NetworkError } from "@/lib/api/client";

const getSharePage = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/api/forward-server", () => ({ requestForward: () => ({}) }));
vi.mock("@/lib/api/reach", async (orig) => ({ ...(await orig<object>()), getSharePage: (...a: unknown[]) => getSharePage(...a), getPollTitle: vi.fn(), getProfileVoices: vi.fn() }));

afterEach(cleanup);

describe("the share page when the API cannot be reached (G1)", () => {
  it("draws the waiting state for a lost connection, a 502 and a 504, not 'We could not open that link' (round 4 ruling)", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    for (const e of [new NetworkError("offline"), new ApiError(502, "HTTP_502", "Request failed (502)", false), new ApiError(504, "HTTP_504", "x", false)]) {
      getSharePage.mockRejectedValueOnce(e);
      const { unmount } = render(await Page({ params: { code: "abc1234" } }));
      expect(screen.getByRole("heading", { name: "Opening." })).toBeTruthy();
      expect(screen.getByText("One moment.")).toBeTruthy();
      expect(screen.queryByText("We could not open that link")).toBeNull();
      unmount();
    }
  });
});

describe("G8: an unknown or removed share link answers 404 (not reproduced as 200 on main; pinned here)", () => {
  it("the page asks for Next's 404 for a code the API does not know (404 or 400)", async () => {
    const { default: Page } = await import("@/app/s/[code]/page");
    for (const status of [404, 400]) {
      getSharePage.mockRejectedValueOnce(new ApiError(status, "NOT_FOUND", "x", true));
      await expect(Page({ params: { code: "zzzzzzz" } })).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
  it("the middleware rewrites it to /link-not-found with status 404 and noindex, for a 404 and a 400", async () => {
    const { middleware } = await import("@/middleware");
    const { NextRequest } = await import("next/server");
    for (const status of [404, 400]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
      const res = await middleware(new NextRequest("http://localhost/s/zzzzzzz"));
      expect(res.status).toBe(404);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(res.headers.get("x-middleware-rewrite")).toContain("/link-not-found");
    }
    vi.unstubAllGlobals();
  });
});
