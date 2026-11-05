// Phone-path proof for W4 SPEAK (not part of the app build). Run from web/ against a stack on one origin (default 127.0.0.1:14360):
//   node src/features/speak/proof/phone.mjs ids.json shots-dir [name-filter]
// ids.json = { q, closed, tokens: { sade, kemi, funmi, tokenman, fresh } } (signed test tokens). FAKE_WAV = a looping tone file for the fake microphone.
// Needs the API on the local test JWKS, a local S3 stand-in and a local Flutterwave stand-in (never the real one).
// Phone-path proof for W4 SPEAK: Playwright Chromium, fake microphone, iPhone and Pixel emulations at 390, real API behind a one-origin proxy.
// Usage: node phone.mjs <idsFile> <outDir> [filter]
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
const require = createRequire(process.cwd() + "/");
const { chromium, devices } = require("playwright-core");
const ids = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
const only = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });
const ORIGIN = "http://127.0.0.1:14360";
const EXE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FAKE = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-file-for-fake-audio-capture=" + (process.env.FAKE_WAV ?? "speech.wav") + ""];
const IPHONE = { viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const PIXEL = { viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36", isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

let failed = 0;
const t = async (name, fn) => {
  if (only && !name.includes(only)) return;
  try { await fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + " :: " + (e.message || e).toString().split("\n")[0]); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, tok, method = "GET", body) => {
  const r = await fetch(`${ORIGIN}/api/v1${path}`, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}), ...(method === "POST" ? { "idempotency-key": crypto.randomUUID() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => null) };
};

async function mk(browser, dev, who, scheme = "light") {
  const ctx = await browser.newContext({ ...dev, colorScheme: scheme, permissions: ["microphone"] });
  if (who) await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch {} }, ["voices-web-session", JSON.stringify({ accessToken: ids.tokens[who], refreshToken: "x" })]);
  const page = await ctx.newPage();
  const logs = [];
  page.on("pageerror", (e) => logs.push("pageerror " + e.message)); page.on("response", (r) => { if (r.status() >= 400 && r.status() !== 401) logs.push("http " + r.status() + " " + r.url()); });
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) logs.push("console " + m.text()); });
  page.logs = logs;
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name.includes("1440") && !name.startsWith("ExtraVoice") });
const idle = (page) => page.getByRole("button", { name: "Start recording" });
const stop = (page) => page.getByRole("button", { name: "Stop recording" });
const url = (p = "") => `${ORIGIN}/q/${ids.q}/speak${p}`;

