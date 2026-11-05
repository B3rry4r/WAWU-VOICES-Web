#!/usr/bin/env node
/**
 * Shoots a route at 390x844 light, 390x844 dark and 1440 wide (light) into a folder.
 *   node scripts/shoot.mjs [route=/] [outDir=./shots] [origin=http://127.0.0.1:3000] [name]
 * The server must already be running (npm run dev, or npm run build && npm start).
 * Files: <name>-390-light.png, <name>-390-dark.png, <name>-1440.png (name defaults to the route).
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const route = process.argv[2] ?? "/";
const out = process.argv[3] ?? "./shots";
const origin = process.argv[4] ?? "http://127.0.0.1:3000";
const name = process.argv[5] ?? (route === "/" ? "Home" : route.replace(/^\//, "").replace(/[^\w]+/g, "-"));

function chromiumPath() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(os.homedir(), ".cache/ms-playwright")].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const exe = path.join(root, dir, sub);
        if (existsSync(exe)) return exe;
      }
    }
  }
  return undefined;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
try {
  const sets = [
    { file: `${name}-390-light.png`, w: 390, h: 844, scheme: "light", full: false, mobile: true },
    { file: `${name}-390-dark.png`, w: 390, h: 844, scheme: "dark", full: false, mobile: true },
    { file: `${name}-1440.png`, w: 1440, h: 900, scheme: "light", full: true, mobile: false },
  ];
  for (const s of sets) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: s.scheme, deviceScaleFactor: 1, isMobile: s.mobile, hasTouch: s.mobile });
    const page = await ctx.newPage();
    await page.goto(origin + route, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, s.file), fullPage: s.full });
    console.log("wrote", path.join(out, s.file));
    await ctx.close();
  }
} finally {
  await browser.close();
}
