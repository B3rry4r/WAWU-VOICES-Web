import { describe, expect, it } from "vitest";

// G8: Next drops a middleware rewrite's 404 when the target page is prerendered, so /link-not-found must stay dynamic.
// The real proof is `node scripts/check-share-404.mjs <base>` against `next start`.
describe("/link-not-found stays dynamic (G8)", () => {
  it("is force-dynamic and noindex", async () => {
    const m = await import("@/app/link-not-found/page");
    expect(m.dynamic).toBe("force-dynamic");
    expect(m.metadata.robots).toEqual({ index: false, follow: false });
  });
});
