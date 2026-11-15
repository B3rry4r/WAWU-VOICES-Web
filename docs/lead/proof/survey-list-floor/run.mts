// node --experimental-strip-types docs/lead/proof/survey-list-floor/run.mts  (against `next start` on 3100, API stubbed)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = "docs/lead/proof/survey-list-floor";
const q = (id: string, kind: string, prompt: string, o: object) => ({ id, position: 1, kind, prompt, answered: 45, options: [], other: null, texts: [], voices: [], ...o });
const report = {
  survey: { id: "s1", brandName: "Zobo Fresh", title: "Power and light", status: "APPROVED", startsOn: "2026-11-20", endsOn: "2026-11-30", responseTarget: 100 },
  stage: "RELEASED", ready: true, released: true, releasedAt: "2026-12-02T09:00:00Z", minGroupSize: 20, belowMinimum: false,
  totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 }, note: "n",
  questions: [
    q("q1", "TEXT", "What would you change?", {}),
    q("q2", "VOICE", "Say it in your own words", {}),
    q("q3", "TEXT", "Anything else?", { answered: 6, texts: ["Ice please", "More light", "Lower price", "Faster", "Cold", "Fresh"] }),
  ],
};
const me = { id: "u", handle: "ngozi.e", roles: ["AD_MANAGER"], profile: { displayName: "Ngozi Eze" } };
const table: Record<string, unknown> = { "/me": me, "/categories": { items: [] }, "/admin/today": { needsAttention: {} }, "/admin/brands": { items: [] }, "/admin/surveys/s1/report": report };
const browser = await chromium.launch();
const LINE = "Too few answers left to show.";
for (const [name, w, h] of [["phone", 390, 844], ["desk", 1440, 900]] as const) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.addInitScript(() => localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
  await ctx.route("**/api/v1/**", (route: any) => { const p = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, ""); const b = table[p]; return b ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) }) : route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }) }); });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3100/admin/surveys/s1/results", { waitUntil: "networkidle" });
  await page.getByText("Anything else?").waitFor();
  const body = await page.locator("body").innerText();
  const lines = body.split(LINE).length - 1;
  const answered = (body.match(/45 answered this question/g) ?? []).length;
  const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.png`, fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save as CSV" }).click()]);
  await dl.saveAs(`${OUT}/${name}.csv`);
  const csv = readFileSync(`${OUT}/${name}.csv`, "utf8");
  const csvLines = csv.split(LINE).length - 1;
  console.log(JSON.stringify({ name, w, h, pageLines: lines, answered45: answered, csvLines, match: lines === csvLines, hasItems: body.includes("Lower price") && csv.includes("Free answer,Anything else?,Lower price"), noHScroll: noScroll }));
  await ctx.close();
}
await browser.close();
