// V-PRELAUNCH proof against the built app (next start) with the API stubbed in the browser, clock fixed at 14 Nov 2026 05:18 UTC.
//   npx next build && npx next start -p 3981 &   then ORIGIN=http://127.0.0.1:3981 npx tsx e2e/prelaunch.e2e.mts
import { chromium, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3981';
const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/prelaunch/';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const BEFORE = new Date('2026-11-14T05:18:00Z');
const AFTER = new Date('2026-11-14T23:05:00Z');
const OPENS = '2026-11-14T23:00:00.000Z';
const me = { id: 'u1', handle: 'ada.o', displayName: 'Ada O', state: 'Lagos', avatarUrl: null };
const q = (over: object = {}) => ({ id: 'q9', kind: 'DAILY', status: 'SCHEDULED', startsAt: OPENS, endsAt: '2026-11-22T23:00:00.000Z', text: 'How do you feel about Nigeria right now?', hint: 'With everything going on, say it in your voice. 10 seconds.', moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: 't1', topicTitle: 'Are You Really Fine? You Dey Okay?', voiceCount: 0, voicesCount: 0, answerCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, ...over });
const topic = (over: object = {}) => ({ questionCount: 10, id: 't1', weekNumber: 1, title: 'Are You Really Fine? You Dey Okay?', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'SCHEDULED', sensitive: false, voiceCount: 0, voicesCount: 0, weeklyPollId: 'p1', reportId: null, whatNextPrompt: null, ...over });
const answer = { id: 'a1', questionId: 'q9', author: me, kind: 'TEXT', body: 'Hopeful, but tired of waiting.', clip: null, createdAt: '2026-11-14T23:02:00Z', editedAt: null, status: 'PUBLISHED', news: null, likeCount: 3, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: ['TRENDING'], mood: 'HOPEFUL', questionText: 'x' };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const meBody = { phoneMasked: '+234 803 *** 4412', id: 'u1', wawuId: 'w', handle: 'ada.o', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { ...me, bio: null, voiceCard: null, countryCode: 'NG', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } };

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let failed = 0;
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

async function open(w: number, state: 'before' | 'after', signedIn: boolean) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  await ctx.clock.setFixedTime(state === 'before' ? BEFORE : AFTER);
  if (signedIn) await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const live = state === 'after';
  const question = q(live ? { status: 'LIVE' } : {});
  const tp = topic(live ? { status: 'SCHEDULED' } : {});
  await ctx.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/home') return ok({ topicOfWeek: tp, dailyQuestion: question, flashPoll: null, trending: live ? [answer] : [], newConversations: [], sponsored: null, greetingName: signedIn ? 'Ada' : null });
    if (p === '/questions/today' || p === '/questions/q9') return ok(question);
    if (p === '/questions/q9/answers') return ok({ items: live ? [{ type: 'answer', answer }] : [], nextCursor: null });
    if (p === '/questions/q9/polls') return ok({ items: [] });
    if (p === '/topics/current') return ok(tp);
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return signedIn ? ok(allowance) : ok({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401);
    if (p === '/me') return signedIn ? ok(meBody) : ok({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401);
    if (p === '/me/answers') return ok({ items: [], nextCursor: null });
    if (p === '/polls/current' || p.startsWith('/polls')) return ok({ items: [] });
    if (p.startsWith('/feed/trending')) return ok({ items: [], nextCursor: null });
    return ok({ items: [], nextCursor: null });
  });
  const page = await ctx.newPage();
  return { page, ctx };
}
const text = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const shot = async (page: Page, name: string) => { await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false }); };
const pre = (s: string) => assert.doesNotMatch(s, /so far|Closes in|Poll open|Join the conversation|Trending answers|Top voices|No voices yet|Week 1 ·/i);

