// V-DRAFT-OWNER proof against the built app (next start) with the API and sign-in stubbed in the page. Two tabs share ONE browser context.
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

for (const w of [390, 1440]) {
  await t(`1 [${w}] A records after B signed in elsewhere: nothing written, line shown, B gets no take and no Send`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
    await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor();
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B');
    await record(page);
    const d = await read(page); const l = await line(page);
    console.log(`     draft after A's 1.3 s take: ${JSON.stringify(d)}, line shown: ${l}`);
    assert.equal(d, null); assert.equal(l, 1);
    await sendBtn(page).click(); await page.waitForTimeout(800);
    console.log(`     Send on the stale screen: clips ${n(calls, 'POST', '/voice-clips')}, answers ${n(calls, 'POST', '/questions/q1/answers')}`);
    assert.equal(n(calls, 'POST', '/voice-clips'), 0); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 0);
    await t2.goto(`${ORIGIN}/speak`); await t2.getByRole('button', { name: 'Start recording' }).waitFor(); await t2.waitForTimeout(600);
    console.log(`     B's record screen: Send buttons ${await sendBtn(t2).count()}, line ${await line(t2)}, draft ${JSON.stringify(await read(t2))}`);
    assert.equal(await sendBtn(t2).count(), 0); assert.equal(await line(t2), 0); assert.equal(await read(t2), null);
    await ctx.close();
  });

  await t(`2 [${w}] A records, B signs in, A offline Send, network back, B opens Home: nothing sent or kept as B`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
    await page.goto(`${ORIGIN}/speak`); await record(page);
    console.log(`     A's kept take: ${JSON.stringify(await read(page))}`);
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B');
    await ctx.setOffline(true); await sendBtn(page).click(); await page.waitForTimeout(900);
    assert.equal(await line(page), 1);
    await ctx.setOffline(false); await page.waitForTimeout(600);
    await t2.goto(`${ORIGIN}/`); await t2.waitForTimeout(3500);
    const d = await read(t2);
    console.log(`     as B: clips ${n(calls, 'POST', '/voice-clips', 'B')}, answers ${n(calls, 'POST', '/questions/q1/answers', 'B')}; all clips ${n(calls, 'POST', '/voice-clips')}, all answers ${n(calls, 'POST', '/questions/q1/answers')}; kept now ${JSON.stringify(d)}`);
    assert.equal(n(calls, 'POST', '/voice-clips'), 0); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 0);
    assert.ok(!d || d.owner !== 'B'); assert.equal(await t2.getByText(/saved voice was posted/).count(), 0);
    await ctx.close();
  });

  await t(`3 [${w}] B has a kept recording; A's open tab taps "Say it in": no B take in A's tab, still there for B`, async () => {
    const { page, ctx } = await open(w);
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
    await page.goto(`${ORIGIN}/q/q1/mood`); await page.getByRole('button', { name: /^HOPEFUL/ }).click();
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B'); await seed(t2, { owner: 'B', key: 'b-key', queued: false });
    await page.getByRole('button', { name: /^Say it in/ }).click(); await page.waitForTimeout(1500);
    console.log(`     A's tab: Send buttons ${await sendBtn(page).count()}, line ${await line(page)}; draft ${JSON.stringify(await read(page))}`);
    assert.equal(await sendBtn(page).count(), 0); assert.equal(await line(page), 1);
    assert.deepEqual(await read(page), { key: 'b-key', owner: 'B', queued: false });
    await t2.goto(`${ORIGIN}/q/q1/speak?mood=HOPEFUL`); await sendBtn(t2).waitFor({ timeout: 8000 });
    console.log(`     B's tab: Send buttons ${await sendBtn(t2).count()}`);
    await ctx.close();
  });

  await t(`4 [${w}] A's banner is open; B keeps a recording; A taps X: B's is still there`, async () => {
    const { page, ctx } = await open(w, { free: 0 });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await seed(page, { owner: 'A', key: 'a-key', queued: true, mood: 'HOPEFUL' });
    await page.goto(`${ORIGIN}/`); await page.getByText('A recording is waiting').waitFor(); console.log('     banner up:', await page.getByTestId('outbox').count(), JSON.stringify((await page.locator('body').innerText()).slice(0, 300)));
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B'); console.log('     after B signs in, banner:', await page.getByTestId('outbox').count()); await seed(t2, { owner: 'B', key: 'b-key', queued: false });
    console.log('     before X, draft:', JSON.stringify(await read(page)));
    console.log('     banner text:', JSON.stringify((await page.getByTestId('outbox').innerText()).slice(0, 200)), 'buttons:', await page.getByTestId('outbox').getByRole('button').allInnerTexts(), await page.getByTestId('outbox').locator('button').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label'))));
    await page.getByTestId('outbox').getByRole('button', { name: 'Dismiss' }).click({ timeout: 4000 }); await page.waitForTimeout(700);
    console.log(`     after A taps X: draft ${JSON.stringify(await read(page))}, line ${await line(page)}`);
    assert.deepEqual(await read(page), { key: 'b-key', owner: 'B', queued: false }); assert.equal(await line(page), 1);
    await ctx.close();
  });
}

