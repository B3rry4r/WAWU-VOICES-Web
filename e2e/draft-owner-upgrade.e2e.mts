// V-DRAFT-OWNER round 3 proof against the built app (next start) with the API and sign-in stubbed in the page. Two tabs share ONE browser context.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/draft-owner.e2e.mts
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3977';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const RUNS = 1;
const PROFILE = process.env.PROFILE ?? '/tmp/upg-profile';
const PHASE = process.env.PHASE ?? '1';
const tok = (sub: string, n = 0) => 'h.' + Buffer.from(JSON.stringify({ sub, n })).toString('base64url') + '.s';
const subOfAuth = (h?: string) => { try { return JSON.parse(Buffer.from((h ?? '').replace('Bearer ', '').split('.')[1], 'base64url').toString()).sub as string; } catch { return 'guest'; } };
const LINE = 'You are signed in as someone else in another tab. Nothing was saved. Reload to carry on.';
const now = () => new Date().toISOString();
const mk = (id: string) => ({ id, handle: id + '.h', displayName: id, state: null, avatarUrl: null });
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'How do you feel about Nigeria right now?', hint: null, moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] };
const allowance = (free = 5) => ({ freePostsRemaining: free, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] });
const topic = { questionCount: 5, id: 't1', weekNumber: 1, title: 'Salary', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 10, voicesCount: 10 };

const ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'];
let failed = 0, total = 0;
const only: string | undefined = undefined;
const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; total++; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

