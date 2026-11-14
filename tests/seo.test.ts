import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";

describe("SEO-APPS write-up", () => {
  it("keeps the title and description inside search limits and free of dashes", () => {
    expect(SITE_TITLE.length).toBeLessThan(60);
    expect(SITE_DESCRIPTION.length).toBeLessThan(160);
    expect(`${SITE_TITLE}${SITE_DESCRIPTION}`).not.toMatch(/[–—]/);
  });
  it("lists public pages only", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://usevoices.com");
    for (const u of urls) expect(u).not.toMatch(/admin|settings|profile|api/);
  });
  it("blocks private areas and points to the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    for (const p of ["/admin", "/settings", "/profile", "/api"]) expect(rule.disallow).toContain(p);
    expect(r.sitemap).toBe("https://usevoices.com/sitemap.xml");
  });
  it("disallows the /join/ onboarding steps but not /join itself", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toContain("/join/");
    expect(rule.disallow).not.toContain("/join");
  });
  it("the layout has no og:url of its own; only / and /welcome set one; sign-in and join have a canonical", () => {
    const src = (f: string) => readFileSync(f, "utf8");
    expect(src("src/app/layout.tsx")).not.toMatch(/openGraph:[^\n]*url:/);
    expect(src("src/app/page.tsx")).toMatch(/openGraph:[^\n]*url:/);
    expect(src("src/app/welcome/page.tsx")).toMatch(/openGraph:[^\n]*url:/);
    expect(src("src/app/sign-in/page.tsx")).toContain('canonical: "/sign-in"');
    expect(src("src/app/join/page.tsx")).toContain('canonical: "/join"');
  });
});
