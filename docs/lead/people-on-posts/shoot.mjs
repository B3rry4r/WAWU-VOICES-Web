// Real-browser check for V-PEOPLE-ON-POSTS: stubbed API, picture + Admin pill + long name + tick.
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
const reply = { id: uid(7), author: long, stance: "AGREE", kind: "TEXT", body: "I agree with this fully.", createdAt: new Date(Date.now() - 1800e3).toISOString(), helpfulCount: 1, isMine: false };
const profile = { profile: { id: long.id, handle: long.handle, displayName: long.displayName, avatarUrl: PIC, admin: true, countryCode: "NG", state: "Lagos", languages: ["en"], joinedAt: "2026-01-01T00:00:00Z", voiceCount: 4, voicesCount: 4, replyCount: 1, reactionsReceived: 9 }, isBlockedByMe: false, recentAnswers: answers, nextCursor: null };
const routes = [
  [/\/home$/, { topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: answers, newConversations: [], greetingName: null }],
  [/\/questions\/today$/, question], [/\/feed\/trending(\?.*)?$/, { items: answers.map(wrap), nextCursor: null }],
  [/\/feed\/trending-questions/, { items: [question], nextCursor: null }], [/\/topics\/current$/, topic],
  [/\/questions\/[^/]+\/answers/, { items: answers.map(wrap), nextCursor: null }], [/\/questions\/[^/]+$/, question],
  [/\/answers\/[^/]+\/replies/, { items: [reply], nextCursor: null }], [/\/answers\/[^/]+$/, answers[0]],
  [/\/people\/[^/]+\/replies/, { items: [reply], nextCursor: null }], [/\/people\/[^/]+/, profile],
  [/\/config\/public$/, { currency: "NGN", freePosts: 10, unitBaseKobo: 100, costs, tiers: [], extraVoice: [] }],
  [/\/categories/, { items: [] }], [/\/reactions$/, { items: [] }],
];
const unknown = new Set();
const browser = await chromium.launch({ executablePath: exePath });
const shots = [["home", "/"], ["question", `/q/${QID}`], ["thread", `/q/${QID}/a/${AID}`], ["profile", `/p/${long.id}`]];
const sets = (process.env.ONLY ? [[390, 844, true]] : [[390, 844, true], [1440, 900, false]]);
for (const [w, h, mobile] of sets) for (const scheme of (process.env.ONLY ? ["light"] : ["light", "dark"])) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await ctx.route("http://127.0.0.1:4010/**", async (route) => {
    const u = new URL(route.request().url()); const path = u.pathname.replace(/^\/api\/v1/, "") + u.search;
    const hit = routes.find(([re]) => re.test(path));
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (!hit) { unknown.add(route.request().method() + " " + path); return route.fulfill({ status: 404, headers: cors, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "x" } }) }); }
    return route.fulfill({ status: hit[1] === null ? 404 : 200, headers: cors, contentType: "application/json", body: JSON.stringify(hit[1] ?? { error: { code: "NOT_FOUND", message: "x" } }) });
  });
  await ctx.route("http://127.0.0.1:1/**", (r) => r.abort());
  for (const [name, path] of shots) {
    const page = await ctx.newPage();
    await page.on("pageerror", (e) => console.log("pageerror", name, String(e).slice(0, 160)));
    await page.goto(origin + path, { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector(".vx-answer, .vx-prof", { timeout: 15000 }).catch(() => console.log("no card on", name, w, scheme));
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const wide = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 4).map((e) => e.tagName + "." + String(e.className).slice(0, 40));
      const de = document.documentElement; const heads = [...document.querySelectorAll(".vx-answer__head")];
      const dots = heads.map((hd) => { const b = hd.querySelector('button[aria-label^="More"]'); return b ? b.getBoundingClientRect().right <= hd.getBoundingClientRect().right + 0.5 : null; }).filter((x) => x !== null);
      return { wide, sideways: de.scrollWidth > de.clientWidth, pills: [...document.querySelectorAll(".vx-admin-pill")].length, imgs: [...document.querySelectorAll(".vx-avatar img")].length, dotsInside: dots.every(Boolean) && dots.length };
    });
    console.log(name, w, scheme, JSON.stringify(m));
    await page.screenshot({ path: `${out}/${name}-${w}-${scheme}.png`, fullPage: false });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log("unknown api calls:", [...unknown].join(" | "));
