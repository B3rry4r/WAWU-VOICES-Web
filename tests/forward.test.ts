import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { forwardHeaders } from "@/lib/api/forward";

/** RT2 (lead ruling, 6 Nov): server-side calls to the API pass the visitor's X-Forwarded-For through unchanged. */
describe("forwarding the visitor's address", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it("passes X-Forwarded-For through unchanged, and nothing when there is none", () => {
    const h = new Headers({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9" });
    expect(forwardHeaders(h)).toEqual({ "X-Forwarded-For": "1.2.3.4, 203.0.113.9" });
    expect(forwardHeaders(new Headers())).toEqual({});
  });

  it("getSharePage, getPollTitle and getProfileVoices send it to the API", async () => {
    const seen: Headers[] = [];
    vi.stubGlobal("fetch", (_u: string, init: RequestInit) => {
      seen.push(init.headers as Headers);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }));
    });
    vi.resetModules();
    const r = await import("@/lib/api/reach");
    const fwd = forwardHeaders(new Headers({ "x-forwarded-for": "198.51.100.7" }));
    await r.getSharePage("abc1234", fwd);
    await r.getPollTitle("p1", fwd);
    await r.getProfileVoices("someone", fwd);
    expect(seen).toHaveLength(3);
    for (const h of seen) expect(h.get("X-Forwarded-For")).toBe("198.51.100.7");
  });

  it("the /s middleware check sends it too", async () => {
    const seen: Headers[] = [];
    vi.stubGlobal("fetch", (_u: string, init: RequestInit) => {
      seen.push(new Headers(init.headers));
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const { middleware } = await import("@/middleware");
    await middleware(new NextRequest("http://localhost/s/abc1234", { headers: { "x-forwarded-for": "198.51.100.8" } }));
    expect(seen[0].get("X-Forwarded-For")).toBe("198.51.100.8");
  });
});
