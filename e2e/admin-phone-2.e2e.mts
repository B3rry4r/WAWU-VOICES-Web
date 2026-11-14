// V-ADMIN-PHONE-2 browser run. API stubbed by page.route. Admin pages with details opened, then the Profile cases.
//   ORIGIN=http://127.0.0.1:3100 OUT=docs/lead/admin-phone-2 node --experimental-strip-types e2e/admin-phone-2.e2e.mts [phone|desk]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { answer } from "./admin-phone-fixtures.mts";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:3100";
const OUT = process.env.OUT ?? "docs/lead/admin-phone-2";
const MODE = process.argv[2] ?? "phone";
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const LONG_EMAIL = "an.extremely.long.address.for.a.person.with.a.long.name@subdomain.of.a.very-long-company-name.example.com.ng";
const user = (i: number) => ({ profile: { id: "id" + i, handle: "person." + i, displayName: null, countryCode: "NG", languages: [], joinedAt: hoursAgo(5), voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, status: "ACTIVE", roles: [], strikes: 0, createdAt: hoursAgo(900), mailTo: i === 0 ? LONG_EMAIL : `p${i}@example.com`, displayName: "Person " + i, state: "Lagos", verified: i % 2 === 0, postCount: 9_999_999, hasProfile: true });
const PAGES: { name: string; path: string; dialog?: (p: any) => Promise<void> }[] = [
  { name: "users", path: "/admin/users" },
  { name: "money-overview", path: "/admin/money" },
  { name: "money-payments", path: "/admin/money/payments", dialog: async (p) => { await p.getByRole("button", { name: "Re-verify" }).first().click(); } },
  { name: "money-wallets", path: "/admin/money/wallets?handle=chika.o", dialog: async (p) => { await p.getByLabel("Tokens").fill("50"); await p.getByLabel("Reason").fill("Goodwill"); await p.getByRole("button", { name: "Review the change" }).click(); } },
  { name: "money-subscriptions", path: "/admin/money/subscriptions" },
  { name: "money-prices", path: "/admin/money/prices", dialog: async (p) => { await p.getByRole("button", { name: /Change/ }).first().click(); } },
  { name: "money-prices-packs", path: "/admin/money/prices", dialog: async (p) => { const b = p.getByRole("button", { name: /Change/ }); await b.nth((await b.count()) - 1).click(); } },
  { name: "verification", path: "/admin/verification", dialog: async (p) => { await p.getByRole("listitem").first().click(); await p.getByRole("button", { name: "Show the government id" }).click(); await p.waitForTimeout(300); } },
  { name: "moderation", path: "/admin/moderation", dialog: async (p) => { await p.getByRole("listitem").first().click(); } },
  { name: "today", path: "/admin" },
  { name: "calendar", path: "/admin/calendar", dialog: async (p) => { await p.getByRole("button", { name: /Money, markets/ }).first().click(); await p.waitForTimeout(400); } },
  { name: "pool", path: "/admin/pool", dialog: async (p) => { await p.getByRole("button", { name: /^Edit question/ }).first().click(); } },
  { name: "override", path: "/admin/override", dialog: async (p) => { await p.getByLabel(/Headline/).fill("Special report"); await p.getByLabel("Message").fill("Words"); await p.getByRole("button", { name: "Go live now" }).click(); } },
  { name: "results", path: "/admin/results", dialog: async (p) => { await p.getByRole("listitem").first().click(); } },
  { name: "weekly", path: "/admin/weekly", dialog: async (p) => { await p.getByRole("button", { name: "Hold", exact: true }).click(); } },
  { name: "news", path: "/admin/news", dialog: async (p) => { await p.getByRole("listitem").first().click(); } },
  { name: "ads", path: "/admin/ads", dialog: async (p) => { await p.getByRole("button", { name: /^Open Zobo/ }).first().click(); } },
];
const SIZES = MODE === "phone" ? [320, 390, 768] : [1440];
mkdirSync(OUT, { recursive: true });

const measure = () => {
  const out: { small: string[]; sw: number; heights: string[] } = { small: [], sw: document.documentElement.scrollWidth, heights: [] };
  document.querySelectorAll<HTMLElement>("button, [role=tab], [role=switch], input:not([type=hidden]), select, textarea, nav a, table a").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") return;
    const d = `${el.getAttribute("role") === "switch" ? "switch" : el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
    if (el.getAttribute("role") === "switch" || el.tagName === "SELECT" || el.closest("table") || /Get a new link/.test(el.textContent || "")) out.heights.push(d);
    if ((el.tagName === "A" && !location.pathname.endsWith("/admin/users")) ? false : (r.height < 43.5 || (r.width < 43.5 && el.tagName === "BUTTON"))) out.small.push(d);
  });
  return out;
};

const browser = await chromium.launch();
let bad = 0;
const log = (s: string) => console.log(s);
for (const w of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : w === 768 ? 1024 : 900 }, deviceScaleFactor: 1, hasTouch: MODE === "phone", isMobile: MODE === "phone" && w < 700 });
  await ctx.addInitScript(() => localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
  await ctx.route("**/api/v1/**", async (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api\/v1/, "");
    if (path === "/admin/users" && !u.searchParams.get("q")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [0, 1, 2, 3].map(user), nextCursor: null, total: 9_999_999, counts: { total: 9_999_999, today: 9_999_999, verified: 9_999_999, byStatus: {} } }) });
    const r = answer(path, u.searchParams, route.request().method());
    if (!r) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }) });
    return route.fulfill({ status: r.status ?? 200, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  for (const pg of PAGES) {
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(ORIGIN + pg.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const notes: string[] = [];
    const before = await page.evaluate(measure);
    if (MODE === "phone") {
      if (before.sw !== w) { notes.push(`SCROLLWIDTH ${before.sw}`); bad++; }
      if (before.small.length) { notes.push("SMALL(before) " + before.small.slice(0, 5).join("; ")); bad += before.small.length; }
      if (pg.name === "users") {
        const t = await page.evaluate(() => Array.from(document.querySelectorAll("[data-testid^=users-]")).map((e) => `${e.getAttribute("data-testid")}:${(e as HTMLElement).scrollWidth <= (e as HTMLElement).clientWidth}:${e.textContent}`));
        const mail = await page.evaluate((m) => { const td = Array.from(document.querySelectorAll("td")).find((x) => x.textContent === m); if (!td) return "missing"; const r = td.getBoundingClientRect(); return `${Math.round(r.right)}<=${innerWidth}:${td.scrollWidth <= td.clientWidth + 1}`; }, LONG_EMAIL);
        notes.push("figures " + t.join(" ") + " | email " + mail);
      }
    }
    await page.screenshot({ path: `${OUT}/${pg.name}-${w}.png`, fullPage: MODE !== "phone" });
    let after = before;
    if (pg.dialog) {
      await pg.dialog(page);
      await page.waitForTimeout(400);
      after = await page.evaluate(measure);
      if (MODE === "phone") {
        if (after.sw !== w) { notes.push(`OPEN SCROLLWIDTH ${after.sw}`); bad++; }
        if (after.small.length) { notes.push("SMALL(open) " + after.small.slice(0, 5).join("; ")); bad += after.small.length; }
      }
      await page.screenshot({ path: `${OUT}/${pg.name}-${w}-open.png`, fullPage: MODE !== "phone" });
    }
    if (pg.name === "calendar") {
      const box = await page.evaluate(() => { const t = document.querySelector("table"); const b = t?.parentElement as HTMLElement; return b ? { ov: getComputedStyle(b).overflowX, sw: b.scrollWidth, cw: b.clientWidth, radius: getComputedStyle(b).borderRadius } : null; });
      notes.push("calendar box " + JSON.stringify(box));
    }
    const hs = [...new Set([...before.heights, ...after.heights])];
    if (pg.name === "override" || pg.name === "calendar" || pg.name === "users" || pg.name === "verification") notes.push("heights: " + hs.filter((h) => /switch|select|a "|Get a new/.test(h) || pg.name !== "users").slice(0, 8).join("; "));
    if (errs.length) { notes.push("PAGEERROR " + errs[0]); bad++; }
    log(`${pg.name}-${w}`.padEnd(30) + `sw ${before.sw}/${after.sw} ` + (notes.join(" | ") || "ok"));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
log(bad ? `PROBLEMS: ${bad}` : "ALL OK");
