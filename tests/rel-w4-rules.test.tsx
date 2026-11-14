// @vitest-environment jsdom
// REL-W4 join: rules that must hold after fix-b and fix-c came in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AdminFrame } from "@/features/admin/AdminFrame";
import { AdminNewsPage } from "@/features/admin/NewsPage";
import { DMS_LIVE } from "@/features/dm/live";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe("direct messages stay off", () => {
  it("the switch is false", () => expect(DMS_LIVE).toBe(false));
  it("no screen outside src/features/dm and the API file calls a /dm/ route without the switch", () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n) && !p.includes("src/features/dm/") && !p.endsWith("src/lib/api/dm.ts") && !p.includes("src/lib/api/types")) {
          const t = readFileSync(p, "utf8");
          if (/["'`]\/dm[/"'`]/.test(t) && !t.includes("DMS_LIVE")) hits.push(p);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});

describe("a nameless post shows no writer on the admin news queue", () => {
  it("no name, handle or picture for a post with no author", async () => {
    const answer = { id: "a1", body: "Words about the road", createdAt: "2026-11-14T10:00:00Z", likeCount: 2, author: null, news: { tag: "UNVERIFIED_NEWS" } };
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/me")) return json(200, { id: "u", handle: "ngozi.e", roles: ["EDITOR"], profile: { displayName: "Ngozi Eze" } });
      if (u.includes("/admin/news/items")) return json(200, { items: [{ answer, flagCount: 1, flagReasons: [], verifiedRequested: false, sourceName: null, sourceUrl: null, evidenceUrl: null, changeLog: [], summary: "Flagged" }], nextCursor: null, waiting: 1, counts: { flagged: 1, askingVerified: 0, allChanges: 0 } });
      return json(404, { error: { code: "NOT_FOUND", message: "no" } });
    }));
    const { container } = render(<AdminFrame><AdminNewsPage /></AdminFrame>);
    await screen.findAllByText(/Words about the road/);
    const row = container.querySelector('[role="listitem"]') as HTMLElement;
    expect(row.textContent).not.toMatch(/@[a-z]/i);
    expect(row.querySelector("img")).toBeNull();
    expect(row.textContent).toContain("Posted without a name");
    const main = container.querySelector("main") ?? container;
    expect(main.textContent).not.toMatch(/@removed/);
  });
});
