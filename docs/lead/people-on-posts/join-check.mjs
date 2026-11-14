// Join check for V-PEOPLE-ON-POSTS (after merging main): stubbed API, picture + Admin pill + long name + tick.
// node docs/lead/people-on-posts/shoot.mjs <origin> <outDir>
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
const origin = process.argv[2], out = process.argv[3];
const exe = ["/opt/pw-browsers/chromium", ...["chrome-linux64/chrome"].map((s) => `/opt/pw-browsers/${s}`)].find(existsSync);
import { readdirSync } from "node:fs";
const dir = readdirSync("/opt/pw-browsers").filter((d) => d.startsWith("chromium-")).sort().reverse()[0];
const exePath = dir ? ["chrome-linux64/chrome", "chrome-linux/chrome"].map((s) => `/opt/pw-browsers/${dir}/${s}`).find(existsSync) : exe;
const PIC = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#d8a23a"/><circle cx="48" cy="38" r="18" fill="#fff"/><rect x="18" y="62" width="60" height="40" rx="20" fill="#fff"/></svg>');
const uid = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const long = { id: uid(1), handle: "an_extremely_long_handle_for_a_person", displayName: "Chukwuemeka Oluwaseun Adebayo-Okonkwo", state: "Lagos", avatarUrl: PIC, admin: true };
const plain = { id: uid(2), handle: "ada", displayName: "Ada", state: "Abuja", avatarUrl: null };
const broken = { id: uid(3), handle: "bola", displayName: "Bola", state: "Kano", avatarUrl: "http://127.0.0.1:1/nope.png" };
const QID = uid(9), AID = uid(5);
const answer = (i, author, body) => ({ id: i === 0 ? AID : uid(5 + i * 0 + 0).replace(/.$/, String(i + 5)), questionId: QID, author, kind: "TEXT", body, createdAt: new Date(Date.now() - 3600e3).toISOString(), editedAt: null, status: "PUBLISHED", news: null, likeCount: 3, replyCount: 1, agreeCount: 0, disagreeCount: 0, reactionCount: 2, reactionBreakdown: [{ kind: "POWERFUL", count: 2 }], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], questionText: "What do you want from the next government?" });
const answers = [answer(0, long, "Roads, light and clinics that open on time."), answer(1, plain, "Jobs for young people."), answer(2, null, "I would rather not say my name."), answer(3, broken, "A picture that will not load.")];
const question = { id: QID, kind: "DAILY", status: "LIVE", text: "What do you want from the next government?", iSaved: false, recentVoices: [{ id: long.id, handle: long.handle, avatarUrl: PIC }, { id: plain.id, handle: plain.handle, avatarUrl: null }], scheduledFor: null, startsAt: null, endsAt: new Date(Date.now() + 36e5 * 9).toISOString(), pinned: false, sensitive: false, voiceCount: 4, answerCount: 4, voicesCount: 4, hasOpenPoll: false, proposalCount: 0 };
const costs = { textMaxChars: 2500, textPostMilli: 5000, voicePostMilli: 78000, baseKoboPerUnit: 100, textPriceChars: 150, freePostTextChars: 500, freeVoiceSeconds: 10 };
const wrap = (a) => ({ type: "answer", answer: a });
const topic = { id: uid(8), weekNumber: 46, title: "The next government", countryCode: "NG", startsOn: "2026-11-09", endsOn: "2026-11-15", status: "LIVE", sensitive: false, questionCount: 5, voiceCount: 4, voicesCount: 4 };
const reply0 = { id: uid(7), author: long, stance: "AGREE", kind: "TEXT", body: "I agree with this fully.", createdAt: new Date(Date.now() - 1800e3).toISOString(), helpfulCount: 1, isMine: false };
const profile = { profile: { id: long.id, handle: long.handle, displayName: long.displayName, avatarUrl: PIC, admin: true, countryCode: "NG", state: "Lagos", languages: ["en"], joinedAt: "2026-01-01T00:00:00Z", voiceCount: 4, voicesCount: 4, replyCount: 1, reactionsReceived: 9 }, isBlockedByMe: false, recentAnswers: answers, nextCursor: null };
const routes = [
  [/\/home$/, { topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: answers, newConversations: [], greetingName: null }],
  [/\/questions\/today$/, question], [/\/feed\/trending(\?.*)?$/, { items: answers.map(wrap), nextCursor: null }],
  [/\/feed\/trending-questions/, { items: [question], nextCursor: null }], [/\/topics\/current$/, topic],
  [/\/questions\/[^/]+\/answers/, { items: answers.map(wrap), nextCursor: null }], [/\/questions\/[^/]+$/, question],
  [/\/answers\/[^/]+\/replies/, { items: [], nextCursor: null }], [/\/answers\/[^/]+$/, answers[0]],
  [/\/people\/[^/]+\/replies/, { items: [], nextCursor: null }], [/\/people\/[^/]+/, profile],
  [/\/config\/public$/, { currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs, tiers: [], extraVoice: [] }],
  [/\/categories/, { items: [] }], [/\/reactions$/, { items: [] }],
];

