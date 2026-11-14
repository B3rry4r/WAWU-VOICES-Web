// V-PRELAUNCH round 2 proof against the built app (next start), the API stubbed (the browser's calls by route, the share page's server calls by a small server).
//   VOICES_API_BASE=http://127.0.0.1:4010/api/v1 npx next start -p 3981 &   then   npx tsx e2e/opening.e2e.mts
// Part A: pictures before and after opening (clock fixed). Part B: the opening itself on a running clock, five screens untouched, and a page that slept through it.
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3981';
const SHOTS = process.env.SHOTS ?? 'docs/lead/prelaunch/shots-r2/';
mkdirSync(SHOTS, { recursive: true });
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const BEFORE = new Date('2026-11-14T05:18:00Z');
const AFTER = new Date('2026-11-14T23:05:00Z');
const OPENS = '2026-11-14T23:00:00.000Z';
const OPENS_MS = Date.parse(OPENS);
const me = { id: 'u1', handle: 'ada.o', displayName: 'Ada O', state: 'Lagos', avatarUrl: null };
const q = (over: object = {}) => ({ id: 'q9', kind: 'DAILY', status: 'SCHEDULED', startsAt: OPENS, endsAt: '2026-11-22T23:00:00.000Z', text: 'How do you feel about Nigeria right now?', hint: 'With everything going on, say it in your voice. 10 seconds.', moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: 't1', topicTitle: 'Are You Really Fine? You Dey Okay?', voiceCount: 0, voicesCount: 0, answerCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, ...over });
const topic = (over: object = {}) => ({ questionCount: 10, id: 't1', weekNumber: 1, title: 'Are You Really Fine? You Dey Okay?', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'SCHEDULED', sensitive: false, voiceCount: 0, voicesCount: 0, weeklyPollId: 'p1', reportId: null, whatNextPrompt: null, ...over });
const answer = { id: 'a1', questionId: 'q9', author: me, kind: 'TEXT', body: 'Hopeful, but tired of waiting.', clip: null, createdAt: '2026-11-14T23:02:00Z', editedAt: null, status: 'PUBLISHED', news: null, likeCount: 3, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: ['TRENDING'], mood: 'HOPEFUL', questionText: 'x' };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const meBody = { phoneMasked: '+234 803 *** 4412', id: 'u1', wawuId: 'w', handle: 'ada.o', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { ...me, bio: null, voiceCard: null, countryCode: 'NG', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } };

// The stub's one switch: the API says LIVE once `isOpen()` is true. Part A sets it per context; Part B sets a real moment.
let openAtReal = Infinity; // real time (ms) at which the API starts to say LIVE
let forceOpen: boolean | null = null;
const isOpen = () => (forceOpen !== null ? forceOpen : Date.now() >= openAtReal);
let linkRefused = false;
const reqs: string[] = [];

