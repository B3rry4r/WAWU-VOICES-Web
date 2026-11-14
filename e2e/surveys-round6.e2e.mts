// V-SURVEYS round 6 proof against the built app (next start), API and sign-in host stubbed in the browser, two tabs in one browser.
//   npx next build && npx next start -p 3996 &   then ORIGIN=http://127.0.0.1:3996 npx tsx e2e/surveys-round6.e2e.mts
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3996';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const jwt = (sub: string, n: string) => 'h.' + Buffer.from(JSON.stringify({ sub, n })).toString('base64url') + '.s';
const A_OLD = jwt('userA', 'old'), A_NEW = jwt('userA', 'new'), B1 = jwt('userB', '1');
const who = (h?: string) => (h ? (() => { const p = JSON.parse(Buffer.from(h.replace('Bearer ', '').split('.')[1], 'base64url').toString()); return `${p.sub}:${p.n}`; })() : 'none');
const opt = (id: string, label: string) => ({ id, label });
const survey = { id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 't', questionCount: 2, note: 'n', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24'],
  questions: [{ id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool?', options: [opt('o1', 'A fan'), opt('o2', 'Cold drinks')] }, { id: 'q2', position: 2, kind: 'VOICE', prompt: 'Tell us more', options: [] }] };
const now = () => new Date().toISOString();
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'How are you today?', hint: null, moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 60, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 60, costs, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };

const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

interface Cfg { rejectOld: string[]; refreshMs: number; refreshRefuse?: boolean; showLog?: boolean }
async function open(cfg: Cfg) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: 390, height: 844 } });
  const log: string[] = [];
  const t0 = Date.now();
  const L = (s: string) => log.push(`+${String(Date.now() - t0).padStart(5)} ${s}`);
  await ctx.route('**/__put', (r) => { L('PUT /__put'); return r.fulfill({ status: 200, body: '' }); });
  await ctx.route('https://id.wawuafrica.com/**', async (r) => {
    const rt = r.request().postDataJSON()?.refreshToken; L(`POST /auth/refresh {${rt}}`);
    await new Promise((x) => setTimeout(x, cfg.refreshMs));
    if (cfg.refreshRefuse) return r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'no' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: A_NEW, refreshToken: 'rA-new' } }) });
  });
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const a = who(req.headers()['authorization']);
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    const dead = a === 'userA:old';
    const key = `${m} ${p.replace(/c\w+(\/complete)?$/, (x) => x)}`;
    if (m !== 'GET' || p.startsWith('/voice-clips')) L(`${a} ${m} ${p}${req.headers()['idempotency-key'] ? ' key=' + req.headers()['idempotency-key'].slice(0, 8) : ''}${body && body.kind ? ' kind=' + body.kind : ''}${body && body.mood ? ' mood=' + body.mood : ''}`);
    if (p === '/voice-clips' && m === 'POST') return cfg.rejectOld.includes('create') && dead ? ok({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) : ok({ clip: { id: 'c1', status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (p === '/voice-clips/c1/complete') return cfg.rejectOld.includes('complete') && dead ? ok({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) : ok({ id: 'c1', status: 'PROCESSING' });
    if (p === '/voice-clips/c1') return ok({ id: 'c1', status: 'READY' });
    if (p === '/surveys/s1') return ok(survey);
    if (p === '/surveys/s1/events') return route.fulfill({ status: 204 });
    if (p === '/surveys/s1/responses') return cfg.rejectOld.includes('responses') && dead ? ok({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) : ok({ ok: true, note: '' });
    if (m === 'POST' && p === '/questions/q1/answers') return cfg.rejectOld.includes('post') && dead ? ok({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) : ok({ answer: { id: 'new1' }, charge: { costMilli: 0, freeLeft: 4, balanceMilli: 0 }, allowances: allowance }, 201);
    if (p === '/questions/q1' || p === '/questions/today') return ok(question);
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance);
    if (p === '/me') return cfg.rejectOld.includes('me') && dead ? ok({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401) : ok({ id: 'u1', handle: 'me', profileComplete: true, roles: [], status: 'ACTIVE', profile: { id: 'u1', handle: 'me', displayName: 'Me Person', countryCode: 'NG', languages: ['en'], joinedAt: '2026-11-02T10:00:00Z' }, allowances: allowance, unreadNotifications: 0, savedCount: 0, replyCount: 0, reactionsReceived: 0, settings: {} });
    if (p === '/home') return ok({ topicOfWeek: null, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Me' });
    return ok({ items: [] });
  });
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); if (!localStorage.getItem(k)) localStorage.setItem(k, v); } }, ['voices-web-session', JSON.stringify({ accessToken: A_OLD, refreshToken: 'rA-old' })]);
  const page = await ctx.newPage();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('voices-web-session') ?? '{}'));
  return { ctx, page, log, stored };
}
async function recordAndStop(page: Page) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: 'Stop recording' }).click();
}
const signInB = (page: Page) => page.evaluate(([k, v]) => localStorage.setItem(k, v), ['voices-web-session', JSON.stringify({ accessToken: B1, refreshToken: 'rB-1' })]);
const STALE = /signed in as someone else in another tab/;
const dump = (n: string, log: string[]) => console.log(`--- log: ${n}\n` + log.join('\n'));

