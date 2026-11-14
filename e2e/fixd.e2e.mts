// V-FIX-D proof against the built app (next start) with the API stubbed in the browser.
//   npx next build && npx next start -p 3984 &   then ORIGIN=http://127.0.0.1:3984 npx tsx e2e/fixd.e2e.mts
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3984';
const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/fixd/shot';
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
interface Opts { free?: number; replies?: object[]; answerOther?: object }
async function open(w: number, opts: Opts = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: w < 600 ? 844 : 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
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
    if (p === '/questions/q1') return ok(question);
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

try {
  // ---- 1. the share sheet: the board's targets, both card sizes
  for (const w of [390, 1440]) {
    await t(`share sheet at ${w}: ten targets in the board's order; Stories and the square save their cards and count their taps`, async () => {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/q/q1/a/a1`);
      await page.getByRole('button', { name: 'Share this voice' }).first().click();
      const group = page.getByRole('group', { name: 'Share to' });
      await group.waitFor();
      await page.getByAltText('The card that goes out with your link').waitFor();
      const names = await group.locator('a,button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
      assert.deepEqual(names.slice(0, 9), ['WhatsApp', 'Status', 'Stories', 'Facebook', 'X', 'TikTok', 'Telegram', 'SMS', 'Copy link']);
      await shot(page, `sharesheet-${w}`);
      const dl = page.waitForEvent('download');
      await group.getByRole('button', { name: 'Stories' }).click();
      assert.equal((await dl).suggestedFilename(), 'voices-story-card.png');
      await page.getByTestId('card-saved').waitFor();
      await shot(page, `sharesheet-saved-${w}`);
      const dl2 = page.waitForEvent('download');
      await page.getByRole('button', { name: /Save the square card instead/ }).click();
      assert.equal((await dl2).suggestedFilename(), 'voices-square-card.png');
      const ev = find(calls, 'POST', '/share/abc1234/events').map((c) => c.body);
      assert.ok(ev.some((b) => b?.kind === 'intent' && b?.target === 'INSTAGRAM_STORIES'), 'no INSTAGRAM_STORIES intent');
      await group.getByRole('link', { name: 'Status' }).click({ trial: true });
      assert.match((await group.getByRole('link', { name: 'Status' }).getAttribute('href')) ?? '', /^https:\/\/wa\.me\/\?text=/);
      await ctx.close();
    });
  }

  // ---- 2. share measurement: recording_started and published_from_link, once each
  await t('arriving at /speak?from=<link>: recording_started once at the first record, published_from_link once after the post', async () => {
    const { page, calls, ctx } = await open(390);
    await page.goto(`${ORIGIN}/speak?from=abc1234`);
    await recordTake(page);
    await page.getByRole('button', { name: 'Re-record' }).click();
    await recordTake(page); // a second recording in the same visit must not send a second event
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.waitForURL(/\/posted\?a=new1/);
    const kinds = find(calls, 'POST', '/share/abc1234/events').map((c) => c.body?.kind);
    assert.deepEqual(kinds, ['recording_started', 'published_from_link']);
    await ctx.close();
  });
  await t('no share link in the visit: no recording_started and no published_from_link', async () => {
    const { page, calls, ctx } = await open(390);
    await page.goto(`${ORIGIN}/speak`);
    await recordTake(page);
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.waitForURL(/\/posted\?a=new1/);
    assert.equal(calls.filter((c) => c.path.includes('/events')).length, 0);
    await ctx.close();
  });

  // ---- 3. offline recordings
  await t('offline: Send keeps the recording as waiting and sends nothing; back online the free one goes by itself, once, with its own key', async () => {
    const { page, calls, ctx } = await open(390, { free: 5 });
    await page.goto(`${ORIGIN}/speak`);
    await recordTake(page);
    await ctx.setOffline(true);
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.getByText(/You are offline\. Your recording is saved on this device/).waitFor();
    await shot(page, 'offline-note-390');
    assert.equal(find(calls, 'POST', '/questions/q1/answers').length, 0);
    const kept = await page.evaluate(() => new Promise<{ queued?: boolean; key?: string } | null>((res) => {
      const r = indexedDB.open('voices-speak', 1);
      r.onsuccess = () => { const g = r.result.transaction('drafts').objectStore('drafts').get('current'); g.onsuccess = () => res(g.result ? { queued: g.result.queued, key: g.result.key } : null); };
      r.onerror = () => res(null);
    }));
    assert.equal(kept?.queued, true, 'the kept recording is not marked as waiting');
    await ctx.setOffline(false);
    await page.goto(`${ORIGIN}/`);
    await page.getByText('Your saved voice was posted.').waitFor();
    await shot(page, 'offline-sent-390');
    const posts = find(calls, 'POST', '/questions/q1/answers');
    assert.equal(posts.length, 1, 'posted ' + posts.length + ' times');
    assert.equal(posts[0].headers['idempotency-key'], kept?.key);
    await page.reload();
    await page.waitForTimeout(800);
    assert.equal(find(calls, 'POST', '/questions/q1/answers').length, 1, 'a reload sent it again');
    await ctx.close();
  });
  await t('offline, no free post left: the recording is offered with its price and goes only on the tap', async () => {
    const { page, calls, ctx } = await open(1440, { free: 0 });
    await page.goto(`${ORIGIN}/speak`);
    await page.getByRole('button', { name: 'Start recording' }).click();
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await page.getByRole('button', { name: /^Send/ }).waitFor();
    await ctx.setOffline(true);
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.getByText(/You are offline/).waitFor();
    await ctx.setOffline(false);
    await page.goto(`${ORIGIN}/`);
    const offer = page.getByRole('button', { name: /^Send for .+ tokens$/ });
    await offer.waitFor();
    await shot(page, 'offline-offer-1440');
    await page.waitForTimeout(600);
    assert.equal(find(calls, 'POST', '/voice-clips').length, 0, 'sent before the tap');
    await offer.click();
    await page.getByText('Your saved voice was posted.').waitFor();
    assert.equal(find(calls, 'POST', '/questions/q1/answers').length, 1);
    await ctx.close();
  });

  // ---- 4. anonymous replies
  await t('1440: text reply with the switch on sends anonymous true; off sends none', async () => {
    const { page, calls, ctx } = await open(1440);
    await page.goto(`${ORIGIN}/q/q1/a/a2`);
    const sw = page.getByRole('switch', { name: 'Post without my name' });
    await sw.waitFor();
    await shot(page, 'reply-switch-1440');
    const box = page.getByRole('region', { name: 'Reply' });
    await box.getByRole('button', { name: /I agree/ }).click();
    await box.getByRole('textbox').fill('Quietly agreed');
    await sw.check();
    await box.getByRole('button', { name: /^Post/ }).click();
    await page.waitForTimeout(700);
    let posts = find(calls, 'POST', '/answers/a2/replies');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body?.anonymous, true);
    await box.getByRole('textbox').fill('A named one');
    await box.getByRole('button', { name: /I agree/ }).click();
    assert.equal(await sw.isChecked(), false, 'the switch is not forgotten after a post');
    await box.getByRole('button', { name: /^Post/ }).click();
    await page.waitForTimeout(700);
    posts = find(calls, 'POST', '/answers/a2/replies');
    assert.equal(posts.length, 2);
    assert.ok(!('anonymous' in (posts[1].body ?? {})), 'a named reply sent anonymous');
    await ctx.close();
  });
  await t('390: the write screen for a reply has the switch and sends anonymous true', async () => {
    const { page, calls, ctx } = await open(390);
    await page.goto(`${ORIGIN}/q/q1/write?reply=a2&stance=AGREE`);
    const sw = page.getByRole('switch', { name: 'Post without my name' });
    await sw.waitFor();
    await page.getByRole('textbox').fill('Quietly agreed');
    await sw.check();
    await shot(page, 'reply-write-390');
    await page.getByRole('button', { name: /^(Post|Reply|Send)/ }).first().click();
    await page.waitForTimeout(700);
    const posts = find(calls, 'POST', '/answers/a2/replies');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body?.anonymous, true);
    await ctx.close();
  });
  for (const w of [390, 1440]) {
    await t(`${w}: a voice reply with the switch on sends anonymous true`, async () => {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/q/q1/a/a2`);
      await (w < 600 ? page.getByRole('button', { name: 'Reply by voice' }) : page.getByRole('button', { name: 'Use voice' })).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /I agree/ }).click();
      await recordTake(page);
      const sw = page.getByTestId('voice-box').getByRole('switch', { name: 'Post without my name' });
      await sw.waitFor();
      await sw.check();
      await shot(page, `reply-voice-${w}`);
      await page.getByRole('button', { name: /^Send/ }).click();
      await page.waitForTimeout(1500);
      const posts = find(calls, 'POST', '/answers/a2/replies');
      assert.equal(posts.length, 1);
      assert.equal(posts[0].body?.kind, 'VOICE');
      assert.equal(posts[0].body?.anonymous, true);
      await ctx.close();
    });
  }
  for (const w of [390, 1440]) {
    await t(`${w}: an unnamed reply reads Anonymous; its writer sees the tag, others do not`, async () => {
      for (const mine of [true, false]) {
        const { page, ctx } = await open(w, { replies: [reply({ id: 'ra', author: null, isMine: mine, body: 'Said without my name.' }), reply({ id: 'rb', author: other, isMine: false, body: 'A named reply.' })] });
        await page.goto(`${ORIGIN}/q/q1/a/a1`);
        await page.getByText('Said without my name.').waitFor();
        assert.equal(await page.getByText('Anonymous', { exact: true }).count() > 0, true);
        assert.equal(await page.getByTestId('anon-tag').count(), mine ? 1 : 0);
        assert.equal(await page.getByText('@tunde.a').count() > 0, true);
        if (mine) await shot(page, `reply-anon-mine-${w}`);
        await ctx.close();
      }
    });
  }
} finally {
  await browser.close();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
