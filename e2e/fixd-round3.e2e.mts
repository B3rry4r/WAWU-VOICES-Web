// V-FIX-D proof against the built app (next start) with the API stubbed in the browser.
//   npx next build && npx next start -p 3984 &   then ORIGIN=http://127.0.0.1:3984 npx tsx e2e/fixd.e2e.mts
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const TOKEN = 'h.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.s';
const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3993';
const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user-WAWU-VOICES-Web/7896e70d-d506-5588-8329-77f84ee26a17/scratchpad/r3/shot';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const me = { id: 'u1', handle: 'me.handle', displayName: 'Me Person', state: null, avatarUrl: null };
const other = { id: 'u2', handle: 'tunde.a', displayName: 'Tunde A', state: 'Lagos', avatarUrl: null };
const now = () => new Date().toISOString();
const answer = (over: object = {}) => ({ id: 'a1', questionId: 'q1', author: me, kind: 'TEXT', body: 'Salary goes in two hours.', clip: null, createdAt: now(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 1, agreeCount: 1, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null, ...over });
const reply = (over: object = {}) => ({ id: 'r1', answerId: 'a1', author: me, stance: 'AGREE', kind: 'TEXT', body: 'Same for me.', clip: null, createdAt: now(), status: 'PUBLISHED', isMine: true, helpfulCount: 0, ...over });
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'When salary arrives, how long before it is gone?', hint: null, moodOptions: [], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] };
const allowance = (free = 5) => ({ freePostsRemaining: free, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] });
const topic = { questionCount: 5, id: 't1', weekNumber: 1, title: 'Salary and spending', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 10, voicesCount: 10 };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const link = { code: 'abc1234', url: 'https://usevoices.com/s/abc1234', cardStatus: 'READY', imageUrl: '/api/v1/share/abc1234/card', storyImageUrl: '/api/v1/share/abc1234/story', squareImageUrl: '/api/v1/share/abc1234/square', previewText: 'Who is getting rich from this inflation while you count coins?\nAdd your voice: https://usevoices.com/s/abc1234' };

const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const only = process.env.ONLY; const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