try {
  await t('H1 case 1, survey voice: B signs in during the create-clip 401 wait: nothing as B, B not rotated', async () => {
    const { ctx, page, log, stored } = await open({ rejectOld: ['create'], refreshMs: 1500 });
    await page.goto(`${ORIGIN}/surveys/s1`);
    await page.getByRole('radio', { name: 'Cold drinks' }).click();
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Question 2 of 2').waitFor();
    await recordAndStop(page);
    await page.waitForTimeout(500);
    const tab2 = await ctx.newPage(); await tab2.goto(`${ORIGIN}/about`).catch(() => undefined);
    await signInB(tab2);
    await page.getByText(STALE).first().waitFor({ timeout: 6000 });
    await page.waitForTimeout(800);
    dump('H1 case 1', log);
    assert.deepEqual(log.filter((l) => /userB/.test(l) || (/PUT/.test(l))), []);
    assert.deepEqual((await stored()), { accessToken: B1, refreshToken: 'rB-1' });
    await ctx.close();
  });
  await t('H1 case 2, survey voice: A token runs out at complete, B signs in then: nothing as B', async () => {
    const { ctx, page, log, stored } = await open({ rejectOld: ['complete'], refreshMs: 1500 });
    await page.goto(`${ORIGIN}/surveys/s1`);
    await page.getByRole('radio', { name: 'Cold drinks' }).click();
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Question 2 of 2').waitFor();
    await recordAndStop(page);
    await page.waitForTimeout(900);
    const tab2 = await ctx.newPage(); await tab2.goto(`${ORIGIN}/about`).catch(() => undefined);
    await signInB(tab2);
    await page.getByText(STALE).first().waitFor({ timeout: 6000 });
    await page.waitForTimeout(800);
    dump('H1 case 2', log);
    assert.deepEqual(log.filter((l) => /userB/.test(l)), []);
    assert.deepEqual((await stored()), { accessToken: B1, refreshToken: 'rB-1' });
    await ctx.close();
  });
  await t('H2: a plain GET 401 on the profile, B signs in mid-refresh: B intact, nothing of A written', async () => {
    const { ctx, page, log, stored } = await open({ rejectOld: ['me'], refreshMs: 1500 });
    await page.goto(`${ORIGIN}/profile`);
    await page.waitForTimeout(500);
    const tab2 = await ctx.newPage(); await tab2.goto(`${ORIGIN}/about`).catch(() => undefined);
    await signInB(tab2);
    await page.waitForTimeout(2500);
    dump('H2', log);
    assert.deepEqual((await stored()), { accessToken: B1, refreshToken: 'rB-1' });
    await ctx.close();
  });
  await t('Home record flow, open mood question: one voice answer with the word; a run-out token: one refresh, one post', async () => {
    for (const run of [false, true]) {
      const { ctx, page, log } = await open({ rejectOld: run ? ['post'] : [], refreshMs: 100 });
      await page.goto(`${ORIGIN}/q/q1/speak`);
      await page.getByText('Pick one word').waitFor();
      for (const w of ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL']) await page.getByText(w, { exact: true }).first().waitFor();
      await page.getByText('Say it in 60 seconds').waitFor();
      await page.getByText('Type it instead').waitFor();
      await page.getByText('HOPEFUL', { exact: true }).first().click();
      await page.getByRole('button', { name: 'Say it in 60 seconds' }).click();
      await recordAndStop(page);
      await page.getByRole('button', { name: /^(Send|Share my word)/ }).first().click();
      await page.waitForURL(/posted/, { timeout: 8000 });
      dump('record flow ' + (run ? 'run-out token' : 'plain'), log);
      const posts = log.filter((l) => /POST \/questions\/q1\/answers/.test(l));
      assert.equal(posts.length, run ? 2 : 1);
      assert.equal(log.filter((l) => /auth\/refresh/.test(l)).length, run ? 1 : 0);
      if (run) assert.equal(new Set(posts.map((p) => p.match(/key=(\w+)/)?.[1])).size, 1);
      assert.ok(posts.every((p) => /kind=VOICE mood=HOPEFUL/.test(p)));
      assert.equal(log.filter((l) => /POST \/voice-clips$/.test(l)).length, 1);
      await ctx.close();
    }
  });
  await t('survey with a voice question, one person: ends on Thanks', async () => {
    const { ctx, page, log } = await open({ rejectOld: [], refreshMs: 100 });
    await page.goto(`${ORIGIN}/surveys/s1`);
    await page.getByRole('radio', { name: 'Cold drinks' }).click();
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Question 2 of 2').waitFor();
    await recordAndStop(page);
    await page.getByTestId('voice-ready').waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Thanks. Your answers are in.').waitFor({ timeout: 8000 });
    dump('survey voice', log);
    await ctx.close();
  });
} finally { await browser.close(); }
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
