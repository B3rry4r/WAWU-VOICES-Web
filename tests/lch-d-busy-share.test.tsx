// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";

const getSharePage = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock("@/lib/api/forward-server", () => ({ requestForward: () => ({}) }));
vi.mock("@/lib/api/reach", async (orig) => ({ ...(await orig<object>()), getSharePage: (...a: unknown[]) => getSharePage(...a), getPollTitle: vi.fn(), getProfileVoices: vi.fn() }));

afterEach(cleanup);

describe("the share page when the API is busy (LCH-09 F4)", () => {
  it("says the busy words, not 'We could not open that link'", async () => {
    getSharePage.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "We are busy. Try again in a minute.", true));
    const { default: Page } = await import("@/app/s/[code]/page");
    render(await Page({ params: { code: "abc1234" } }));
    expect(screen.getByRole("heading", { name: "We are busy." })).toBeTruthy();
    expect(screen.getByText("Try again in a minute.")).toBeTruthy();
    expect(screen.queryByText("We could not open that link")).toBeNull();
    expect(document.body.textContent).not.toContain("—");
  });

  it("any other failure keeps the old words", async () => {
    getSharePage.mockRejectedValue(new ApiError(500, "INTERNAL", "x", false));
    const { default: Page } = await import("@/app/s/[code]/page");
    render(await Page({ params: { code: "abc1234" } }));
    expect(screen.getByText("We could not open that link")).toBeTruthy();
  });

  it("the page title says busy too, and is not indexed", async () => {
    getSharePage.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "We are busy. Try again in a minute.", true));
    const { generateMetadata } = await import("@/app/s/[code]/page");
    const m = await generateMetadata({ params: { code: "abc1234" } });
    expect(m.title).toBe("We are busy");
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});