type Call = { method: string; path: string; who: string };
async function open(w: number, opts: { free?: number; mood?: boolean; exhaust?: boolean } = {}) {
  const ctx: BrowserContext = await chromium.launchPersistentContext(PROFILE, { executablePath: exe, args: ARGS, permissions: ['microphone'], viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (m !== 'GET') calls.push({ method: m, path: p, who: subOfAuth(req.headers()['authorization']) });
    if (p === '/voice-clips' && m === 'POST') return ok({ clip: { id: 'c' + calls.length, status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (/^\/voice-clips\/c\d+\/complete$/.test(p)) return ok({ id: 'c1', status: 'PROCESSING' });
    if (/^\/voice-clips\/c\d+$/.test(p)) return ok({ id: 'c1', status: 'READY' });
    if (m === 'POST' && p === '/questions/q1/answers' && (opts.exhaust || (opts as any).ctl?.exhaust)) return ok({ error: { code: 'FREE_POSTS_EXHAUSTED', message: 'You have no free posts left.' } }, 402);
    if (m === 'POST' && p === '/questions/q1/answers') return ok({ answer: { id: 'new1', questionId: 'q1', author: mk('x'), kind: 'VOICE', body: null, clip: null, createdAt: now(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null }, charge: { costMilli: 0, freeLeft: 4, balanceMilli: 0 }, allowances: allowance() }, 201);
    if (p === '/questions/q1' || p === '/questions/today') return ok(opts.mood === false ? { ...question, moodOptions: [] } : question);
    if (p === '/questions/q1/answers') return ok({ items: [], nextCursor: null });
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance(opts.free));
    if (p === '/me') return ok({ id: 'u1', wawuId: 'w', handle: 'me.handle', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { id: 'u1', handle: 'me.handle', displayName: 'Me Person', bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Enugu', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance(), unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } });
    if (p === '/home') return ok({ topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Me' });
    if (p === '/topics/current') return ok(topic);
    return ok({ items: [] });
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route('https://id.wawuafrica.com/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname;
    const body = req.postDataJSON?.() ?? {};
    if (p === '/auth/login') { const sub = String(body.identifier ?? '').split('@')[0].toUpperCase(); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ accessToken: tok(sub), refreshToken: 'r-' + sub, user: { id: sub, email: String(body.identifier), emailVerified: true } }) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return { page, calls, ctx };
}
const setPerson = (page: Page, sub: string | null, n = 0) => page.evaluate(([s, n2]) => { if (s) localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: s, refreshToken: 'r' + n2 })); else localStorage.removeItem('voices-web-session'); }, [sub ? tok(sub, n) : null, n] as [string | null, number]);
const idb = <T,>(page: Page, fn: string, arg?: unknown) => page.evaluate(async ([f, a]) => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = await new Promise<any>((res, rej) => {
    if (f === 'seed') { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ blob: new Blob(['abc'], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [], savedAt: Date.now(), questionId: 'q1', ...(a as object) }, 'current'); tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error); }
    else { const rq = db.transaction('drafts').objectStore('drafts').get('current'); rq.onsuccess = () => res(rq.result ? { key: rq.result.key, owner: rq.result.owner, queued: rq.result.queued } : null); }
  });
  db.close(); return out;
}, [fn, arg] as [string, unknown]) as Promise<T>;
const seed = (page: Page, o: object) => idb(page, 'seed', o);
const read = (page: Page) => idb<{ key: string; owner: string | null; queued?: boolean } | null>(page, 'read');
const line = (page: Page) => page.getByText(LINE).count();
const sendBtn = (page: Page) => page.getByRole('button', { name: /^Send/ });
async function record(page: Page, ms = 1300) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(ms);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await sendBtn(page).waitFor();
}
const n = (calls: Call[], method: string, path: string, who?: string) => calls.filter((c) => c.method === method && c.path === path && (!who || c.who === who)).length;


const recKeysAll = (page: Page) => page.evaluate(async () => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const k = await new Promise<string[]>((res) => { const q = db.transaction('drafts').objectStore('drafts').getAllKeys(); q.onsuccess = () => res(q.result.map(String)); });
  db.close(); return k;
});

const w = 390;
const go = async (page: Page, url: string) => { await page.goto(url); await page.waitForTimeout(700); const c = page.getByRole('button', { name: 'Continue in the browser' }); if (await c.count()) await c.click(); };
if (PHASE === '1') {
  await t('upgrade 1: on main, A keeps a recording (not sent), typed words, and a held post', async () => {
    const { page, ctx } = await open(w, { mood: false, exhaust: true });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
    await page.goto(`${ORIGIN}/speak`); await page.waitForTimeout(2500); { const c = page.getByRole('button', { name: 'Continue in the browser' }); if (await c.count()) await c.click(); } await record(page);
    console.log(`     kept recording on main: ${JSON.stringify(await read(page))}`);
    await page.goto(`${ORIGIN}/q/q1/write`); await page.getByRole('textbox').fill('old typed words'); await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^(Post|Send)/ }).first().click(); await page.waitForTimeout(1800); // 402: held post
    console.log(`     main storage: ${JSON.stringify(await page.evaluate(() => ({ typed: localStorage.getItem('voices-typing-drafts'), held: localStorage.getItem('voices-held-drafts') })))}`);
    await ctx.close();
  });
} else {
  await t('upgrade 2: this branch on the same storage: A alone loses nothing', async () => {
    const ctl = { exhaust: false }; const { page, calls, ctx } = await open(w, { mood: false, ctl } as any);
    await go(page, `${ORIGIN}/terms`); { const c = page.getByRole('button', { name: 'Continue in the browser' }); if (await c.count()) await c.click(); }
    console.log(`     before: recording keys ${JSON.stringify(await recKeysAll(page))}, session ${await page.evaluate(() => !!localStorage.getItem('voices-web-session'))}`);
    page.on('pageerror', (e) => console.log('     pageerror', e.message.slice(0, 200))); await go(page, `${ORIGIN}/q/q1/write`); await page.waitForTimeout(2500); console.log('     write page:', JSON.stringify((await page.locator('body').innerText()).slice(0, 200)));
    const typed = await page.getByRole('textbox').inputValue();
    const st = await page.evaluate(() => ({ typed: localStorage.getItem('voices-typing-drafts'), typedV2: localStorage.getItem('voices-typing-v2'), held: localStorage.getItem('voices-held-drafts'), heldV2: localStorage.getItem('voices-held-v2') }));
    console.log(`     typed words come back: "${typed}"; storage ${JSON.stringify(st)}`);
    assert.equal(typed, 'old typed words');
    // out of posts again with the same words: the held post that was on the device is taken by A (same key), not made anew
    ctl.exhaust = true; await page.getByRole('button', { name: /^(Post|Send)/ }).first().click(); await page.waitForTimeout(2000); ctl.exhaust = false;
    const st2 = await page.evaluate(() => ({ held: localStorage.getItem('voices-held-drafts'), heldV2: localStorage.getItem('voices-held-v2') }));
    console.log(`     held post after the update: ${JSON.stringify(st2)}`);
    assert.equal(st2.held, '{}'); assert.equal(JSON.parse(st2.heldV2 ?? '{}').A?.q1?.key, JSON.parse(st.held).q1.key);
    await go(page, `${ORIGIN}/speak`); await sendBtn(page).waitFor({ timeout: 8000 });
    console.log(`     record screen after the update: Send ${await sendBtn(page).count()}; recording keys ${JSON.stringify(await recKeysAll(page))}; line ${await line(page)}`);
    await sendBtn(page).click(); await page.waitForTimeout(2500);
    console.log(`     Send: clips ${n(calls, 'POST', '/voice-clips', 'A')}, posts ${n(calls, 'POST', '/questions/q1/answers', 'A')}, keys left ${JSON.stringify(await recKeysAll(page))}`);
    assert.equal(n(calls, 'POST', '/voice-clips', 'A'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers', 'A'), 2); // the text post the stub refused (402) and the one voice post
    await ctx.close();
  });
}
console.log(failed ? `${failed} of ${total} FAILED` : `all ${total} ok`);
process.exit(failed ? 1 : 0);