const sharePage = (live: boolean) => ({ code: 'c1', objectType: 'QUESTION', topicLine: 'How do you feel about Nigeria right now?', countryAndTheme: 'Nigeria', arguments: [], leanLine: null, poll: null, proposalCount: null, topProposal: null, news: null, basedOnVoices: 0, summaryUpdatedAt: '2026-11-14T05:00:00Z', summaryLabel: 'Opens Sunday 15 November', featuredVoice: null, transcript: null, question: q(live ? { status: 'LIVE' } : {}), report: null, cardFallback: false, ctaLabel: 'Add your voice', openGraph: { title: 'How do you feel about Nigeria right now?', description: 'Opens Sunday 15 November', imageUrl: 'http://127.0.0.1:4010/c.png', url: 'http://127.0.0.1:3981/s/c1' } });
const server = createServer((req, res) => {
  const p = (req.url ?? '').split('?')[0];
  res.setHeader('content-type', 'application/json');
  if (p === '/api/v1/share/c1') { reqs.push(p); res.end(JSON.stringify(sharePage(isOpen()))); return; }
  res.statusCode = 404; res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }));
});
await new Promise<void>((r) => server.listen(4010, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let failed = 0;
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

async function open(w: number, signedIn: boolean, clock: { fixed?: Date; install?: Date; open?: boolean }, hasReport = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 2 });
  if (clock.fixed) await ctx.clock.setFixedTime(clock.fixed);
  if (clock.install) await ctx.clock.install({ time: clock.install });
  if (signedIn) await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace('/api/v1', '');
    reqs.push(p);
    const live = clock.open !== undefined ? clock.open : isOpen();
    const question = q(live ? { status: 'LIVE' } : {});
    const tp = topic(live ? { status: 'SCHEDULED' } : {});
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/home') return ok({ topicOfWeek: tp, dailyQuestion: question, flashPoll: null, trending: live ? [answer] : [], newConversations: [], sponsored: null, greetingName: signedIn ? 'Ada' : null });
    if (p === '/questions/today' || p === '/questions/q9') return ok(question);
    if (p === '/questions/q9/answers') return ok({ items: live ? [{ type: 'answer', answer }] : [], nextCursor: null });
    if (p === '/questions/q9/polls') return ok({ items: [] });
    if (p === '/questions/q9/moods') return ok({ total: 0, items: [] });
    if (p === '/topics/current') return ok(tp);
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return signedIn ? ok(allowance) : ok({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401);
    if (p === '/me') return signedIn ? ok(meBody) : ok({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401);
    if (p === '/me/answers') return ok({ items: [], nextCursor: null });
    if (p === '/weekly-reports/latest') return ok(hasReport ? { id: 'r1' } : null);
    if (p === '/share/links') return linkRefused ? ok({ error: { code: 'NOT_FOUND', message: 'no' } }, 404) : ok({ code: 'c1', url: 'https://usevoices.com/s/c1', cardStatus: 'FALLBACK', imageUrl: null, previewText: 'How do you feel about Nigeria right now?\nhttps://usevoices.com/s/c1' });
    if (p.startsWith('/polls/current')) return ok(null);
    if (p.startsWith('/polls')) return ok({ items: [] });
    if (p.startsWith('/feed/trending')) return ok({ items: [], nextCursor: null });
    return ok({ items: [], nextCursor: null });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('     console.error: ' + m.text().slice(0, 400)); });
  return { page, ctx };
}
const text = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const shot = async (page: Page, name: string) => { await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false }); };
const vis = (page: Page, s: string) => page.getByText(s, { exact: false }).locator('visible=true').first();

