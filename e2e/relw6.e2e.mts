// REL-W6 browser run against the built app (next start) with every API call stubbed in the browser.
//   npx next build && npx next start -p 3100 &   then ORIGIN=http://127.0.0.1:3100 node --experimental-strip-types e2e/relw6.e2e.mts
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:3100";
const OUT = process.env.OUT ?? "docs/lead/rel-w6";
mkdirSync(OUT, { recursive: true });
const now = new Date().toISOString();
const me = { id: "u1", handle: "me.handle", displayName: "Me Person", state: null, avatarUrl: null };
const mk = (over: object) => ({ id: "a1", questionId: "q1", author: me, kind: "TEXT", body: "x", clip: null, createdAt: now, editedAt: null, status: "PUBLISHED", news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null, ...over });
const question = (over: object = {}) => ({ id: "q1", kind: "DAILY", status: "LIVE", text: "Lagos floods: are you and your family safe?", hint: null, moodOptions: ["ANGRY", "TIRED", "PROUD", "HOPEFUL"], category: null, topicId: "t1", topicTitle: "Campaign Season", voiceCount: 1, answerCount: 1, voicesCount: 1, proposalCount: 2, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: new Date(Date.now() - 3600e3).toISOString(), endsAt: new Date(Date.now() + 20 * 3600e3).toISOString(), override: null, ...over });
const costs = { freeVoiceSeconds: 60, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60, textMaxChars: 2500, textPostMilli: 1000 };
const config = { currency: "NGN", freePosts: 10, voiceFreeSeconds: 60, costs, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, costs };
const topic = { id: "t1", weekNumber: 3, title: "Campaign Season", blurb: null, countryCode: "NG", startsOn: "2026-11-16", endsOn: "2026-11-22", status: "LIVE", sensitive: false, voiceCount: 40, questionCount: 7 };
const long = "word ".repeat(801).trim().slice(0, 4002).padEnd(4002, "z");
const authors = {
  admin: { id: "u2", handle: "boss.admin", displayName: "Boss", state: null, avatarUrl: null, verified: true, admin: true },
  verified: { id: "u3", handle: "vera.fied", displayName: "Vera", state: null, avatarUrl: null, verified: true },
  plain: { id: "u4", handle: "plain.joe", displayName: "Joe", state: null, avatarUrl: null, verified: false },
};
const SETTINGS = { language: "en", dataSaver: false, theme: "system", timezone: "Africa/Lagos", quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyWeeklyTopic: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyTagFollows: true };
const browser = await chromium.launch();
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return; try { await fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + " " + (e as Error).message.replace(/\n+/g, " ").slice(0, 400)); } };
interface O { w: number; h: number; signedIn?: boolean; roles?: string[]; extra?: (p: string, m: string, body: string, ok: (b: unknown, s?: number) => Promise<void>) => Promise<boolean> }
async function open(o: O) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 1 });
  if (o.signedIn !== false) await ctx.addInitScript(() => localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })));
  const reqs: { m: string; p: string; body: string }[] = [];
  await ctx.route("**/api/v1/**", async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname.replace("/api/v1", "");
    const ok = (b: unknown, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    reqs.push({ m: req.method(), p, body: req.postData() ?? "" });
    if (o.extra && (await o.extra(p, req.method(), req.postData() ?? "", ok))) return;
    if (p === "/questions/q1" || p === "/questions/today") return ok(question());
    if (p === "/config/public") return ok(config);
    if (p === "/me/allowance") return ok(allowance);
    if (p === "/me") return ok({ id: "u1", handle: "me.handle", profileComplete: true, roles: o.roles ?? [], profile: { id: "u1", handle: "me.handle", displayName: "Me Person", countryCode: "NG", languages: [], joinedAt: now, voiceCount: 1, replyCount: 0, reactionsReceived: 0 }, settings: SETTINGS, allowances: allowance, status: "ACTIVE", unreadNotifications: 0 });
    if (p === "/home") return ok({ topicOfWeek: topic, dailyQuestion: question(), flashPoll: null, trending: [mk({ id: "a2", isMine: false, body: "Two hours is generous." })], newConversations: [], greetingName: null });
    if (p === "/feed/trending-questions") return ok({ items: [], nextCursor: null });
    if (p === "/polls/flash") return ok({ items: [] });
    if (p === "/ads/placement") return ok({ ad: null });
    if (p === "/me/settings") return ok(SETTINGS);
    if (false) return ok({ language: "en", dataSaver: false, theme: "system", timezone: "Africa/Lagos", quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyWeeklyTopic: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyTagFollows: true });
    return ok({}, 404);
  });
  const page = await ctx.newPage();
  if (process.env.DEBUG_ERR) { page.on("pageerror", (e: Error) => console.log("   pageerror", e.message.slice(0, 200))); page.on("console", (m: any) => m.type() === "error" && console.log("   console", m.text().slice(0, 300))); }
  return { page, ctx, reqs };
}
const noH = async (page: any, label: string) => { const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); assert.ok(r.sw <= r.cw, `${label}: sideways scroll ${r.sw} > ${r.cw}`); };
const SIZES: [number, number][] = [[390, 844], [360, 740], [1440, 900]];

