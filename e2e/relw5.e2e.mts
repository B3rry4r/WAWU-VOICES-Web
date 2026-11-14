// REL-W4 join proof against the built app (next start) with the API stubbed in the browser.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/fixb.e2e.mts
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3977';
const OUT = process.env.OUT ?? '/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad';
const exe = process.env.CHROMIUM_PATH ?? (() => {
  for (const root of ['/opt/pw-browsers']) for (const d of readdirSync(root).filter((x) => x.startsWith('chromium-')).sort().reverse()) for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) if (existsSync(`${root}/${d}/${sub}`)) return `${root}/${d}/${sub}`;
  return undefined;
})();
const me = { id: 'u1', handle: 'me.handle', displayName: 'Me Person', state: null, avatarUrl: null };
const answer = (over: object) => ({ id: 'a1', questionId: 'q1', author: me, kind: 'TEXT', body: 'Salary goes in two hours.', clip: null, createdAt: new Date().toISOString(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null, ...over });
const question = (over: object = {}) => ({ id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'Lagos floods: are you and your family safe?', hint: null, moodOptions: [], category: null, topicId: 't1', topicTitle: 'Campaign Season', voiceCount: 1, answerCount: 1, voicesCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: new Date(Date.now() - 3600e3).toISOString(), endsAt: new Date(Date.now() + 20 * 3600e3).toISOString(), override: null, ...over });
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 60, costs: { freeVoiceSeconds: 60, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, costs: config.costs };
const topic = { id: 't1', weekNumber: 3, title: 'Campaign Season', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 40, questionCount: 7 };
// a 1x1 PNG, served for the stub CDN
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// 0.5 s of silence as a real WAV, so the browser can play what the stub serves
const wav = (() => { const n = 8000 * 0.5, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

interface Opts { mood?: boolean; extra?: (p: string, m: string, body: string, ok: (b: unknown, status?: number) => Promise<void>) => Promise<boolean>; w?: number; h?: number; signedIn?: boolean; override?: object | null; audioAd?: object | null; roles?: string[]; scheme?: 'light' | 'dark' }
async function open(o: Opts = {}) {
  const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: o.w ?? 390, height: o.h ?? 844 }, colorScheme: o.scheme ?? 'light' });
  if (o.signedIn !== false) await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const posts: Record<string, unknown>[] = [];
  const events: { id: string; kind: string }[] = [];
  const plays: string[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname.replace('/api/v1', '');
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (o.extra && (await o.extra(p, req.method(), req.postData() ?? '', ok))) return;
    if (req.method() === 'POST' && p === '/questions/q1/answers') { posts.push(JSON.parse(req.postData() ?? '{}')); return ok({ answer: answer({ id: 'new1' }) }, 201); }
    if (req.method() === 'POST' && p.startsWith('/ads/') && p.endsWith('/events')) { events.push({ id: p.split('/')[2], kind: JSON.parse(req.postData() ?? '{}').kind }); return route.fulfill({ status: 204 }); }
    if (p === '/questions/q1') return ok(question());
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance);
    if (p === '/me') return ok({ id: 'u1', handle: 'me.handle', profileComplete: true, roles: o.roles ?? [], profile: { displayName: 'Me Person' }, allowances: allowance, status: 'ACTIVE', unreadNotifications: 0 });
    if (p === '/home') return ok({ topicOfWeek: topic, dailyQuestion: question({ override: o.override ?? null }), flashPoll: null, trending: [answer({ id: 'a1' }), answer({ id: 'a2', body: 'Two hours is generous.' })], newConversations: [], greetingName: null });
    if (p === '/feed/trending-questions') return ok({ items: [], nextCursor: null });
    if (p === '/polls/flash') return ok({ items: [] });
    if (p === '/ads/placement') return ok({ ad: u.searchParams.get('kind') === 'AUDIO_SLOT' ? (o.audioAd ?? null) : null });
    if (p.startsWith('/voice-clips/') && p.endsWith('/play')) { plays.push(p.split('/')[2]); return ok({ url: ORIGIN + '/__audio', expiresAt: 'x', mime: 'audio/mp4' }); }
    if (p === '/voice-clips') return ok({ clip: { id: 'c1', status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (p === '/voice-clips/c1/complete') return ok({ id: 'c1', status: 'PROCESSING' });
    if (p === '/voice-clips/c1') return ok({ id: 'c1', status: 'READY' });
    if (p === '/answers/new1') return ok(answer({ id: 'new1' }));
    if (p === '/share/links') return ok({ code: 'c1', url: 'https://usevoices.com/s/c1', cardStatus: 'PENDING' });
    return ok({}, 404);
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route('**/__audio', (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }));
  await ctx.route('https://cdn.fixb.test/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return { page: await ctx.newPage(), posts, events, plays, ctx };
}
const shot = (page: import('playwright-core').Page, name: string) => page.screenshot({ path: `/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/w5-shots/w5-${name}.png` });

const MOODS = ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'];
const mq = () => question({ moodOptions: MOODS });
const moodExtra = (more?: Opts['extra']): Opts['extra'] => async (p, m, body, ok) => {
  if (p === '/questions/q1' || p === '/questions/today') { await ok(mq()); return true; }
  if (p === '/home') { await ok({ topicOfWeek: topic, dailyQuestion: mq(), flashPoll: null, trending: [answer({ id: 'a1' })], newConversations: [], greetingName: null }); return true; }
  return more ? more(p, m, body, ok) : false;
};
const adminToday = { date: '2026-11-15', weekNumber: 1, topic, flowState: 'NORMAL', todaysQuestion: question(), stats: { sharesByTarget: [], voicesToday: 0, voicePercent: 0, pollVotes: 0, shares: 0, openReports: 0, oldestReportMinutes: null, dailyQuestionMailsToday: 0, weeklyTopicMailsToday: 0, topicMailBudgetLeftToday: 0 }, schedule: [], nextQuestion: null, needsAttention: { flaggedNews: 0, askingVerified: 1, openReports: 0, adsAwaiting: 0, resultsToCheck: 0, newsTags: 1 } };
const noHScroll = async (page: import('playwright-core').Page) => {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(r.sw <= r.cw, `horizontal scroll ${r.sw} > ${r.cw}`);
};
try {
  for (const picked of [false, true]) {
    await t(`record /q/q1/speak and /mood, ${picked ? 'Gossip picked' : 'no tag'}`, async () => {
      const { page, posts, ctx } = await open({ extra: moodExtra() });
      await page.goto(`${ORIGIN}/q/q1/speak`);
      await page.waitForURL('**/q/q1/mood**');
      await page.getByText('Lagos floods: are you and your family safe?').first().waitFor();
      const grp = page.getByRole('group', { name: 'Pick one word' });
      await grp.waitFor();
      for (const w of MOODS) assert.ok(await grp.getByRole('button', { name: new RegExp(w, 'i') }).first().isVisible(), w);
      await grp.getByRole('button', { name: /PROUD/i }).first().click();
      await page.getByRole('button', { name: 'Say it in 60 seconds' }).waitFor();
      assert.ok(await page.getByText('Type it instead').first().isVisible());
      if (!picked) await shot(page, 'speak-390');
      await page.getByRole('button', { name: /Say it in/ }).click();
      await page.getByRole('button', { name: 'Start recording' }).click().catch(() => undefined);
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Stop recording' }).click();
      await page.getByRole('group', { name: 'Tag your post' }).waitFor();
      assert.deepEqual(await page.locator('.vx-tagpick [aria-pressed="true"]').allInnerTexts(), ['Not news']);
      if (picked) { await page.getByRole('button', { name: 'Gossip' }).click(); await shot(page, 'speak-tag-390'); }
      await page.getByRole('button', { name: /^Send/ }).click();
      await page.waitForURL('**/posted?a=new1', { timeout: 20000 });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].kind, 'VOICE');
      assert.ok(String(posts[0].mood).toUpperCase().includes('PROUD'), 'mood PROUD');
      if (picked) { assert.equal(posts[0].isNews, true); assert.equal(posts[0].newsTag, 'GOSSIP'); }
      else { assert.equal(posts[0].isNews, undefined); assert.equal(posts[0].newsTag, undefined); }
      await ctx.close();
    });
  }
  await t('Type it instead opens the write screen with the word kept', async () => {
    const { page, ctx } = await open({ extra: moodExtra() });
    await page.goto(`${ORIGIN}/q/q1/mood`);
    await page.getByRole('group', { name: 'Pick one word' }).getByRole('button', { name: /PROUD/i }).first().click();
    await page.getByText('Type it instead').first().click();
    await page.waitForURL('**/write**');
    await page.getByText('Your word').first().waitFor({ timeout: 15000 });
    const txt = await page.locator('body').innerText();
    assert.ok(/proud/i.test(txt), 'word kept on write screen: ' + txt.slice(0, 400));
    await ctx.close();
  });
  const rep = (o: object) => ({ id: 'r', answerId: 'a1', stance: 'AGREE', kind: 'TEXT', body: 'x', clip: null, createdAt: new Date().toISOString(), isMine: false, ...o });
  const replies = [
    rep({ id: 'r1', body: 'Named reply with a picture.', author: { id: 'u2', handle: 'kemi.a', displayName: 'Kemi', state: null, avatarUrl: 'https://cdn.fixb.test/k.png', verified: false } }),
    rep({ id: 'r2', body: 'Admin reply here.', author: { id: 'u3', handle: 'boss.admin', displayName: 'Boss', state: null, avatarUrl: null, verified: false, admin: true } }),
    rep({ id: 'r3', body: 'Nameless reply here.', author: null }),
  ];
  const threadExtra: Opts['extra'] = async (p, _m, _b, ok) => {
    if (p === '/answers/a1') { await ok(answer({ id: 'a1', isMine: false })); return true; }
    if (p === '/answers/a1/replies') { await ok({ items: replies, nextCursor: null }); return true; }
    return false;
  };
  await t('thread: named+picture, admin pill, nameless shows no writer', async () => {
    const { page, ctx } = await open({ extra: threadExtra });
    await page.goto(`${ORIGIN}/q/q1/a/a1`);
    await page.getByText('Nameless reply here.').waitFor({ timeout: 15000 });
    const arts = page.locator('article.vx-answer');
    assert.ok(await arts.filter({ hasText: 'Named reply with a picture.' }).locator('img').count() > 0, 'picture');
    assert.ok(/admin/i.test(await arts.filter({ hasText: 'Admin reply here.' }).innerText()), 'admin pill');
    const anon = arts.filter({ hasText: 'Nameless reply here.' });
    const at = await anon.innerText();
    assert.ok(/Anonymous/.test(at) && !/admin|@/i.test(at.replace('Anonymous', '')), 'nameless: ' + at);
    assert.equal(await anon.locator('img').count(), 0);
    await noHScroll(page);
    await shot(page, 'thread-390');
    await ctx.close();
  });
  await t('news post page: tag shown, no writer', async () => {
    const news = { tag: 'UNVERIFIED_NEWS', sourceName: null, sourceUrl: null, chosenBy: null, chosenAt: new Date().toISOString() };
    const { page, ctx } = await open({ extra: async (p, _m, _b, ok) => {
      if (p === '/answers/n1') { await ok(answer({ id: 'n1', author: null, isMine: false, news, body: 'They say the bridge is shut.' })); return true; }
      if (p === '/answers/n1/replies') { await ok({ items: replies.map((r) => ({ ...r, answerId: 'n1' })), nextCursor: null }); return true; }
      return false;
    } });
    await page.goto(`${ORIGIN}/q/q1/a/n1`);
    await page.getByText('They say the bridge is shut.').first().waitFor();
    assert.ok(await page.getByText(/Unverified News/).first().isVisible());
    const txt = await page.locator('main').first().innerText();
    assert.ok(!/me\.handle|Me Person/.test(txt));
    await shot(page, 'news-post-390');
    await ctx.close();
  });
  const item = { answer: answer({ id: 'n1', author: null, news: { tag: 'UNVERIFIED_NEWS', sourceName: null, sourceUrl: null, chosenBy: null, chosenAt: new Date().toISOString() } }), flagCount: 0, flagReasons: [], verifiedRequested: true, sourceName: 'Lagos State Emergency Agency', sourceUrl: 'https://example.com/lasema', evidenceUrl: null, changeLog: [], summary: 'Water is up' };
  await t('admin news queue at 390', async () => {
    const { page, ctx } = await open({ roles: ['EDITOR'], extra: async (p, _m, _b, ok) => {
      if (p === '/admin/today') { await ok(adminToday); return true; }
      if (p === '/admin/news/items') { await ok({ items: [item], nextCursor: null, waiting: 1, counts: { flagged: 0, askingVerified: 1, allChanges: 0 } }); return true; }
      return false;
    } });
    await page.goto(`${ORIGIN}/admin/news`);
    await page.getByText('Posted without a name').first().waitFor();
    await noHScroll(page);
    await shot(page, 'admin-news-390');
    await page.getByRole('listitem').first().click();
    await page.getByRole('button', { name: 'Approve Verified News' }).waitFor();
    await noHScroll(page);
    await ctx.close();
  });
  const DRAFT = { topicId: 't1', source: 'DATA', aiAvailable: false, aiNote: null, draft: { mainView: '', mainViewVoices: 0, opposingView: '', opposingViewVoices: 0, pollLine: 'The poll is still open.', nextStepsLine: 'Most supported so far: Put the salary date in writing.' }, basedOnVoices: 12480, basedOnVotes: 9680, moods: [{ mood: 'ANGRY', count: 412, percent: 44 }], categories: [{ name: 'Money', voices: 7200 }], quotes: [{ answerId: 'a1', kind: 'TEXT', reactions: 214, excerpt: 'Salary is gone in a day.' }] };
  await t('admin summaries (calendar) at 390: fits, no sideways scroll', async () => {
    const { page, ctx } = await open({ w: 390, h: 844, roles: ['EDITOR'], extra: async (p, m, _b, ok) => {
      if (p === '/admin/today') { await ok(adminToday); return true; }
      if (p.startsWith('/admin/topics/t1/summary/draft')) { await ok(DRAFT); return true; }
      if (p.startsWith('/admin/topics/t1/summary') && m === 'GET') { await ok({ aiAvailable: false, summary: null }); return true; }
      if (p.startsWith('/admin/topics/t1')) { await ok({ topic: { id: 't1', weekNumber: 4, title: 'Salary, Bonuses and Year-End Money', blurb: null, countryCode: 'NG', startsOn: '2026-12-07', endsOn: '2026-12-13', status: 'LIVE', sensitive: false, whatNextPrompt: 'What is one practical change that would make pay fairer in your workplace?', questionCount: 7 }, questions: [], spare: [], poll: { id: 'p1', title: 'What should be tackled first?', endsAt: '2026-12-13T22:59:00Z', options: [{ id: 'o1', label: 'Pay salaries on time' }, { id: 'o2', label: 'Publish pay bands' }] } }); return true; }
      if (p.startsWith('/admin/topics')) { await ok({ items: [{ weekNumber: 4, topicId: 't1', title: 'Salary, Bonuses and Year-End Money', startsOn: '2026-12-07', status: 'LIVE' }], nextCursor: null, counts: { live: 1, scheduled: 0, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 7 } }); return true; }
      return false;
    } });
    await page.goto(`${ORIGIN}/admin/calendar`);
    await page.getByText('Salary, Bonuses and Year-End Money').first().waitFor({ timeout: 15000 });
    await noHScroll(page);
    
    await page.getByText('Salary, Bonuses and Year-End Money').first().click();
    await page.getByText('Argument chips and “Based on N voices”').waitFor({ timeout: 15000 });
    await shot(page, 'admin-summary-390');
    await noHScroll(page);
    
    await page.getByRole('button', { name: 'Write the summary' }).click();
    await page.getByLabel('Main view', { exact: true }).waitFor();
    await noHScroll(page);
    
    await ctx.close();
  });
} finally {
  await browser.close();
}
console.log(failed ? `FAILED ${failed}` : 'all passed');
process.exit(failed ? 1 : 0);