const browser = await chromium.launch({ executablePath: EXE, args: FAKE });
const noPrompt = await chromium.launch({ executablePath: EXE, args: ["--use-fake-device-for-media-stream", "--no-sandbox", "--deny-permission-prompts"] });
let posted = null;
try {
  await t("A idle: signed in iPhone, no tab bar, free post, passes", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "sade");
    await page.goto(url()); await idle(page).waitFor();
    assert.equal(await page.locator(".sh-bottombar").isVisible(), false, "tab bar hidden");
    assert.match(await page.locator(".vx-rec__hint").innerText(), /Tap to record\. You have 10 seconds on a free post\./);
    assert.ok(await page.getByText(/\d+ free posts? left/).first().isVisible());
    assert.ok(await page.getByRole("button", { name: /Up to 30 seconds/ }).isVisible());
    assert.ok(await page.getByText("₦150 for one message").isVisible());
    assert.ok(await page.getByText("₦200 for one message").isVisible());
    await shot(page, "Record-ready-390-light-iphone");
    assert.deepEqual(page.logs, [], page.logs.join(" | "));
    await ctx.close();
  });

  await t("A2 record 4 s with real levels, stop, listen, send, answer is a READY voice", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "sade");
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap();
    await stop(page).waitFor();
    await page.locator("[data-testid=live-bars] i").first().waitFor();
    await sleep(1500);
    const hs = await page.locator("[data-testid=live-bars] i").evaluateAll((els) => els.map((e) => e.style.height));
    assert.ok(hs.length > 3, "bars " + hs.length);
    assert.ok(new Set(hs).size > 1, "bars move with the real analyser: " + hs.join(","));
    assert.match(await page.locator(".vx-rec__hint").innerText(), /seconds left\. It stops by itself at 10\./);
    assert.equal(await page.locator(".sh-bottombar").isVisible(), false);
    await shot(page, "Record-live-390-light-iphone");
    await sleep(2200);
    await stop(page).tap();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    const bars = await page.locator("[data-testid=take-bars] i").count();
    assert.ok(bars >= 40, "preview bars from the take " + bars);
    await shot(page, "Record-preview-390-light-iphone");
    await page.getByRole("button", { name: "Send" }).tap();
    await page.waitForURL(/\/posted\?a=/, { timeout: 60000 });
    const aid = new URL(page.url()).searchParams.get("a");
    const a = await api(`/answers/${aid}`, ids.tokens.sade);
    assert.equal(a.status, 200);
    assert.equal(a.json.kind, "VOICE");
    assert.equal(a.json.clip.status, "READY");
    assert.ok(a.json.clip.peaks?.length > 10, "server peaks");
    assert.ok(a.json.clip.durationMs > 3000 && a.json.clip.durationMs < 7000, "dur " + a.json.clip.durationMs);
    posted = aid;
    await ctx.close();
  });

  await t("B auto stop at 10 s opens ExtraVoice with the take kept (Pixel)", async () => {
    const { ctx, page } = await mk(browser, PIXEL, "kemi");
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap();
    await stop(page).waitFor();
    await sleep(3500);
    await shot(page, "Record-live-390-light-pixel");
    await page.getByRole("dialog").waitFor({ timeout: 15000 }); await sleep(600);
    await page.getByText("Need more time?").first().waitFor();
    assert.ok(await page.getByText("You reached the 10 seconds of a free post.").isVisible());
    assert.ok(await page.getByText("Time for this voice: 10 seconds free, plus 20 more with this token.").isVisible());
    assert.ok(await page.getByText("Your 10-second recording is kept. Your free posts stay as they are.").isVisible());
    assert.ok(await page.getByRole("button", { name: "Pay ₦150 for 30 seconds" }).isVisible());
    await shot(page, "ExtraVoice-390-light-pixel");
    await page.getByRole("radio", { name: /1 minute/ }).tap();
    assert.ok(await page.getByRole("button", { name: "Pay ₦200 for 1 minute" }).isVisible());
    await page.getByRole("button", { name: "No thanks, keep my 10 seconds" }).tap();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    await ctx.close();
  });

  await t("C guest records, previews, waits through sign-in, then sends", async () => {
    const { ctx, page } = await mk(browser, IPHONE, null);
    await page.goto(url()); await idle(page).waitFor();
    await shot(page, "Record-ready-390-light-guest");
    await idle(page).tap(); await stop(page).waitFor(); await sleep(2500); await stop(page).tap();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    assert.ok(await page.getByText("You sign in to post. Your recording waits here in this browser.").isVisible());
    await shot(page, "Record-preview-390-light-guest");
    assert.equal((await api("/questions/today")).status, 200);
    await page.getByRole("button", { name: "Send" }).tap();
    await page.waitForURL(/\/join\?next=/, { timeout: 15000 }).catch(() => {});
    assert.match(page.url(), /\/join\?next=%2Fq%2F.*%2Fspeak/);
    // the sign-in round trip: the session appears, the person is sent back
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), ["voices-web-session", JSON.stringify({ accessToken: ids.tokens.funmi, refreshToken: "x" })]);
    await page.goto(url());
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor({ timeout: 20000 });
    assert.ok(await page.locator("[data-testid=take-bars] i").count() >= 40, "the recording survived the round trip");
    assert.equal(await page.getByText("You sign in to post.").count(), 0);
    await page.getByRole("button", { name: "Send" }).tap();
    await page.waitForURL(/\/posted\?a=/, { timeout: 60000 });
    const a = await api(`/answers/${new URL(page.url()).searchParams.get("a")}`, ids.tokens.funmi);
    assert.equal(a.json.clip.status, "READY");
    await ctx.close();
  });

  await t("D microphone denied shows the help state", async () => {
    const ctx = await noPrompt.newContext({ ...IPHONE, colorScheme: "light" });
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ["voices-web-session", JSON.stringify({ accessToken: ids.tokens.sade, refreshToken: "x" })]);
    const page = await ctx.newPage();
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap();
    await page.getByText("The microphone is blocked").waitFor({ timeout: 10000 });
    assert.ok(await page.getByRole("button", { name: "Try again" }).isVisible());
    assert.ok(await page.getByRole("link", { name: "Write instead" }).first().isVisible());
    await shot(page, "Record-denied-390-light-iphone");
    await ctx.close();
  });

  await t("E interrupted: the page is hidden mid-record, what was heard is kept", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "sade");
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap(); await stop(page).waitFor(); await sleep(2500);
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor({ timeout: 10000 });
    assert.ok(await page.getByText("Your recording stopped when you left the page. Listen back, then send it or record again.").isVisible());
    const live = await page.evaluate(async () => (await navigator.mediaDevices.enumerateDevices()).length);
    assert.ok(live >= 0);
    await shot(page, "Record-interrupted-390-light-iphone");
    await ctx.close();
  });

  await t("H Android Back during recording discards and releases the mic (Pixel)", async () => {
    const { ctx, page } = await mk(browser, PIXEL, "sade");
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap(); await stop(page).waitFor(); await sleep(1500);
    await page.goBack();
    await idle(page).waitFor({ timeout: 10000 });
    assert.match(page.url(), /\/speak$/);
    assert.equal(await page.getByText("Listen back.").count(), 0);
    await ctx.close();
  });

  await t("F over-length: a kept 25 s take is refused with the server's words", async () => {
    const { ctx, page } = await mk(browser, PIXEL, "fresh");
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap(); await stop(page).waitFor(); await sleep(2200); await stop(page).tap();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    // an older kept take that was longer than the free seconds, with no token to cover it
    await page.evaluate(() => new Promise((res, rej) => {
      const o = indexedDB.open("voices-speak", 1);
      o.onsuccess = () => { const db = o.result; const tx = db.transaction("drafts", "readwrite"); const s = tx.objectStore("drafts"); const g = s.get("current"); g.onsuccess = () => { const d = g.result; d.seconds = 25; s.put(d, "current"); }; tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); };
    }));
    await page.reload();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    assert.ok(await page.getByText("0:25").first().isVisible());
    await page.getByRole("button", { name: "Send" }).tap();
    await page.getByText("A longer voice needs an extra voice token.").waitFor({ timeout: 20000 });
    await page.getByRole("dialog").waitFor(); await sleep(600);
    await shot(page, "Record-refused-390-light-pixel");
    await ctx.close();
  });

  await t("G pay for extra time (stand-in checkout), record 12 s with the token, post it", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "tokenman");
    await page.goto(url()); await idle(page).waitFor();
    await page.getByRole("button", { name: /Up to 30 seconds/ }).tap();
    await page.getByRole("dialog").waitFor(); await sleep(600);
    assert.equal(await page.getByText("You reached the 10 seconds of a free post.").count(), 0);
    await shot(page, "ExtraVoice-390-light-iphone-fromidle");
    await page.getByRole("button", { name: "Pay ₦150 for 30 seconds" }).tap();
    await page.waitForURL(/14365\/checkout/, { timeout: 20000 });
    await page.locator("#pay").click();
    await page.waitForURL(/\/speak\?.*paymentId=/, { timeout: 20000 }).catch(() => {});
    await page.getByText("Extra time added.").waitFor({ timeout: 30000 });
    assert.ok(await page.getByText("You can record up to 30 seconds for your next message.").isVisible());
    assert.match(await page.locator(".vx-rec__hint").innerText(), /You have 30 seconds with your extra voice\./);
    assert.equal(await page.getByRole("button", { name: /Up to 30 seconds/ }).count(), 0);
    await shot(page, "Record-ready-390-light-token");
    await idle(page).tap(); await stop(page).waitFor(); await sleep(12500); await stop(page).tap();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    await page.getByRole("button", { name: "Send" }).tap();
    await page.waitForURL(/\/posted\?a=/, { timeout: 60000 });
    const a = await api(`/answers/${new URL(page.url()).searchParams.get("a")}`, ids.tokens.tokenman);
    assert.ok(a.json.clip.durationMs > 11000 && a.json.clip.durationMs < 14000, "dur " + a.json.clip.durationMs);
    const al = await api("/me/allowance", ids.tokens.tokenman);
    assert.equal(al.json.extraVoiceTokens.filter((x) => x.status === "AVAILABLE").length, 0, "the token was spent");
    await ctx.close();
  });

  await t("G2 cancelled checkout keeps the recording and charges nothing", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "fresh");
    await page.goto(url()); await idle(page).waitFor();
    await page.getByRole("button", { name: /Up to 1 minute/ }).tap();
    await page.getByRole("button", { name: "Pay ₦200 for 1 minute" }).tap();
    await page.waitForURL(/14365\/checkout/, { timeout: 20000 });
    await page.locator("#cancel").click();
    await page.getByText("The payment was not completed. Nothing was charged, and your recording is kept.").waitFor({ timeout: 20000 });
    await shot(page, "Record-payment-cancelled-390-light-iphone");
    await ctx.close();
  });

  await t("I desktop 1440 and dark pictures", async () => {
    for (const [who, name] of [[null, "guest"], ["sade", "signed"]]) {
      const { ctx, page } = await mk(browser, DESK, who);
      await page.goto(url()); await idle(page).waitFor();
      await page.getByText("Your recording time").waitFor();
      await shot(page, `Record-ready-1440-${name}`);
      if (name === "signed") {
        await idle(page).click(); await stop(page).waitFor(); await sleep(1500);
        await shot(page, "Record-live-1440");
        await sleep(1500); await stop(page).click();
        await page.getByText("Listen back.").waitFor();
        await shot(page, "Record-preview-1440");
        await page.reload(); await page.getByText("Listen back.").waitFor();
      }
      await ctx.close();
    }
    const { ctx, page } = await mk(browser, DESK, "kemi");
    await page.goto(url()); await idle(page).waitFor();
    await page.getByRole("button", { name: /Up to 30 seconds/ }).click();
    await page.getByRole("dialog").waitFor(); await sleep(1000);
    await shot(page, "ExtraVoice-1440");
    await ctx.close();
    const d = await mk(browser, IPHONE, "sade", "dark");
    await d.page.goto(url()); await idle(d.page).waitFor();
    await shot(d.page, "Record-ready-390-dark");
    await idle(d.page).tap(); await stop(d.page).waitFor(); await sleep(2000);
    await shot(d.page, "Record-live-390-dark");
    await stop(d.page).tap(); await d.page.getByText("Listen back.").waitFor();
    await shot(d.page, "Record-preview-390-dark");
    await d.page.evaluate(() => { document.querySelectorAll("button").forEach((b) => b.textContent === "Delete" && b.click()); });
    await d.page.getByRole("button", { name: /Up to 30 seconds/ }).tap();
    await d.page.getByRole("dialog").waitFor(); await sleep(1000);
    await shot(d.page, "ExtraVoice-390-dark");
    await d.ctx.close();
    const l = await mk(browser, IPHONE, "sade", "light");
    await l.page.goto(url()); await idle(l.page).waitFor();
    await l.page.getByRole("button", { name: /Up to 30 seconds/ }).tap();
    await l.page.getByRole("dialog").waitFor(); await sleep(1000);
    await shot(l.page, "ExtraVoice-390-light");
    await l.ctx.close();
  });

  await t("K loading and closed states", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "sade");
    await page.route("**/api/v1/config/public", async (r) => { await sleep(2500); r.continue(); });
    await page.goto(url());
    await page.locator(".sp-loading").waitFor({ timeout: 5000 });
    await shot(page, "Record-loading-390-light-iphone");
    await ctx.close();
    const m = await mk(browser, IPHONE, "sade");
    await m.page.goto(`${ORIGIN}/q/${ids.closed}/speak`);
    await m.page.getByText("This question has closed.").waitFor({ timeout: 20000 });
    await shot(m.page, "Record-closed-390-light-iphone");
    await m.ctx.close();
  });

  await t("L Close mid-take leaves for the question with no live microphone; Close when idle too; early Stop gives a hint", async () => {
    for (const dev of [IPHONE, PIXEL]) {
      const { ctx, page } = await mk(browser, dev, "sade");
      await page.addInitScript(() => { window.__streams = []; const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async (c) => { const s = await g(c); window.__streams.push(s); return s; }; });
      await page.goto(url()); await idle(page).waitFor();
      await idle(page).tap(); await stop(page).waitFor();
      await stop(page).tap(); // too early: quiet hint, still recording
      await page.getByText("Keep talking, a little longer.").waitFor({ timeout: 3000 });
      assert.ok(await stop(page).isVisible(), "still recording after the early tap");
      await sleep(1200);
      await page.getByRole("button", { name: "Close the recorder" }).tap();
      await page.waitForURL(new RegExp(`/q/${ids.q}$`), { timeout: 10000 });
      await sleep(1500);
      assert.match(page.url(), new RegExp(`/q/${ids.q}$`), "stayed on the question");
      const live = await page.evaluate(() => window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length);
      assert.equal(live, 0, "live tracks after close");
      await ctx.close();
    }
    const { ctx, page } = await mk(browser, IPHONE, "sade");
    await page.goto(url()); await idle(page).waitFor();
    await page.getByRole("button", { name: "Close the recorder" }).tap();
    await page.waitForURL(new RegExp(`/q/${ids.q}$`), { timeout: 10000 });
    await ctx.close();
  });

  await t("M over-limit take: the sheet says the real length and offers a token or Record again", async () => {
    const { ctx, page } = await mk(browser, PIXEL, "fresh");
    await page.goto(url()); await idle(page).waitFor();
    await idle(page).tap(); await stop(page).waitFor(); await sleep(2200); await stop(page).tap();
    await page.getByText("Listen back. Nothing posts until you tap Send.").waitFor();
    await page.evaluate(() => new Promise((res, rej) => {
      const o = indexedDB.open("voices-speak", 1);
      o.onsuccess = () => { const tx = o.result.transaction("drafts", "readwrite"); const s = tx.objectStore("drafts"); const g = s.get("current"); g.onsuccess = () => { const d = g.result; d.seconds = 12; s.put(d, "current"); }; tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); };
    }));
    await page.reload();
    await page.getByText("Listen back.").waitFor();
    await page.getByRole("button", { name: "Send" }).tap();
    await page.getByRole("dialog").waitFor(); await sleep(1000);
    assert.ok(await page.getByText("Your recording is 12 seconds. A free post is 10.").isVisible());
    assert.ok(await page.getByText("This token covers your 12-second recording.").isVisible());
    assert.equal(await page.getByText(/is kept/).count(), 0);
    assert.equal(await page.getByText(/keep my 10 seconds/).count(), 0);
    await shot(page, "ExtraVoice-overlimit-390-light-pixel");
    await page.getByRole("button", { name: "Record again" }).tap();
    await idle(page).waitFor();
    await ctx.close();
  });

  await t("J error and closed states", async () => {
    const { ctx, page } = await mk(browser, IPHONE, "sade");
    await page.route("**/api/v1/questions/**", (r) => r.abort());
    await page.goto(url());
    await page.getByText("This did not load").waitFor({ timeout: 20000 });
    await shot(page, "Record-error-390-light-iphone");
    await ctx.close();
    const m = await mk(browser, IPHONE, "sade");
    await m.page.goto(`${ORIGIN}/q/00000000-0000-4000-8000-000000000000/speak`);
    await m.page.getByText("We could not find this question").waitFor({ timeout: 20000 });
    await m.ctx.close();
  });
} finally {
  await browser.close(); await noPrompt.close();
}
console.log(failed ? "FAILED " + failed : "ALL PASSED");
process.exit(failed ? 1 : 0);