for (const [w, h] of SIZES) {
  // H1 from the profile
  await t(`H1 profile ${w}`, async () => {
    const { page, reqs, ctx } = await open({ w, h, extra: async (p, m, body, ok) => {
      if (p === "/me/answers") { await ok({ items: [{ type: "answer", answer: mk({ id: "a9", body: long }) }], nextCursor: null }); return true; }
      if (m === "PATCH" && p === "/answers/a9") { await ok(mk({ id: "a9", body: JSON.parse(body).body })); return true; }
      return false;
    } });
    await page.goto(ORIGIN + "/profile"); await page.waitForTimeout(800);
    await page.getByRole("button", { name: /More/ }).first().click();
    await page.getByText("Edit this post").click();
    const ta = page.getByLabel("Your words");
    assert.equal((await ta.inputValue()).length, 4002);
    await ta.press("End"); await page.keyboard.type("!");
    assert.equal((await ta.inputValue()).length, 4003);
    await page.getByText("This post is longer than 2,500 characters. Shorten it to save your changes.").waitFor();
    const save = page.getByRole("button", { name: "Save changes" });
    assert.ok(await save.isDisabled());
    await page.screenshot({ path: `${OUT}/h1-profile-${w}.png` });
    assert.equal(reqs.filter((r) => r.m === "PATCH").length, 0);
    await ta.fill("y".repeat(2400));
    await save.click(); await page.waitForTimeout(500);
    const patch = reqs.filter((r) => r.m === "PATCH");
    assert.equal(patch.length, 1); assert.equal(JSON.parse(patch[0].body).body.length, 2400);
    await ctx.close();
  });
  // H1 from a thread
  await t(`H1 thread ${w}`, async () => {
    const { page, reqs, ctx } = await open({ w, h, extra: async (p, m, body, ok) => {
      if (p === "/answers/a9") { await ok(mk({ id: "a9", body: long })); return true; }
      if (p === "/answers/a9/replies") { await ok({ items: [], nextCursor: null }); return true; }
      if (p === "/questions/q1/answers") { await ok({ items: [mk({ id: "a9", body: long })], nextCursor: null }); return true; }
      if (m === "PATCH") { await ok(mk({ id: "a9" })); return true; }
      return false;
    } });
    await page.goto(ORIGIN + "/q/q1/a/a9"); await page.waitForTimeout(800);
    await page.getByRole("button", { name: /More/ }).first().click();
    await page.getByText("Edit this post").click();
    const ta = page.getByLabel("Your words");
    await ta.press("End"); await page.keyboard.type("!");
    assert.equal((await ta.inputValue()).length, 4003);
    assert.ok(await page.getByRole("button", { name: "Save changes" }).isDisabled());
    await page.screenshot({ path: `${OUT}/h1-thread-${w}.png` });
    assert.equal(reqs.filter((r) => r.m === "PATCH").length, 0);
    await ctx.close();
  });
  // M1 ideas
  await t(`M1 ideas ${w}`, async () => {
    const { page, ctx } = await open({ w, h, roles: ["ADMIN", "EDITOR", "MODERATOR"], extra: async (p, m, b, ok) => {
      if (p === "/admin/proposal-questions") { await ok({ items: [{ questionId: "q1", text: "Lagos floods: what should happen next?", weekNumber: 3, proposalCount: 4, groupCount: 1, ungroupedCount: 3 }] }); return true; }
      if (p === "/admin/proposals") { await ok({ question: { id: "q1", text: "Lagos floods: what should happen next?" }, items: [1, 2, 3].map((i) => ({ id: "p" + i, kind: "TEXT", text: "Clear the drains before the rain season starts, every year, in every ward " + i, supportCount: 4, challengeCount: 1, groupId: null, groupTitle: null, createdAt: now })), groups: [{ id: "g1", title: "Clear the drains", confirmed: true, proposalCount: 2 }], suggestions: [{ title: "Drain work", proposalIds: ["p1", "p2"] }] }); return true; }
      return false;
    } });
    await page.goto(ORIGIN + "/admin/ideas"); await page.waitForTimeout(800);
    await page.getByRole("listitem").first().click(); await page.waitForTimeout(600);
    await noH(page, "ideas");
    const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main input")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 43.5 || (r.width < 43.5 && e.tagName === "INPUT" && (e as HTMLInputElement).type === "checkbox")); }).map((e) => (e.textContent || e.id).slice(0, 20) + " " + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height)));
    if (w < 1024) assert.deepEqual(small, [], "small controls: " + small.join("; "));
    const split = page.getByRole("button", { name: "Split this group" });
    const box = await split.boundingBox();
    assert.ok(box && box.x + box.width <= w, "Split this group on screen");
    await page.screenshot({ path: `${OUT}/m1-ideas-${w}.png`, fullPage: true });
    await ctx.close();
  });
  // M2 news list + What Next
  await t(`M2 news and What Next ${w}`, async () => {
    const news = (a: object | null, id: string) => mk({ id, author: a, body: "Post by " + id, isMine: false, news: { tag: "UNVERIFIED_NEWS", sourceName: null, sourceUrl: null, chosenBy: "@x", chosenAt: now } });
    const prop = (a: object, id: string) => ({ id, questionId: "q1", author: a, kind: "TEXT", body: "Idea " + id, clip: null, label: "PROPOSED", supportCount: 1, challengeCount: 0, improveCount: 0, groupId: null, improvesId: null, myStance: null, createdAt: now, isMine: false });
    const { page, ctx } = await open({ w, h, extra: async (p, m, b, ok) => {
      if (p === "/news") { await ok({ items: [news(authors.admin, "n1"), news(authors.verified, "n2"), news(null, "n3"), news(authors.plain, "n4")], nextCursor: null }); return true; }
      if (p === "/news/tags") { await ok({ items: [] }); return true; }
      if (p === "/me/tag-follows") { await ok({ tags: [] }); return true; }
      if (p === "/questions/q1/what-next") { await ok({ question: question(), summary: null, proposalTotal: 3, groupTotal: 0, groups: [], proposals: [prop(authors.admin, "p1")], nextCursor: null }); return true; }
      if (p === "/questions/q1/proposals") { await ok({ items: [prop(authors.admin, "p1"), prop(authors.verified, "p2"), prop(authors.plain, "p3")], nextCursor: null }); return true; }
      return false;
    } });
    await page.goto(ORIGIN + "/news"); await page.waitForTimeout(1000);
    const arts = page.locator("article.vx-answer");
    const texts = await arts.evaluateAll((els: HTMLElement[]) => els.map((e) => ({ pill: !!e.querySelector(".vx-admin-pill"), tick: !!e.querySelector(".vx-tick"), anon: /Anonymous/.test(e.querySelector(".vx-answer__name")?.textContent ?? "") })));
    assert.deepEqual(texts.map((x: any) => [x.pill, x.tick]), [[true, true], [false, true], [false, false], [false, false]]);
    assert.ok(texts[2].anon);
    await page.screenshot({ path: `${OUT}/m2-news-${w}.png` });
    await page.goto(ORIGIN + "/q/q1/next"); await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/m2-whatnext-${w}.png` });
    assert.ok((await page.locator(".vx-admin-pill").count()) >= 1, "pill on What Next");
    await ctx.close();
  });
}
// M3 join intro on a phone
for (const [w, h] of [[390, 844], [360, 740]] as [number, number][]) {
  await t(`M3 join intro ${w}`, async () => {
    const { page, ctx } = await open({ w, h, signedIn: false });
    await page.goto(ORIGIN + "/join?next=" + encodeURIComponent("/q/q1/speak?from=abc123&mood=HOPEFUL")); await page.waitForTimeout(800);
    assert.equal(await page.getByRole("link", { name: "I have an account" }).count(), 0);
    await page.getByRole("button", { name: /Next/ }).click(); await page.getByRole("button", { name: /Next/ }).click();
    const link = page.getByRole("link", { name: "I have an account" });
    await link.waitFor();
    const box = await link.boundingBox();
    assert.ok(box && box.height >= 44, "44 px tall: " + box?.height);
    await page.screenshot({ path: `${OUT}/m3-intro-${w}.png` });
    await link.click(); await page.waitForURL("**/sign-in");
    const held = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
    assert.ok(held.includes("abc123") && held.includes("HOPEFUL"), "held return kept: " + held.slice(0, 200));
    await page.screenshot({ path: `${OUT}/m3-signin-${w}.png` });
    await ctx.close();
  });
}
// L1, L3, L4
await t("L1 news post with chosenBy null", async () => {
  const { page, ctx } = await open({ w: 390, h: 844, extra: async (p, m, b, ok) => {
    if (p === "/news/n1") { await ok(mk({ id: "n1", isMine: false, news: { tag: "GOSSIP", sourceName: null, sourceUrl: null, chosenBy: null, chosenAt: now } })); return true; }
    if (p === "/answers/n1/replies") { await ok({ items: [], nextCursor: null }); return true; }
    return false;
  } });
  const errs: string[] = []; page.on("pageerror", (e: Error) => errs.push(String(e)));
  await page.goto(ORIGIN + "/news/n1"); await page.waitForTimeout(1000);
  assert.deepEqual(errs, []);
  assert.ok(!(await page.locator("body").innerText()).includes("Application error"));
  await ctx.close();
});
await t("L4 settings switch 44 px", async () => {
  const { page, ctx } = await open({ w: 390, h: 844 });
  await page.goto(ORIGIN + "/settings"); await page.waitForTimeout(1000);
  const sw = page.getByRole("switch", { name: "News tag alerts" });
  await page.screenshot({ path: `${OUT}/l4-debug.png` });
  const box = await sw.boundingBox({ timeout: 5000 });
  assert.ok(box && box.height >= 44, "height " + box?.height);
  await sw.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/l4-settings-390.png` });
  await ctx.close();
});
// Home record flow
for (const [w, h] of SIZES) await t(`Home record flow ${w}`, async () => {
  const { page, ctx } = await open({ w, h });
  await page.goto(ORIGIN + "/"); await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/home-${w}.png` });
  await page.goto(ORIGIN + "/q/q1/speak"); await page.waitForURL("**/q/q1/mood**");
  const grp = page.getByRole("group", { name: "Pick one word" }); await grp.waitFor();
  await grp.getByRole("button", { name: /PROUD/i }).first().click();
  await page.getByRole("button", { name: "Say it in 60 seconds" }).waitFor();
  await page.screenshot({ path: `${OUT}/record-${w}.png` });
  await page.getByText("Type it instead").first().click(); await page.waitForURL("**/write**");
  await page.getByText(/proud/i).first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/write-${w}.png` });
  await ctx.close();
});
await browser.close();
console.log(failed ? "FAILED " + failed : "ALL OK");
process.exit(failed ? 1 : 0);