const mk = (i, author, body) => ({ id: uid(20 + i), author, stance: "AGREE", kind: "TEXT", body, createdAt: new Date(Date.now() - 1800e3).toISOString(), helpfulCount: 1, isMine: false });
const reply = [mk(1, long, "Reply from an admin with a picture."), mk(2, broken, "Reply whose picture fails."), mk(3, null, "Reply with no name."), mk(4, plain, "Reply with initials.")];
const me = { id: plain.id, handle: "ada", displayName: "Ada", email: "a@x.test", roles: [] };
routes.unshift([/\/answers\/[^/]+\/replies/, { items: reply, nextCursor: null }]);
routes.unshift([/\/people\/[^/]+\/replies/, { items: reply, nextCursor: null }]);
routes.unshift([/\/me$/, me]);
routes.unshift([/\/me\/allowance/, { units: 100000, freePostsLeft: 5, costs }]);

const unknown = new Set();
const browser = await chromium.launch({ executablePath: exePath });
const state = [];
for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { try { localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" })); } catch {} });
  await ctx.route("http://127.0.0.1:4010/**", async (route) => {
    const u = new URL(route.request().url()); const path = u.pathname.replace(/^\/api\/v1/, "") + u.search;
    const hit = routes.find(([re]) => re.test(path));
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (/\/dm\//.test(path)) state.push("DM CALL " + path);
    if (!hit) { unknown.add(route.request().method() + " " + path); return route.fulfill({ status: 404, headers: cors, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "x" } }) }); }
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(hit[1]) });
  });
  await ctx.route("http://127.0.0.1:1/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 160)));
  // thread: replies
  await page.goto(origin + `/q/${QID}/a/${AID}`, { waitUntil: "load" });
  await page.waitForSelector(".vx-answer", { timeout: 15000 }); await page.waitForTimeout(1200);
  const t = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("article.vx-answer")];
    return cards.map((c) => ({ name: c.querySelector(".vx-answer__name")?.textContent, img: !!c.querySelector(".vx-avatar img"), pill: !!c.querySelector(".vx-admin-pill"), text: c.querySelector(".vx-answer__text")?.textContent?.slice(0, 30) }));
  });
  console.log("thread", w, JSON.stringify(t));
  await page.screenshot({ path: `${out}/join-thread-${w}.png`, fullPage: true });
  // answer cards on the question page
  await page.goto(origin + `/q/${QID}`, { waitUntil: "load" });
  await page.waitForSelector(".vx-answer", { timeout: 15000 }); await page.waitForTimeout(1200);
  console.log("question", w, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("article.vx-answer")].map((c) => ({ name: c.querySelector(".vx-answer__name")?.textContent, img: !!c.querySelector(".vx-avatar img"), pill: !!c.querySelector(".vx-admin-pill") })))));
  await page.screenshot({ path: `${out}/join-question-${w}.png`, fullPage: true });
  // write screen at 2499 / 2500 / 2501
  await page.goto(origin + `/q/${QID}/write`, { waitUntil: "load" });
  const ta = await page.waitForSelector("textarea", { timeout: 15000 }).catch(() => null);
  if (!ta) console.log("no textarea on write", w);
  else for (const n of [2499, 2500, 2501]) {
    await ta.fill("");
    await page.evaluate((n) => { const el = document.querySelector("textarea"); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(el, "a".repeat(n)); el.dispatchEvent(new Event("input", { bubbles: true })); }, n);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ len: document.querySelector("textarea").value.length, limit: document.querySelector(".vx-compose__limit")?.textContent ?? null, counter: [...document.querySelectorAll("*")].filter((e) => !e.children.length && /\d[\d,]*\s*\/\s*[\d,]+/.test(e.textContent || "")).map((e) => e.textContent.trim()).slice(0, 2) }));
    console.log("write", w, n, JSON.stringify(r));
    await page.screenshot({ path: `${out}/join-write-${w}-${n}.png` });
  }
  // home record flow
  await page.goto(origin + "/", { waitUntil: "load" }); await page.waitForTimeout(1500);
  const rec = page.getByRole("link", { name: /record|speak|add your voice/i }).first();
  console.log("home record link", w, await rec.count() ? await rec.getAttribute("href") : "none");
  await page.screenshot({ path: `${out}/join-home-${w}.png` });
  await page.goto(origin + `/speak?q=${QID}`, { waitUntil: "load" }); await page.waitForTimeout(1500);
  console.log("speak", w, JSON.stringify(await page.evaluate(() => document.body.innerText.slice(0, 300))));
  await page.screenshot({ path: `${out}/join-speak-${w}.png` });
  await ctx.close();
}
await browser.close();
console.log("state", JSON.stringify(state)); console.log("unknown api calls:", [...unknown].join(" | "));