// ---- 5. the hard rule: one person, one tab
async function pickAndRecord(page: Page, mode: 'voice' | 'typed') {
  await page.goto(`${ORIGIN}/q/q1/mood`);
  await page.getByRole('group', { name: 'Pick one word' }).waitFor();
  await page.getByRole('button', { name: /^HOPEFUL/ }).click();
  if (mode === 'voice') { await page.getByRole('button', { name: /^Say it in/ }).click(); await record(page); }
  else { await page.getByRole('button', { name: 'Type it instead' }).click(); await page.getByRole('textbox').fill('We go again, small small.'); }
}
for (const w of [390, 1440]) {
  await t(`5a [${w}] the screen: question, Pick one word, ANGRY TIRED PROUD HOPEFUL, Say it in, Type it instead, Share my word`, async () => {
    const { page, ctx } = await open(w);
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/q/q1/mood`); await page.waitForTimeout(1500);
    const txt = await page.locator('body').innerText();
    for (const s of [question.text, 'Pick one word', 'ANGRY', 'TIRED', 'PROUD', 'HOPEFUL', 'Type it instead', 'Share my word']) assert.ok(txt.includes(s), 'missing ' + s);
    assert.ok(/Say it in \d+ seconds/.test(txt)); await ctx.close();
  });
  for (const mode of ['voice', 'typed'] as const) {
    await t(`5b [${w}] ${mode} ${RUNS} runs: exactly 1 clip (voice only) and 1 post per Send, never the line`, async () => {
      const log: string[] = [];
      for (let r = 1; r <= RUNS; r++) {
        const { page, calls, ctx } = await open(w);
        await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
        await pickAndRecord(page, mode);
        await page.getByRole('button', { name: mode === 'voice' ? /^Send/ : /^(Post|Send)/ }).first().click();
        await page.waitForTimeout(2300);
        const clips = n(calls, 'POST', '/voice-clips'), posts = n(calls, 'POST', '/questions/q1/answers'), l = await line(page);
        log.push(`run ${r}: clips ${clips}, posts ${posts}, line ${l}`);
        assert.equal(clips, mode === 'voice' ? 1 : 0); assert.equal(posts, 1); assert.equal(l, 0);
        await ctx.close();
      }
      console.log('     ' + log.join(' | '));
    });
  }
  await t(`5c [${w}] token refresh in the middle, ${RUNS} runs (own tab and another tab of the same person): 1 clip, 1 post, never the line`, async () => {
    const log: string[] = [];
    for (let r = 1; r <= RUNS; r++) {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A');
      await pickAndRecord(page, 'voice');
      if (r % 2) await setPerson(page, 'A', r); else { const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'A', r); await page.waitForTimeout(200); }
      await sendBtn(page).click(); await page.waitForTimeout(2300);
      const clips = n(calls, 'POST', '/voice-clips'), posts = n(calls, 'POST', '/questions/q1/answers'), l = await line(page);
      log.push(`run ${r} (${r % 2 ? 'own tab' : 'other tab'}): clips ${clips}, posts ${posts}, line ${l}`);
      assert.equal(clips, 1); assert.equal(posts, 1); assert.equal(l, 0);
      await ctx.close();
    }
    console.log('     ' + log.join(' | '));
  });
  await t(`5d [${w}] kept offline, survives a reload, sent once when the network is back`, async () => {
    const { page, calls, ctx } = await open(w);
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await pickAndRecord(page, 'voice');
    await ctx.setOffline(true); await sendBtn(page).click(); await page.getByText(/You are offline\. Your recording is saved/).waitFor();
    const kept = await read(page); assert.equal(kept?.queued, true); assert.equal(kept?.owner, 'A');
    await ctx.setOffline(false); await page.reload(); await sendBtn(page).waitFor({ timeout: 8000 });
    await page.goto(`${ORIGIN}/`); await page.waitForTimeout(4000);
    console.log(`     kept ${JSON.stringify(kept)}; after: clips ${n(calls, 'POST', '/voice-clips')}, posts ${n(calls, 'POST', '/questions/q1/answers')}, left ${JSON.stringify(await read(page))}, line ${await line(page)}`);
    assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(await read(page), null); assert.equal(await line(page), 0);
    await ctx.close();
  });
  await t(`5e [${w}] two tabs of the SAME person with one kept recording: 1 clip, 1 post, never the line`, async () => {
    const { page, calls, ctx } = await open(w);
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await seed(page, { owner: 'A', key: 'a-key', queued: true, mood: 'HOPEFUL' });
    const t2 = await ctx.newPage(); await Promise.all([page.goto(`${ORIGIN}/`), t2.goto(`${ORIGIN}/`)]); await page.waitForTimeout(4000);
    console.log(`     clips ${n(calls, 'POST', '/voice-clips')}, posts ${n(calls, 'POST', '/questions/q1/answers')}, line ${(await line(page)) + (await line(t2))}`);
    assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal((await line(page)) + (await line(t2)), 0);
    await ctx.close();
  });
  await t(`5f [${w}] a guest records, is asked to sign in, signs in, comes back: still has it, sends once`, async () => {
    const { page, calls, ctx } = await open(w);
    await pickAndRecord(page, 'voice');
    await sendBtn(page).click(); await page.waitForURL(/\/join/);
    const back = new URL(page.url()).searchParams.get('next')!;
    const kept = await read(page);
    await setPerson(page, 'A'); await page.goto(ORIGIN + back); await sendBtn(page).waitFor({ timeout: 8000 });
    const claimed = await read(page);
    await sendBtn(page).click(); await page.waitForTimeout(2500);
    console.log(`     kept as guest ${JSON.stringify(kept)}; back as A ${JSON.stringify(claimed)}; clips ${n(calls, 'POST', '/voice-clips')}, posts ${n(calls, 'POST', '/questions/q1/answers')}, line ${await line(page)}`);
    assert.equal(kept?.owner ?? null, null); assert.equal(claimed?.owner, 'A');
    assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); assert.equal(await line(page), 0);
    await ctx.close();
  });
}

// ---- Round 2
const hashOf = (page: Page) => page.evaluate(async () => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const d = await new Promise<any>((res) => { const rq = db.transaction('drafts').objectStore('drafts').get('current'); rq.onsuccess = () => res(rq.result ?? null); });
  db.close(); if (!d) return null;
  const h = await crypto.subtle.digest('SHA-256', await d.blob.arrayBuffer()); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('') + ':' + JSON.stringify({ k: d.key, o: d.owner, q: d.queued });
});
const own = (page: Page, sub: string | null) => page.evaluate((s) => { if (s) localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: s, refreshToken: 'r' })); else localStorage.removeItem('voices-web-session'); }, sub ? tok(sub) : null);

for (const w of [390, 1440]) {
  await t(`R1a [${w}] A signs out in ANOTHER tab, tab 1 records: kept under A (not a guest); B signs in and gets nothing`, async () => {
    const { page, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor();
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, null);
    await record(page);
    const d = await read(page); console.log(`     kept while nobody is signed in: ${JSON.stringify(d)}, line ${await line(page)}`);
    assert.equal(d?.owner, 'A'); assert.equal(await line(page), 0);
    await setPerson(t2, 'B'); await t2.goto(`${ORIGIN}/speak`); await t2.getByRole('button', { name: 'Start recording' }).waitFor(); await t2.waitForTimeout(700);
    console.log(`     B's record screen: Send ${await sendBtn(t2).count()}, Play ${await t2.getByRole('button', { name: /^Play/ }).filter({ hasNotText: /song/i }).count()}, draft ${JSON.stringify(await read(t2))}`);
    assert.equal(await sendBtn(t2).count(), 0); assert.ok(!(await read(t2)) || (await read(t2))!.owner !== 'B');
    await ctx.close();
  });
  await t(`R1b [${w}] ... and when A signs in again, A gets the take back`, async () => {
    const { page, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor();
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, null);
    await record(page); await setPerson(t2, 'A'); await t2.goto(`${ORIGIN}/speak`); await sendBtn(t2).waitFor({ timeout: 8000 });
    console.log(`     A's new tab: Send ${await sendBtn(t2).count()}, draft ${JSON.stringify(await read(t2))}`);
    assert.equal((await read(t2))?.owner, 'A'); await ctx.close();
  });
  await t(`R1c [${w}] a lone person's session runs out in the one tab: kept for A, A signs in again and has it`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor();
    await own(page, null); // this tab's own session ends: no event
    await record(page);
    const d = await read(page); console.log(`     kept after the session ran out: ${JSON.stringify(d)}, line ${await line(page)}`);
    assert.equal(d?.owner, 'A'); assert.equal(await line(page), 0);
    await own(page, 'A'); await page.reload(); await page.waitForTimeout(1500);
    await sendBtn(page).click(); await page.waitForTimeout(2500);
    console.log(`     after signing in again: clips ${n(calls, 'POST', '/voice-clips', 'A')}, posts ${n(calls, 'POST', '/questions/q1/answers', 'A')}`);
    assert.equal(n(calls, 'POST', '/voice-clips'), 1); assert.equal(n(calls, 'POST', '/questions/q1/answers'), 1); await ctx.close();
  });
  await t(`R2a [${w}] pick screen for 3 s as A, B signs in, A taps "Say it in" and records: nothing under B, line shown`, async () => {
    const { page, calls, ctx } = await open(w);
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/q/q1/mood`); await page.getByRole('button', { name: /^HOPEFUL/ }).click(); await page.waitForTimeout(3000);
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B');
    await page.getByRole('button', { name: /^Say it in/ }).click(); await record(page);
    const d = await read(page); console.log(`     draft ${JSON.stringify(d)}, line ${await line(page)}`);
    assert.equal(d, null); assert.equal(await line(page), 1);
    await sendBtn(page).click(); await page.waitForTimeout(800); assert.equal(n(calls, 'POST', '/voice-clips'), 0); await ctx.close();
  });
  await t(`R2b [${w}] B has a kept recording: A's tab shows no take, no Send, no Play, no Delete; B's recording is byte for byte the same`, async () => {
    const { page, ctx } = await open(w);
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/q/q1/mood`); await page.getByRole('button', { name: /^HOPEFUL/ }).click(); await page.waitForTimeout(3000);
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B'); await seed(t2, { owner: 'B', key: 'b-key', queued: false });
    const before = await hashOf(t2);
    await page.getByRole('button', { name: /^Say it in/ }).click(); await page.waitForTimeout(1800);
    const names = await page.getByRole('button').allInnerTexts(); const labels = await page.locator('button').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label') ?? ''));
    const bad = [...names, ...labels].filter((x) => /^(Send|Play|Delete|Remove|Record again)/i.test(x.trim()) && !/song/i.test(x));
    for (const x of ['Delete', 'Remove', 'Discard', 'Record again']) { const el = page.getByRole('button', { name: new RegExp(x, 'i') }); if (await el.count()) await el.first().click().catch(() => undefined); }
    await page.waitForTimeout(500);
    const after = await hashOf(t2);
    console.log(`     take controls in A's tab: ${JSON.stringify(bad)}; hash before ${before?.slice(0, 16)}, after ${after?.slice(0, 16)}; same ${before === after}`);
    assert.equal(bad.length, 0); assert.equal(before, after); assert.ok(before); await ctx.close();
  });
  await t(`R2c [${w}] A's tab goes Home, to the record screen inside the app after B signed in: still A's tab, refused`, async () => {
    const { page, calls, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/`); await page.waitForTimeout(1500);
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B'); await seed(t2, { owner: 'B', key: 'b-key', queued: false });
    const before = await hashOf(t2);
    await page.getByText('Speak', { exact: true }).locator('visible=true').first().click(); await page.getByRole('button', { name: 'Start recording' }).waitFor({ timeout: 8000 });
    await page.locator('a[href="/"]:visible').first().click().catch(() => undefined); await page.waitForTimeout(500);
    await page.getByText('Speak', { exact: true }).locator('visible=true').first().click(); await page.getByRole('button', { name: 'Start recording' }).waitFor({ timeout: 8000 });
    const shownTake = await sendBtn(page).count();
    await record(page); const l = await line(page); const after = await hashOf(t2);
    console.log(`     take shown at restore ${shownTake}; after recording: line ${l}; B's recording same: ${before === after}; clips ${n(calls, 'POST', '/voice-clips')}`);
    assert.equal(shownTake, 0); assert.equal(l, 1); assert.equal(before, after); await ctx.close();
  });
  await t(`R2d [${w}] a tab that never got the event (B signed in with a write this tab did not hear): refused by the comparison`, async () => {
    const { page, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/speak`); await page.getByRole('button', { name: 'Start recording' }).waitFor();
    await page.evaluate(() => { window.addEventListener = ((orig) => (type: string, ...rest: any[]) => (type === 'storage' ? undefined : (orig as any).call(window, type, ...rest)))(window.addEventListener) as any; });
    await own(page, 'B'); // written from inside this tab: it hears no event, so it believes what it last knew
    await record(page); const d = await read(page);
    console.log(`     draft ${JSON.stringify(d)}, line ${await line(page)}`);
    assert.equal(d, null); assert.equal(await line(page), 1); await ctx.close();
  });
  await t(`R3 [${w}] typed words: type, leave, come back (same person gets them); B sees none; A's open tab cannot overwrite B's`, async () => {
    const { page, ctx } = await open(w, { mood: false });
    await page.goto(`${ORIGIN}/terms`); await setPerson(page, 'A'); await page.goto(`${ORIGIN}/q/q1/write`);
    await page.getByRole('textbox').fill('A typed this'); await page.waitForTimeout(400);
    await page.goto(`${ORIGIN}/terms`); await page.goto(`${ORIGIN}/q/q1/write`); await page.waitForTimeout(1200);
    const back = await page.getByRole('textbox').inputValue(); console.log(`     A comes back: "${back}"`); assert.equal(back, 'A typed this');
    const t2 = await ctx.newPage(); await t2.goto(`${ORIGIN}/terms`); await setPerson(t2, 'B'); await t2.goto(`${ORIGIN}/q/q1/write`); await t2.waitForTimeout(1200);
    const bsees = await t2.getByRole('textbox').inputValue(); console.log(`     B opens it: "${bsees}"`); assert.equal(bsees, '');
    await t2.getByRole('textbox').fill('B typed this'); await t2.waitForTimeout(400);
    await page.getByRole('textbox').fill('A types more'); await page.waitForTimeout(400);
    const stored = await page.evaluate(() => ({ t: localStorage.getItem('voices-typing-drafts'), o: localStorage.getItem('voices-typing-owners') }));
    console.log(`     stored: ${JSON.stringify(stored)}`); assert.ok(stored.t!.includes('A typed this')); assert.ok(!stored.t!.includes('B typed this')); assert.ok(!stored.t!.includes('A types more'));
    await ctx.close();
  });
}
await browser.close();
console.log(failed ? `${failed} of ${total} FAILED` : `all ${total} ok`);
process.exit(failed ? 1 : 0);