try {
  for (const w of [390, 1440]) for (const signedIn of [false, true]) {
    const who = signedIn ? 'in' : 'guest';
    await t(`Home ${who} ${w}, before 14 Nov 23:00 UTC: Coming up, Opens, Starts, no top voices, no buttons`, async () => {
      const { page, ctx } = await open(w, 'before', signedIn);
      await page.goto(`${ORIGIN}/`);
      await page.getByText('Coming up').first().waitFor();
      const s = await text(page);
      assert.match(s, /Opens Sunday 15 November/); assert.match(s, /Starts Monday 16 November/); assert.doesNotMatch(s, /Today’s question/i);
      pre(s);
      for (const b of ['Listen', 'Discuss', 'Vote', 'Add your voice', 'Speak']) assert.equal(await page.locator('.vx-hero').getByRole('button', { name: b, exact: true }).count(), 0, `${b} still on the card`);
      assert.equal(await page.getByRole('button', { name: 'Join the conversation' }).count(), 0);
      assert.ok((await page.locator('.vx-hero').getByRole('button', { name: 'Share', exact: true }).count()) > 0, 'Share is missing on the coming-up card');
      await shot(page, `home-${who}-${w}-before`); await ctx.close();
    });
    await t(`Home ${who} ${w}, after it opens: normal card, today's top voices`, async () => {
      const { page, ctx } = await open(w, 'after', signedIn);
      await page.goto(`${ORIGIN}/`);
      await page.getByText('Hopeful, but tired of waiting.').first().waitFor();
      const s = await text(page);
      assert.match(s, /Today’s question/i); assert.match(s, /0 voices so far/); assert.doesNotMatch(s, /Coming up|Opens Sunday/i);
      assert.match(s, w < 600 ? /Trending answers/i : /Top voices on today’s question/i);
      await shot(page, `home-${who}-${w}-after`); await ctx.close();
    });
  }
  for (const w of [390, 1440]) {
    await t(`question page ${w} before and after`, async () => {
      let r = await open(w, 'before', false);
      await r.page.goto(`${ORIGIN}/q/q9`);
      await r.page.getByTestId('q-coming-up').waitFor();
      let s = await text(r.page);
      assert.match(s, /How do you feel about Nigeria right now\?/); assert.match(s, /say it in your voice/); assert.match(s, /Opens Sunday 15 November/);
      assert.doesNotMatch(s, /so far|Closes in|No voices yet|Write instead/i);
      assert.equal(await r.page.getByRole('button', { name: /^(Speak|Write instead|Listen|Discuss|Vote)$/ }).count(), 0);
      assert.ok((await r.page.getByRole('button', { name: 'Share this question' }).count()) > 0, 'Share is missing on the coming-up question page');
      await shot(r.page, `question-${w}-before`); await r.ctx.close();
      r = await open(w, 'after', false);
      await r.page.goto(`${ORIGIN}/q/q9`);
      await r.page.getByText('Hopeful, but tired of waiting.').first().waitFor();
      s = await text(r.page); assert.doesNotMatch(s, /Coming up|Opens Sunday/i);
      await shot(r.page, `question-${w}-after`); await r.ctx.close();
    });
    await t(`/join ${w} before and after`, async () => {
      let r = await open(w, 'before', false);
      await r.page.goto(`${ORIGIN}/join`);
      await r.page.getByText('Coming up').locator('visible=true').first().waitFor();
      let s = await text(r.page); assert.match(s, /Opens Sunday 15 November/); assert.doesNotMatch(s, /so far|Closes in/i);
      await shot(r.page, `join-${w}-before`); await r.ctx.close();
      r = await open(w, 'after', false);
      await r.page.goto(`${ORIGIN}/join`);
      await r.page.getByText('Today’s question').locator('visible=true').first().waitFor();
      s = await text(r.page); assert.doesNotMatch(s, /Coming up|Opens Sunday/i);
      await shot(r.page, `join-${w}-after`); await r.ctx.close();
    });
    await t(`landing /welcome ${w} before and after`, async () => {
      let r = await open(w, 'before', false);
      await r.page.goto(`${ORIGIN}/welcome`);
      await r.page.getByText('Coming up').locator('visible=true').first().waitFor();
      let s = await text(r.page); assert.match(s, /Opens Sunday 15 November/); assert.doesNotMatch(s, /so far|Closes in/i);
      await shot(r.page, `landing-${w}-before`); await r.ctx.close();
      r = await open(w, 'after', false);
      await r.page.goto(`${ORIGIN}/welcome`);
      await r.page.getByText('Today’s question').locator('visible=true').first().waitFor();
      s = await text(r.page); assert.doesNotMatch(s, /Coming up|Opens Sunday/i);
      await shot(r.page, `landing-${w}-after`); await r.ctx.close();
    });
  }
} finally { await browser.close(); }
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
