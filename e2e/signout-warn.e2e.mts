// V-SIGNOUT-WARN proof against the built app (next start); API and sign-in stubbed in the page, fake microphone.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/signout-warn.e2e.mts
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
async function open(w: number, opts: { free?: number; mood?: boolean } = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (m !== 'GET') calls.push({ method: m, path: p, who: subOfAuth(req.headers()['authorization']) });
    if (p === '/voice-clips' && m === 'POST') return ok({ clip: { id: 'c' + calls.length, status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (/^\/voice-clips\/c\d+\/complete$/.test(p)) return ok({ id: 'c1', status: 'PROCESSING' });
    if (/^\/voice-clips\/c\d+$/.test(p)) return ok({ id: 'c1', status: 'READY' });
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
  const page = await ctx.newPage();
  return { page, calls, ctx };
}
const setPerson = (page: Page, sub: string | null, n = 0) => page.evaluate(([s, n2]) => { if (s) localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: s, refreshToken: 'r' + n2 })); else localStorage.removeItem('voices-web-session'); }, [sub ? tok(sub, n) : null, n] as [string | null, number]);
const idb = <T,>(page: Page, fn: string, arg?: unknown) => page.evaluate(async ([f, a]) => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = await new Promise<any>((res, rej) => {
    if (f === 'seed') { const o = (a as any).owner ?? null; const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ blob: new Blob(['abc'], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [], savedAt: Date.now(), questionId: 'q1', ...(a as object) }, 'rec:' + (o ?? 'guest')); tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error); }
    else { const rq = db.transaction('drafts').objectStore('drafts').getAll(); rq.onsuccess = () => { const r = rq.result.find((x: any) => x && x.blob); res(r ? { key: r.key, owner: r.owner, queued: r.queued } : null); }; }
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
const SENTENCE = 'You have a recording you have not sent. Sign out anyway?';
const SHOTS = process.env.SHOTS ?? 'docs/lead/proof/signout-warn';
const tokenOf = (page: Page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('voices-web-session') ?? '{}').accessToken ?? null; } catch { return null; } });
const signOutBtn = (page: Page) => page.getByRole('button', { name: 'Sign out' }).locator('visible=true').first();
for (const w of [390, 1440]) {
  await t(`so [${w}] record, do not send, Sign out: the sentence; Go back; the recording is there; Send: 1 clip, 1 post; again Sign out anyway: signed out, sign in again: no recording; nothing recorded: Sign out at once`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
    await page.goto(`${ORIGIN}/speak`); await record(page);
    await page.goto(`${ORIGIN}/settings`); await signOutBtn(page).waitFor(); await signOutBtn(page).click();
    const dlg = page.getByRole('dialog'); await dlg.waitFor();
    assert.ok((await dlg.innerText()).includes(SENTENCE), await dlg.innerText());
    assert.equal(await dlg.getByRole('button', { name: 'Sign out anyway' }).count(), 1);
    assert.equal(await dlg.getByRole('button', { name: 'Go back' }).count(), 1);
    console.log(`     dialog text: ${JSON.stringify((await dlg.innerText()).replace(/\n+/g, ' | '))}`);
    const inDialog = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')); assert.ok(inDialog, 'focus is in the dialog');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/dialog-${w}-light.png` });
    await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/dialog-${w}-dark.png` });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    assert.equal(await page.getByRole('dialog').count(), 0); assert.ok(await tokenOf(page)); assert.ok(await read(page));
    await signOutBtn(page).click(); await dlg.waitFor();
    await dlg.getByRole('button', { name: 'Go back' }).click(); await page.waitForTimeout(200);
    assert.equal(await page.getByRole('dialog').count(), 0); assert.ok(await tokenOf(page), 'still signed in'); assert.ok(await read(page), 'recording still there');
    await page.goto(`${ORIGIN}/speak`); await sendBtn(page).waitFor();
    await sendBtn(page).click(); await page.waitForTimeout(1500);
    const clips = n(calls, 'POST', '/voice-clips'), posts = n(calls, 'POST', '/questions/q1/answers');
    console.log(`     after Go back and Send: clips ${clips}, posts ${posts}`); assert.equal(clips, 1); assert.equal(posts, 1);
    await ctx.close();

    const b = await open(w, { mood: false });
    await b.page.goto(`${ORIGIN}/terms`); await setPerson(b.page, 'A');
    await b.page.goto(`${ORIGIN}/speak`); await record(b.page);
    await b.page.goto(`${ORIGIN}/settings`); await signOutBtn(b.page).waitFor(); await signOutBtn(b.page).click();
    await b.page.getByRole('dialog').getByRole('button', { name: 'Sign out anyway' }).click(); await b.page.waitForTimeout(1200);
    console.log(`     after Sign out anyway: token ${await tokenOf(b.page)}, url ${new URL(b.page.url()).pathname}, draft ${JSON.stringify(await read(b.page))}`);
    assert.equal(await tokenOf(b.page), null); assert.equal(await read(b.page), null);
    await setPerson(b.page, 'A'); await b.page.goto(`${ORIGIN}/speak`); await b.page.getByRole('button', { name: 'Start recording' }).waitFor(); await b.page.waitForTimeout(600);
    console.log(`     signed in again: Send buttons ${await sendBtn(b.page).count()}, draft ${JSON.stringify(await read(b.page))}`);
    assert.equal(await sendBtn(b.page).count(), 0); assert.equal(await read(b.page), null);
    await b.ctx.close();

    const c = await open(w, { mood: false });
    await c.page.goto(`${ORIGIN}/terms`); await setPerson(c.page, 'A');
    await c.page.goto(`${ORIGIN}/settings`); await signOutBtn(c.page).waitFor(); await signOutBtn(c.page).click(); await c.page.waitForTimeout(1000);
    assert.equal(await c.page.getByRole('dialog').count(), 0); assert.equal(await tokenOf(c.page), null);
    console.log(`     nothing recorded: signed out at once, no dialog, url ${new URL(c.page.url()).pathname}`);
    await c.ctx.close();
  });
}
await browser.close();
console.log(failed ? `${failed} of ${total} FAILED` : `all ${total} ok`);
process.exit(failed ? 1 : 0);
