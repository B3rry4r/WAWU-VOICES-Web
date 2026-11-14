// V-ANON proof against the built app (next start) with the API stubbed in the browser.
//   npx next build && npx next start -p 3961 &   then ORIGIN=http://127.0.0.1:3961   npx tsx e2e/anon.e2e.mts
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3917';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const me = { id: 'u1', handle: 'me.handle', displayName: 'Me Person', state: null, avatarUrl: null };
const answer = (over: object) => ({ id: 'a1', questionId: 'q1', author: me, kind: 'TEXT', body: 'Salary goes in two hours.', clip: null, createdAt: new Date().toISOString(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null, ...over });
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'When salary arrives, how long before it is gone?', hint: null, moodOptions: [], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, costs: config.costs };

const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

async function open(posted: object) {
  const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const posts: Record<string, unknown>[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname.replace('/api/v1', '');
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (req.method() === 'POST' && p === '/questions/q1/answers') { posts.push(JSON.parse(req.postData() ?? '{}')); return ok({ answer: answer({ id: 'new1' }) }, 201); }
    if (p === '/questions/q1') return ok(question);
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance);
    if (p === '/answers/new1') return ok(posted);
    if (p === '/share/links') return ok({ code: 'c1', url: 'https://usevoices.com/s/c1', cardStatus: 'PENDING' });
    if (p === '/voice-clips') return ok({ clip: { id: 'c1', status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (p === '/voice-clips/c1/complete') return ok({ id: 'c1', status: 'PROCESSING' });
    if (p === '/voice-clips/c1') return ok({ id: 'c1', status: 'READY' });
    return ok({}, 404);
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  return { page: await ctx.newPage(), posts, ctx };
}

try {
  for (const on of [false, true]) {
    await t(`write screen, switch ${on ? 'on sends anonymous true' : 'off sends no anonymous'}`, async () => {
      const { page, posts, ctx } = await open(answer({ author: on ? null : me }));
      await page.goto(`${ORIGIN}/q/q1/write`);
      const sw = page.getByRole('switch', { name: 'Post without my name' });
      await sw.waitFor();
      assert.equal(await sw.isChecked(), false, 'default off');
      assert.ok(await page.getByText('Your name and photo stay hidden. Admins can still see who posted, to keep Voices safe.').isVisible());
      if (on) await sw.check();
      await page.getByRole('textbox').fill('Salary goes in two hours.');
      await page.getByRole('button', { name: /^(Post|Send)/ }).first().click();
      await page.waitForURL('**/posted?a=new1');
      assert.equal(posts.length, 1);
      if (on) assert.equal(posts[0].anonymous, true); else assert.ok(!('anonymous' in posts[0]), JSON.stringify(posts[0]));
      assert.ok(!('showNameOnCard' in posts[0]));
      await page.getByText('Your voice is live').waitFor();
      const body = await page.locator('body').innerText();
      if (on) { assert.ok(!body.includes('me.handle') && !body.includes('Me Person'), 'name shown on posted screen'); assert.ok(body.includes('Anonymous')); }
      else assert.ok(body.includes('@me.handle'));
      await page.screenshot({ path: `/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/anon-posted-${on ? 'on' : 'off'}.png` });
      await ctx.close();
    });
  }
  await t('posted screen of an anonymous mood answer: no name, no name-on-card switch', async () => {
    const { page, ctx } = await open(answer({ author: null, mood: 'HOPEFUL' }));
    await ctx.route('**/api/v1/answers/new1/where-you-sit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answerId: 'new1', questionId: 'q1', mood: 'HOPEFUL', showNameOnCard: false, defaultScope: 'NIGERIA', showSwitch: false, nigeria: { percent: null, count: 3 }, world: { percent: null, count: 3 }, cardLine: 'You’re one of the first.', updatedAt: 'x' }) }));
    await ctx.route('**/api/v1/me/invite', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'ab', url: 'https://usevoices.com/go/ab', friendsAnswered: 0 }) }));
    await page.goto(`${ORIGIN}/q/q1/posted?a=new1`);
    await page.getByTestId('anon-posted').waitFor();
    assert.equal(await page.getByRole('switch', { name: 'Show my name on the card' }).count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes('me.handle'));
    await ctx.close();
  });
  for (const on of [false, true]) {
    await t(`record screen, switch ${on ? 'on sends anonymous true' : 'off sends no anonymous'}`, async () => {
      const { page, posts, ctx } = await open(answer({ author: on ? null : me, kind: 'VOICE' }));
      await page.goto(`${ORIGIN}/q/q1/speak`);
      await page.getByRole('button', { name: 'Start recording' }).click();
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Stop recording' }).click();
      const sw = page.getByRole('switch', { name: 'Post without my name' });
      await sw.waitFor();
      assert.equal(await sw.isChecked(), false, 'default off');
      if (on) await sw.check();
      await page.screenshot({ path: `/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/anon-record-${on ? 'on' : 'off'}.png` });
      await page.getByRole('button', { name: /^Send/ }).click();
      await page.waitForURL('**/posted?a=new1', { timeout: 20000 });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].kind, 'VOICE');
      if (on) assert.equal(posts[0].anonymous, true); else assert.ok(!('anonymous' in posts[0]));
      assert.ok(!('showNameOnCard' in posts[0]));
      await ctx.close();
    });
  }
} finally { await browser.close(); }
if (failed) { console.log(failed + ' failed'); process.exit(1); }