// ---------- Part A: pictures ----------
try {
  for (const w of [390, 1440]) {
    for (const state of ['before', 'after'] as const) {
      const live = state === 'after';
      const fixed = live ? AFTER : BEFORE;
      const marker = live ? 'Today’s question' : 'Coming up';
      for (const signedIn of [false, true]) await t(`home ${signedIn ? 'in' : 'guest'} ${w} ${state}`, async () => {
        const { page, ctx } = await open(w, signedIn, { fixed, open: live });
        await page.goto(`${ORIGIN}/`); await vis(page, marker).waitFor();
        const s = await text(page);
        if (!live) assert.doesNotMatch(s, /Listening is free|What Nigeria said this week|New conversations|Nothing new yet|Trending answers|Top voices/);
        await shot(page, `home-${signedIn ? 'in' : 'guest'}-${w}-${state}`); await ctx.close();
      });
      await t(`welcome ${w} ${state}`, async () => {
        const { page, ctx } = await open(w, false, { fixed, open: live });
        await page.goto(`${ORIGIN}/welcome`); await vis(page, marker).waitFor();
        const s = await text(page);
        if (!live) { assert.doesNotMatch(s, /Listen as a guest|Add your voice/); assert.ok(await page.getByRole('link', { name: 'Join VOICES' }).locator('visible=true').count()); }
        await shot(page, `welcome-${w}-${state}`); await ctx.close();
      });
      await t(`go ${w} ${state}`, async () => {
        const { page, ctx } = await open(w, false, { fixed, open: live });
        await page.goto(`${ORIGIN}/go`); await page.locator(live ? '[data-testid=go-ANGRY]' : '[data-testid=go-opens]').waitFor();
        const s = await text(page);
        if (!live) assert.doesNotMatch(s, /Listen as a guest|Add your voice/);
        await shot(page, `go-${w}-${state}`); await ctx.close();
      });
      await t(`join ${w} ${state}`, async () => {
        const { page, ctx } = await open(w, false, { fixed, open: live });
        await page.goto(`${ORIGIN}/join`); await vis(page, marker).waitFor();
        const slides = w < 600 ? 3 : 1;
        for (let i = 0; i < slides; i++) {
          const s = await text(page);
          if (!live) assert.doesNotMatch(s, /0:06|Open poll|Relatable|Thought-provoking/);
          await shot(page, `join-${w}-${state}-${i + 1}`);
          if (i < slides - 1) await page.getByRole('button', { name: 'Next' }).click();
        }
        await ctx.close();
      });
      await t(`question ${w} ${state}`, async () => {
        const { page, ctx } = await open(w, false, { fixed, open: live });
        await page.goto(`${ORIGIN}/q/q9`);
        if (live) await vis(page, 'Hopeful, but tired of waiting.').waitFor(); else await page.getByTestId('q-coming-up').waitFor();
        await shot(page, `question-${w}-${state}`); await ctx.close();
      });
      await t(`speak destination ${w} ${state}`, async () => {
        const { page, ctx } = await open(w, false, { fixed, open: live });
        await page.goto(`${ORIGIN}/speak`);
        if (!live) {
          await page.getByTestId('q-coming-up').waitFor();
          assert.doesNotMatch(await text(page), /has closed|Today’s question/);
        } else await page.waitForTimeout(1500);
        await shot(page, `speak-${w}-${state}`);
        if (!live) for (const path of ['/q/q9/write', '/q/q9/speak', '/q/q9/mood', '/q/q9/propose', '/q/q9/vote', '/q/q9/results', '/q/q9/posted']) {
          await page.goto(`${ORIGIN}${path}`); await page.getByTestId('q-coming-up').waitFor();
          assert.doesNotMatch(await text(page), /has closed|Your voice is live|Propose a next step|No poll on this question/, path);
        }
        await ctx.close();
      });
      await t(`share page ${w} ${state}`, async () => {
        forceOpen = live;
        const { page, ctx } = await open(w, false, { fixed, open: live });
        await page.goto(`${ORIGIN}/s/c1`);
        await vis(page, live ? 'Add your voice' : 'Opens Sunday 15 November').waitFor();
        const s = await text(page);
        if (!live) assert.doesNotMatch(s, /We could not find|Add your voice|so far/);
        await shot(page, `share-${w}-${state}`); await ctx.close(); forceOpen = null;
      });
    }
    await t(`share sheet on the coming-up card ${w}`, async () => {
      for (const refused of [false, true]) {
        linkRefused = refused;
        const { page, ctx } = await open(w, false, { fixed: BEFORE, open: false });
        await page.goto(`${ORIGIN}/`); await vis(page, 'Coming up').waitFor();
        await page.locator('.vx-hero').getByRole('button', { name: 'Share', exact: true }).click();
        await page.getByRole('dialog').waitFor().catch(() => undefined);
        await page.waitForTimeout(800);
        if (refused) assert.match(await text(page), /We cannot make a share link for this question yet/);
        await shot(page, `share-sheet-${refused ? 'refused' : 'ok'}-${w}`); await ctx.close();
      }
      linkRefused = false;
    });
  }

  // ---------- Part B: the opening on a running clock ----------
  const screens: [string, string, (p: Page) => Promise<boolean>][] = [
    ['home', '/', async (p) => /today’s question/i.test(await text(p)) && !/Opens Sunday/.test(await text(p))],
    ['welcome', '/welcome', async (p) => /today’s question/i.test(await text(p)) && !/Opens Sunday/.test(await text(p))],
    ['join', '/join', async (p) => /today’s question/i.test(await text(p)) && !/Opens Sunday/.test(await text(p))],
    ['go', '/go', async (p) => (await p.locator('[data-testid=go-ANGRY]').count()) > 0],
    ['question', '/q/q9', async (p) => (await p.getByTestId('q-coming-up').count()) === 0 && /Hopeful, but tired/.test(await text(p))],
  ];
  const measure = async (sleep: boolean) => {
    const out: Record<string, number> = {};
    const before = reqs.length;
    const runs = await Promise.all(screens.map(async ([name, path, isLive]) => {
      const { page, ctx } = await open(1440, false, {});
      return { name, path, isLive, page, ctx };
    }));
    // all clocks installed at the same real moment, 30 s before the instant; the API turns at the same real moment
    const t0 = Date.now();
    openAtReal = t0 + 30_000 + 4_000; // the pages load first (about 4 s), then the 30 s run
    for (const r of runs) await r.ctx.clock.install({ time: new Date(OPENS_MS - 30_000 - 4_000) });
    await Promise.all(runs.map((r) => r.page.goto(`${ORIGIN}${r.path}`)));
    await Promise.all(runs.map((r) => vis(r.page, 'Opens Sunday 15 November').waitFor({ timeout: 20_000 })));
    const loaded = reqs.length;
    if (!sleep) {
      await new Promise((r) => setTimeout(r, Math.max(0, openAtReal - 2_000 - Date.now())));
      const quiet = reqs.length - loaded;
      console.log(`     requests between load and 2 s before the instant: ${quiet}`);
      assert.equal(quiet, 0, 'requests were made before the instant');
      await Promise.all(runs.map(async (r) => {
        for (;;) { if (await r.isLive(r.page)) break; await r.page.waitForTimeout(100); if (Date.now() - openAtReal > 15_000) throw new Error(`${r.name} not live 15 s after the instant: ${(await text(r.page)).slice(0, 300)}`); }
        out[r.name] = Date.now() - openAtReal;
      }));
    } else {
      // a phone asleep through the instant: stop the page's clock before it, flip the API, jump the clock, wake it
      for (const r of runs) await r.ctx.clock.pauseAt(new Date(OPENS_MS - 10_000));
      forceOpen = true;
      for (const r of runs) await r.ctx.clock.setFixedTime(new Date(OPENS_MS + 8 * 3_600_000));
      const wake = Date.now();
      for (const r of runs) await r.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
      await Promise.all(runs.map(async (r) => {
        for (;;) { if (await r.isLive(r.page)) break; await r.page.waitForTimeout(50); if (Date.now() - wake > 10_000) throw new Error(`${r.name} not live 10 s after waking: ${(await text(r.page)).slice(0, 300)}`); }
        out[r.name] = Date.now() - wake;
      }));
      forceOpen = null;
    }
    for (const r of runs) await r.ctx.close();
    openAtReal = Infinity; void before;
    return out;
  };
  await t('the opening on a running clock: five screens untouched, live within 10 s, no polling before', async () => {
    const o = await measure(false);
    console.log('     ms from the instant to live: ' + JSON.stringify(o));
    for (const [k, v] of Object.entries(o)) assert.ok(v <= 10_000, `${k} took ${v} ms`);
  });
  await t('a page asleep through the instant is live within 2 s of waking', async () => {
    const o = await measure(true);
    console.log('     ms from waking to live: ' + JSON.stringify(o));
    for (const [k, v] of Object.entries(o)) assert.ok(v <= 2_000, `${k} took ${v} ms`);
  });
} finally { await browser.close(); server.close(); }
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