type Call = { method: string; path: string; body: Record<string, unknown> | null; headers: Record<string, string> };
interface Opts { free?: number; ctl?: { offline: boolean; failReplies: boolean }; mood?: boolean; replies?: object[]; answerOther?: object }
async function open(w: number, opts: Opts = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: w < 600 ? 844 : 900 }, acceptDownloads: true });
  await ctx.addInitScript((tok) => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: tok, refreshToken: 'r' })), TOKEN);
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (opts.ctl?.offline) return route.abort('internetdisconnected');
    if (opts.ctl?.failReplies && req.method() === 'POST' && /\/replies$/.test(p)) { calls.push({ method: m, path: p, body: req.postData() ? JSON.parse(req.postData()!) : null, headers: req.headers() }); return ok({ error: { code: 'INTERNAL', message: 'no' } }, 500); }
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    if (m !== 'GET') calls.push({ method: m, path: p, body, headers: req.headers() });
    if (/^\/share\/[a-z0-9]+\/(card|story|square)$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (m === 'POST' && p === '/share/links') return ok(link, 201);
    if (p.startsWith('/share/') && p.endsWith('/events')) return route.fulfill({ status: 204 });
    if (m === 'POST' && /^\/answers\/a[12]\/replies$/.test(p)) return ok({ reply: reply({ id: 'rn', author: req.postDataJSON()?.anonymous ? null : me, kind: req.postDataJSON()?.kind }), charge: { costMilli: 0, freeLeft: 4, balanceMilli: 0 }, allowances: allowance() }, 201);
    if (m === 'POST' && p === '/questions/q1/answers') return ok({ answer: answer({ id: 'new1' }), charge: { costMilli: 0, freeLeft: 4, balanceMilli: 0 }, allowances: allowance() }, 201);
    if (p === '/voice-clips' && m === 'POST') return ok({ clip: { id: 'c' + calls.length, status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (/^\/voice-clips\/c\d+\/complete$/.test(p)) return ok({ id: 'c1', status: 'PROCESSING' });
    if (/^\/voice-clips\/c\d+$/.test(p)) return ok({ id: 'c1', status: 'READY' });
    if (p === '/questions/q1') return ok(opts.mood ? { ...question, moodOptions: ['HOPEFUL', 'TIRED'] } : question);
    if (p === '/questions/q1/answers') return ok({ items: [{ type: 'answer', answer: answer() }], nextCursor: null });
    if (p === '/answers/a1') return ok(answer());
    if (p === '/answers/a2') return ok(answer({ id: 'a2', author: other, isMine: false, ...(opts.answerOther ?? {}) }));
    if (p === '/answers/a1/replies') return ok({ items: opts.replies ?? [reply()], nextCursor: null, counts: { agree: 1, disagree: 0, experience: 0 } });
    if (p === '/answers/a2/replies') return ok({ items: opts.replies ?? [], nextCursor: null, counts: { agree: 0, disagree: 0, experience: 0 } });
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance(opts.free));
    if (p === '/me') return ok({ id: 'u1', wawuId: 'w', handle: 'me.handle', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { id: 'u1', handle: 'me.handle', displayName: 'Me Person', bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Enugu', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance(), unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } });
    if (p === '/home') return ok({ topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Me' });
    if (p === '/topics/current') return ok(topic);
    if (p === '/questions/today') return ok(question);
    return ok({ items: [] });
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();
  return { page, calls, ctx };
}
const shot = async (page: Page, name: string) => { await page.waitForTimeout(450); return page.screenshot({ path: `${SHOTS}-${name}.png` }); };
const find = (calls: Call[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);

/** Records about 2 seconds from the fake microphone, then stops. */
async function recordTake(page: Page) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByRole('button', { name: /^Send/ }).waitFor();
}

const draftSeed = async (page: Page) => page.evaluate(async () => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise<void>((res, rej) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ owner: 'u1', questionId: 'q1', blob: new Blob(['abc'], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [], key: 'seed-key', savedAt: Date.now(), queued: true }, 'current'); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
});
const draftRead = async (page: Page) => page.evaluate(async () => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const d = await new Promise<any>((res) => { const rq = db.transaction('drafts').objectStore('drafts').get('current'); rq.onsuccess = () => res(rq.result ?? null); });
  db.close();
  return d ? { key: d.key, queued: d.queued, anonymous: d.anonymous, questionId: d.questionId, reply: d.reply, owner: d.owner } : null;
});

try {
  await t('M1 write screen 390: failed reply, same try again keeps the key, a changed stance sends a new key', async () => {
    const ctl = { offline: false, failReplies: true };
    const { page, calls } = await open(390, { ctl });
    await page.goto(`${ORIGIN}/q/q1/write?reply=a2&stance=AGREE`);
    await page.getByRole('textbox').fill('I see it the same way');
    const post = () => page.getByRole('button', { name: /^(Post|Send|Reply)/ }).first();
    await post().click(); await page.waitForTimeout(500);
    await post().click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'I disagree' }).click();
    await post().click(); await page.waitForTimeout(500);
    const r = find(calls, 'POST', '/answers/a2/replies');
    const keys = r.map((c) => c.headers['idempotency-key']); const st = r.map((c) => (c.body as any).stance);
    console.log('     stances', st.join(','), 'keys equal 1-2:', keys[0] === keys[1], 'differ 1-3:', keys[0] !== keys[2]);
    assert.deepEqual(st, ['AGREE', 'AGREE', 'DISAGREE']); assert.equal(keys[0], keys[1]); assert.notEqual(keys[0], keys[2]);
    await shot(page, 'm1-write-390');
  });

  await t('M2 two tabs, one kept recording, 3 runs: one clip, one answer, one "posted" note in total', async () => {
    for (let run = 1; run <= 3; run++) {
      const { page, calls, ctx } = await open(390);
      await page.goto(`${ORIGIN}/terms`); // any page that does not run the outbox read yet is fine; the outbox runs in the shell
      await draftSeed(page);
      const p2 = await ctx.newPage();
      await Promise.all([page.goto(`${ORIGIN}/`), p2.goto(`${ORIGIN}/`)]);
      await page.waitForTimeout(3500);
      const clips = find(calls, 'POST', '/voice-clips').length; const ans = find(calls, 'POST', '/questions/q1/answers').length;
      const notes = (await page.getByText(/Your saved voice was posted/).count()) + (await p2.getByText(/Your saved voice was posted/).count());
      console.log(`     run ${run}: clips ${clips}, answers ${ans}, "posted" notes ${notes}, kept after: ${JSON.stringify(await draftRead(page))}`);
      assert.equal(clips, 1); assert.equal(ans, 1); assert.equal(notes, 1);
      await ctx.close();
    }
  });

  await t('M3 voice reply 390: offline Send keeps it, close the sheet, reload offline, back online: one reply with parent, stance, name switch', async () => {
    const ctl = { offline: false, failReplies: false };
    const { page, calls, ctx } = await open(390, { ctl });
    await page.goto(`${ORIGIN}/q/q1/a/a2`);
    await page.getByRole('button', { name: 'Reply by voice' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'I disagree' }).click();
    await recordTake(page);
    await page.getByRole('switch', { name: 'Post without my name' }).click({ force: true });
    ctl.offline = true; await ctx.setOffline(true);
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.getByText(/saved on this device/).first().waitFor({ timeout: 5000 });
    await shot(page, 'm3-kept-390');
    const kept = await draftRead(page);
    console.log('     kept:', JSON.stringify(kept));
    assert.equal(kept?.reply?.answerId, 'a2'); assert.equal(kept?.reply?.stance, 'DISAGREE'); assert.equal(kept?.anonymous, true);
    assert.equal(find(calls, 'POST', '/voice-clips').length, 0);
    // "reload": a fresh page in the same browser profile still offline, then back online
    const page2 = await ctx.newPage(); await page.close();
    await page2.goto(`${ORIGIN}/`).catch(() => undefined);
    const keptAfter = await draftRead(page2).catch(() => null);
    console.log('     after reload:', JSON.stringify(keptAfter));
    ctl.offline = false; await ctx.setOffline(false);
    await page2.goto(`${ORIGIN}/`);
    await page2.waitForTimeout(3500);
    const rep = find(calls, 'POST', '/answers/a2/replies');
    console.log('     replies posted:', rep.length, JSON.stringify(rep[0]?.body), 'key', rep[0]?.headers['idempotency-key']);
    assert.equal(rep.length, 1); assert.equal((rep[0].body as any).stance, 'DISAGREE'); assert.equal((rep[0].body as any).anonymous, true); assert.equal((rep[0].body as any).kind, 'VOICE');
    assert.equal(find(calls, 'POST', '/questions/q1/answers').length, 0);
    await shot(page2, 'm3-sent-390');
    assert.equal(await draftRead(page2), null);
  });

  await t('Home record flow at 390 (mood question): Pick one word, Say it in 60 seconds, record, Send posts once; Type it instead is there; no Messages', async () => {
    const { page, calls } = await open(390, { mood: true });
    await page.goto(`${ORIGIN}/q/q1/mood`);
    await page.waitForTimeout(1200);
    const txt = await page.locator('body').innerText();
    for (const w of ['Pick one word', 'Type it instead']) { console.log('     has', JSON.stringify(w), txt.includes(w)); assert.ok(txt.includes(w)); }
    assert.ok(/Say it in \d+ seconds/.test(txt)); assert.ok(!/Messages/.test(txt));
    await shot(page, 'record-pick-390');
    await page.getByRole('button', { name: /^HOPEFUL/ }).click();
    await page.getByRole('button', { name: /^Say it in/ }).click();
    await recordTake(page);
    await shot(page, 'record-take-390');
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.waitForTimeout(2500);
    const a = find(calls, 'POST', '/questions/q1/answers');
    console.log('     answers posted', a.length, JSON.stringify(a[0]?.body));
    assert.equal(a.length, 1);
    const home = await open(390); await home.page.goto(`${ORIGIN}/`); await home.page.waitForTimeout(1200);
    console.log('     Home mentions Messages:', /Messages/.test(await home.page.locator('body').innerText()), '| /dm/ calls:', home.calls.filter((c) => c.path.startsWith('/dm')).length);
    assert.ok(!/Messages/.test(await home.page.locator('body').innerText()));
  });
} finally { await browser.close(); }
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
