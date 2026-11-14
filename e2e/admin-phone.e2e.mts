// Drives every admin page in a real Chromium against a running `next start`, with the API stubbed by page.route.
//   ORIGIN=http://127.0.0.1:3100 OUT=docs/lead/admin-phone ONLY=money,verification node --experimental-strip-types e2e/admin-phone.e2e.mts [phone|desk]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { answer } from "./admin-phone-fixtures.mts";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:3100";
const OUT = process.env.OUT ?? "docs/lead/admin-phone";
const MODE = process.argv[2] ?? "phone";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const PAGES: { name: string; path: string; dialog?: (p: any) => Promise<void> }[] = [
  { name: "money-overview", path: "/admin/money" },
  { name: "money-payments", path: "/admin/money/payments", dialog: async (p) => { await p.getByRole("button", { name: "Re-verify" }).first().click(); } },
  { name: "money-wallets", path: "/admin/money/wallets?handle=chika.o", dialog: async (p) => { await p.getByLabel("Tokens").fill("50"); await p.getByLabel("Reason").fill("Goodwill"); await p.getByRole("button", { name: "Review the change" }).click(); } },
  { name: "money-subscriptions", path: "/admin/money/subscriptions" },
  { name: "money-prices", path: "/admin/money/prices", dialog: async (p) => { await p.getByRole("button", { name: /Change/ }).first().click(); } },
  { name: "verification", path: "/admin/verification", dialog: async (p) => { await p.getByRole("listitem").first().click(); await p.getByRole("button", { name: "Show the government id" }).click(); } },
  { name: "moderation", path: "/admin/moderation", dialog: async (p) => { await p.getByRole("listitem").first().click(); } },
  ...(process.env.MORE ? JSON.parse(process.env.MORE) : []),
];
const sizes = MODE === "phone" ? [{ w: 390, h: 844 }, { w: 768, h: 1024 }] : [{ w: 1440, h: 900 }];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let bad = 0;
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: MODE === "phone" ? 2 : 1, hasTouch: MODE === "phone", isMobile: MODE === "phone" && s.w < 700 });
  await ctx.addInitScript(() => localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
  await ctx.route("**/api/v1/**", async (route) => {
    const u = new URL(route.request().url());
    const r = answer(u.pathname.replace(/^\/api\/v1/, ""), u.searchParams, route.request().method());
    if (!r) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }) });
    return route.fulfill({ status: r.status ?? 200, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  for (const pg of PAGES) {
    if (ONLY && !ONLY.includes(pg.name)) continue;
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(ORIGIN + pg.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts.ready);
    const tag = `${pg.name}-${s.w}`;
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    const notes: string[] = [];
    if (MODE === "phone") {
      if (sw !== s.w) { notes.push(`SCROLLWIDTH ${sw}`); bad++; }
      await page.screenshot({ path: `${OUT}/${pg.name}-${s.w}.png` });
      // The menu opens, lists pages, closes.
      if (s.w < 1024) {
        await page.getByRole("button", { name: "Menu" }).click();
        await page.waitForTimeout(500);
        const n = await page.getByRole("dialog").getByRole("link").count();
        if (n < 5) { notes.push(`MENU ${n} links`); bad++; }
        if (pg.name === "money-overview") await page.screenshot({ path: `${OUT}/menu-${s.w}.png` });
        await page.getByRole("button", { name: "Close" }).click();
      }
      if (pg.dialog) {
        await pg.dialog(page);
        await page.waitForTimeout(400);
        const sw2 = await page.evaluate(() => document.documentElement.scrollWidth);
        if (sw2 !== s.w) { notes.push(`DIALOG SCROLLWIDTH ${sw2}`); bad++; }
        await page.screenshot({ path: `${OUT}/${pg.name}-${s.w}-open.png` });
        const close = page.getByRole("button", { name: /Back to the list|Close|Cancel/ }).first();
        if (await close.count()) await close.click(); else notes.push("NO CLOSE");
      }
      // Controls under 44 px (visible buttons, links that are not inside a line of text, inputs).
      const small = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>("button, [role=tab], [role=switch], input:not([type=hidden]), select, textarea, a.ad-nav-item, nav a").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") return;
          if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        });
        return out;
      });
      if (small.length) { notes.push("SMALL " + small.slice(0, 6).join("; ")); bad += small.length; }
    } else {
      await page.screenshot({ path: `${OUT}/${pg.name}-1440.png`, fullPage: true });
    }
    if (errs.length) { notes.push("PAGEERROR " + errs[0]); bad++; }
    console.log(tag.padEnd(28), `scrollWidth ${sw}`, notes.join(" | ") || "ok");
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `PROBLEMS: ${bad}` : "ALL OK");
