// V-DRAFT-OWNER round 3 proof against the built app (next start) with the API and sign-in stubbed in the page. Two tabs share ONE browser context.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/draft-owner.e2e.mts
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3977';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const RUNS = Number(process.env.RUNS ?? 10);
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

const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0, total = 0;
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; total++; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

type Call = { method: string; path: string; who: string };
async function open(w: number, opts: { free?: number; mood?: boolean; exhaust?: boolean } = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (m !== 'GET') calls.push({ method: m, path: p, who: subOfAuth(req.headers()['authorization']) });
    if (p === '/voice-clips' && m === 'POST') return ok({ clip: { id: 'c' + calls.length, status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (/^\/voice-clips\/c\d+\/complete$/.test(p)) return ok({ id: 'c1', status: 'PROCESSING' });
    if (/^\/voice-clips\/c\d+$/.test(p)) return ok({ id: 'c1', status: 'READY' });
    if (m === 'POST' && p === '/questions/q1/answers' && opts.exhaust) return ok({ error: { code: 'FREE_POSTS_EXHAUSTED', message: 'You have no free posts left.' } }, 402);
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
  const page = await ctx.newPage();
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


const NS = process.env.ONLY_NS;
/** The real sign-in screen, against the stub, in this page. */
async function signInVia(page: Page, sub: string) {
  await page.goto(`${ORIGIN}/sign-in`);
  await page.getByLabel('Email or phone number').fill(`${sub}@x.co`);
  await page.getByLabel('Password').fill('longenough1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForFunction((s) => !!localStorage.getItem('voices-web-session'), null, { timeout: 8000 });
  await page.waitForTimeout(800);
}
async function signOutVia(page: Page) {
  await page.goto(`${ORIGIN}/settings`); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Sign out' }).locator('visible=true').first().click(); await page.waitForTimeout(1000);
}
const store = (page: Page) => page.evaluate(() => ({ typed: localStorage.getItem('voices-typing-drafts'), typedV2: localStorage.getItem('voices-typing-v2'), held: localStorage.getItem('voices-held-drafts'), heldV2: localStorage.getItem('voices-held-v2') }));
const recKeys = (page: Page) => page.evaluate(async () => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const k = await new Promise<string[]>((res) => { const q = db.transaction('drafts').objectStore('drafts').getAllKeys(); q.onsuccess = () => res(q.result.map(String)); });
  db.close(); return k;
});
let lineTotal = 0, sendTotal = 0;
const countLine = async (...pages: Page[]) => { let c = 0; for (const p of pages) c += await line(p); lineTotal += c; return c; };

for (const w of [390, 1440]) {
  await t(`F1 voice [${w}] guest tab, the same person signs in in tab 2, tab 1 records and Sends: no line, 1 clip, 1 post as that person (5 runs)`, async () => {
    const log: string[] = [];
    for (let r = 1; r <= 5; r++) {
      const { page, calls, ctx } = await open(w, { mood: false });
      await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor();
      const t2 = await ctx.newPage(); await signInVia(t2, 'A');
      await record(page); await sendBtn(page).click(); await page.waitForTimeout(2300); sendTotal++;
      const l = await countLine(page, t2);
      log.push(`run ${r}: clips ${n(calls, 'POST', '/voice-clips', 'A')}, posts ${n(calls, 'POST', '/questions/q1/answers', 'A')} (all ${n(calls, 'POST', '/questions/q1/answers')}), line ${l}`);
      assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers', 'A'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(l, 0);
      await ctx.close();
    }
    console.log('     ' + log.join(' | '));
  });
  await t(`F1b [${w}] the guest already HAS a take when the sign-in happens elsewhere: it is that person's, sends once, nothing left`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/speak`); await record(page);
    console.log(`     guest take kept: ${JSON.stringify(await recKeys(page))}`);
    const t2 = await ctx.newPage(); await signInVia(t2, 'A');
    await sendBtn(page).click(); await page.waitForTimeout(2500); sendTotal++;
    const keys = await recKeys(page); const l = await countLine(page, t2);
    console.log(`     clips ${n(calls, 'POST', '/voice-clips', 'A')}, posts ${n(calls, 'POST', '/questions/q1/answers', 'A')}, recording keys left ${JSON.stringify(keys)}, line ${l}`);
    assert.equal(n(calls, 'POST', '/voice-clips', 'A'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers', 'A'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.deepEqual(keys, []); assert.equal(l, 0);
    await ctx.close();
  });
  await t(`F1 typed [${w}] guest tab on the write screen, the same person signs in in tab 2, tab 1 types and Posts: no line, 1 post as that person (5 runs)`, async () => {
    const log: string[] = [];
    for (let r = 1; r <= 5; r++) {
      const { page, calls, ctx } = await open(w, { mood: false });
      await page.goto(`${ORIGIN}/q/q1/write`); await page.waitForTimeout(1200);
      const t2 = await ctx.newPage(); await signInVia(t2, 'A');
      await page.getByRole('textbox').waitFor({ timeout: 8000 }); await page.getByRole('textbox').fill('We go again, small small.'); await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^(Post|Send)/ }).first().click(); await page.waitForTimeout(2300); sendTotal++;
      const l = await countLine(page, t2);
      log.push(`run ${r}: posts ${n(calls, 'POST', '/questions/q1/answers', 'A')} (all ${n(calls, 'POST', '/questions/q1/answers')}), line ${l}`);
      assert.equal(n(calls, 'POST', '/questions/q1/answers', 'A'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(l, 0);
      await ctx.close();
    }
    console.log('     ' + log.join(' | '));
  });
  await t(`F2-S1 [${w}] shared phone, one tab: A's words stay A's, B gets B's own (leave and come back), A signs in later and has A's`, async () => {
    const { page, ctx } = await open(w, { mood: false });
    await signInVia(page, 'A'); await page.goto(`${ORIGIN}/q/q1/write`); await page.getByRole('textbox').fill('A words here'); await page.waitForTimeout(400);
    await signOutVia(page); await signInVia(page, 'B');
    await page.goto(`${ORIGIN}/q/q1/write`); await page.waitForTimeout(1200);
    const bStart = await page.getByRole('textbox').inputValue();
    await page.getByRole('textbox').fill('B words here'); await page.waitForTimeout(400);
    await page.goto(`${ORIGIN}/terms`); await page.goto(`${ORIGIN}/q/q1/write`); await page.waitForTimeout(1200);
    const bBack = await page.getByRole('textbox').inputValue();
    await signOutVia(page); await signInVia(page, 'A'); await page.goto(`${ORIGIN}/q/q1/write`); await page.waitForTimeout(1200);
    const aBack = await page.getByRole('textbox').inputValue();
    console.log(`     B opens: "${bStart}"; B leaves and comes back: "${bBack}"; A later: "${aBack}"; stored ${JSON.stringify((await store(page)).typedV2)}`);
    assert.equal(bStart, ''); assert.equal(bBack, 'B words here'); assert.equal(aBack, 'A words here'); assert.equal(await countLine(page), 0);
    await ctx.close();
  });
  await t(`F2-S2 [${w}] out of posts: A's held post stays A's, B's is B's own and is there when B comes back`, async () => {
    const { page, ctx } = await open(w, { mood: false, exhaust: true });
    for (const who of ['A', 'B']) {
      await signInVia(page, who); await page.goto(`${ORIGIN}/q/q1/write`); await page.getByRole('textbox').fill(`${who} held words`); await page.waitForTimeout(300);
      await page.getByRole('button', { name: /^(Post|Send)/ }).first().click(); await page.waitForTimeout(1800);
      await signOutVia(page);
    }
    const st = await store(page); console.log(`     held v2 after A then B: ${st.heldV2}`);
    const h = JSON.parse(st.heldV2 ?? '{}'); assert.equal(h.A?.q1?.body, 'A held words'); assert.equal(h.B?.q1?.body, 'B held words');
    await signInVia(page, 'B'); await page.goto(`${ORIGIN}/q/q1/write`); await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('textbox').inputValue(), 'B held words'); assert.equal(await countLine(page), 0);
    await ctx.close();
  });
}

for (const w of [390, 1440]) {
  await t(`H1 [${w}] sign out and in again in the same tab: the take is removed at sign-out, a new one sends once, line never`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await signInVia(page, 'A'); await page.goto(`${ORIGIN}/speak`); await record(page);
    const kept = await recKeys(page); await signOutVia(page); const after = await recKeys(page);
    await signInVia(page, 'A'); await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor(); await record(page);
    await sendBtn(page).click(); await page.waitForTimeout(2300); sendTotal++;
    const l = await countLine(page);
    console.log(`     keys before sign-out ${JSON.stringify(kept)}, after ${JSON.stringify(after)}; clips ${n(calls, 'POST', '/voice-clips')}, posts ${n(calls, 'POST', '/questions/q1/answers')}, line ${l}`);
    assert.deepEqual(after, []); assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(l, 0);
    await ctx.close();
  });
  await t(`H2 [${w}] three tabs of the same person, one kept recording: 1 clip, 1 post, line never`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await seed(page, { owner: 'A', key: 'a-key', queued: true, mood: 'HOPEFUL' });
    const t2 = await ctx.newPage(), t3 = await ctx.newPage();
    await Promise.all([page.goto(`${ORIGIN}/`), t2.goto(`${ORIGIN}/`), t3.goto(`${ORIGIN}/`)]); await page.waitForTimeout(4500); sendTotal++;
    const l = await countLine(page, t2, t3);
    console.log(`     clips ${n(calls, 'POST', '/voice-clips')}, posts ${n(calls, 'POST', '/questions/q1/answers')}, line ${l}`);
    assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(l, 0);
    await ctx.close();
  });
  for (const [name, init] of [
    ['IndexedDB missing', "Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });"],
    ['IndexedDB full (quota)', "IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); };"],
  ] as const) {
    await t(`H3 [${w}] ${name}: recording still works online, sends once, and the screen says it could not keep it`, async () => {
      const { page, calls, ctx } = await open(w, { mood: false });
      await page.addInitScript(init);
      await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/speak`); await record(page);
      const said = await page.getByText(/could not keep your recording/).count();
      await sendBtn(page).click(); await page.waitForTimeout(2300); sendTotal++;
      const l = await countLine(page);
      console.log(`     says so: ${said}; clips ${n(calls, 'POST', '/voice-clips')}, posts ${n(calls, 'POST', '/questions/q1/answers')}, line ${l}`);
      assert.ok(said >= 1); assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(l, 0);
      await ctx.close();
    });
  }
  await t(`H3 [${w}] localStorage throwing for typed words: typing still works, posts once, the screen says it could not keep them`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
    await page.addInitScript("const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('voices-typing')) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); };");
    await page.goto(`${ORIGIN}/q/q1/write`); await page.getByRole('textbox').fill('typed with no storage'); await page.waitForTimeout(500);
    const said = await page.getByText(/could not keep what you typed/).count();
    await page.getByRole('button', { name: /^(Post|Send)/ }).first().click(); await page.waitForTimeout(2300); sendTotal++;
    const l = await countLine(page);
    console.log(`     says so: ${said}; posts ${n(calls, 'POST', '/questions/q1/answers')}, line ${l}`);
    assert.ok(said >= 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(l, 0);
    await ctx.close();
  });
}
console.log(`LINE TOTAL over ${sendTotal} sends: ${lineTotal}`);
await browser.close();
console.log(failed ? `${failed} of ${total} FAILED` : `all ${total} ok`);
process.exit(failed ? 1 : 0);
