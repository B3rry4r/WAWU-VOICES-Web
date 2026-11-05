// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

afterEach(() => vi.unstubAllGlobals());
const req = (p: string) => new NextRequest(`http://localhost:3000${p}`);

describe("/s/<code> middleware", () => {
  it("an unknown code is rewritten to the not-found page with 404 and noindex", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    const res = await middleware(req("/s/zzzzzz"));
    expect(res.status).toBe(404);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/link-not-found");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("a known code falls through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const res = await middleware(req("/s/abc1234"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });
  it("trouble reaching the API falls through (the page reports it)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await middleware(req("/s/abc1234"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
