// V-FIX-B proof against the built app (next start) with the API stubbed in the browser.
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
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, costs: config.costs };
const topic = { id: 't1', weekNumber: 3, title: 'Campaign Season', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 40, questionCount: 7 };
// a 1x1 PNG, served for the stub CDN
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
// 0.5 s of silence as a real WAV, so the browser can play what the stub serves
const wav = (() => { const n = 8000 * 0.5, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

interface Opts { extra?: (p: string, m: string, body: string, ok: (b: unknown, status?: number) => Promise<void>) => Promise<boolean>; w?: number; h?: number; signedIn?: boolean; override?: object | null; audioAd?: object | null; roles?: string[]; scheme?: 'light' | 'dark' }
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
const shot = (page: import('playwright-core').Page, name: string, full = false) => page.screenshot({ path: `${OUT}/fixb-${name}.png`, fullPage: full });

try {
  for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']] as const) {
    await t(`write screen ${tag}: Not news selected, Post ready; Request Verified News asks for a source and posts the request`, async () => {
      const { page, posts, ctx } = await open({ w, h });
      await page.goto(`${ORIGIN}/q/q1/write`);
      await page.getByRole('group', { name: 'Tag your post' }).waitFor();
            assert.deepEqual(await page.locator('.vx-tagpick [aria-pressed="true"]').allInnerTexts(), ['Not news']);
      await page.getByRole('textbox').first().fill('Water is up to my knees on Admiralty Way.');
      const post = page.getByRole('button', { name: /^Post/ }).first();
      assert.equal(await post.isDisabled(), false, 'Not news is selected, so Post is ready');
      await shot(page, `write-nothing-${tag}`, true);
      await page.getByRole('button', { name: 'Request Verified News' }).click();
      await page.getByTestId('tag-source').waitFor();
      assert.equal(await post.isDisabled(), true, 'Post waits for the source');
      await page.getByLabel('Your source').fill('Lagos State Emergency Agency');
      await page.getByLabel('Link to the source (optional)').fill('https://example.com/lasema');
      assert.equal(await post.isDisabled(), false);
      await shot(page, `write-request-${tag}`, true);
      await post.click();
      await page.waitForURL('**/posted?a=new1');
      assert.equal(posts.length, 1);
      assert.deepEqual({ ...posts[0] }, { kind: 'TEXT', body: 'Water is up to my knees on Admiralty Way.', isNews: true, newsTag: 'UNVERIFIED_NEWS', requestVerified: true, newsSourceName: 'Lagos State Emergency Agency', newsSourceUrl: 'https://example.com/lasema' });
      await ctx.close();
    });
  }
  await t('write screen: Gossip posts as Gossip; an editor sees Verified News and posts it with a source', async () => {
    const g = await open();
    await g.page.goto(`${ORIGIN}/q/q1/write`);
    await g.page.getByRole('textbox').first().fill('They say the fare is going up again.');
    await g.page.getByRole('button', { name: 'Gossip' }).click();
    await g.page.getByRole('button', { name: /^Post/ }).first().click();
    await g.page.waitForURL('**/posted?a=new1');
    assert.deepEqual({ ...g.posts[0] }, { kind: 'TEXT', body: 'They say the fare is going up again.', isNews: true, newsTag: 'GOSSIP' });
    await g.ctx.close();
    const e = await open({ roles: ['EDITOR'] });
    await e.page.goto(`${ORIGIN}/q/q1/write`);
    await e.page.getByRole('button', { name: 'Verified News', exact: true }).waitFor();
    assert.equal(await e.page.getByRole('button', { name: 'Request Verified News' }).count(), 0);
    await e.page.getByRole('textbox').first().fill('NiMet warns of heavy rain tonight.');
    await e.page.getByRole('button', { name: 'Verified News', exact: true }).click();
    await e.page.getByLabel('Your source').fill('NiMet bulletin');
    await e.page.getByRole('button', { name: /^Post/ }).first().click();
    await e.page.waitForURL('**/posted?a=new1');
    assert.deepEqual({ ...e.posts[0] }, { kind: 'TEXT', body: 'NiMet warns of heavy rain tonight.', isNews: true, newsTag: 'VERIFIED_NEWS', newsSourceName: 'NiMet bulletin' });
    await e.ctx.close();
  });
  for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']] as const) {
    await t(`record screen ${tag}: a voice carries the tag when one is picked`, async () => {
      const { page, posts, ctx } = await open({ w, h });
      await page.goto(`${ORIGIN}/q/q1/speak`);
      await page.getByRole('button', { name: 'Start recording' }).click();
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Stop recording' }).click();
      await page.getByRole('group', { name: 'Tag your post' }).waitFor();
      const send = page.getByRole('button', { name: /^Send/ });
      assert.equal(await send.isDisabled(), false, 'Not news is selected, so Send is ready');
      assert.deepEqual(await page.locator('.vx-tagpick [aria-pressed="true"]').allInnerTexts(), ['Not news']);
      await shot(page, `speak-nothing-${tag}`, true);
      await page.getByRole('button', { name: 'Unverified News' }).click();
      assert.equal(await send.isDisabled(), false);
      await shot(page, `speak-chosen-${tag}`, true);
      await send.click();
      await page.waitForURL('**/posted?a=new1', { timeout: 20000 });
      assert.equal(posts.length, 1);
      assert.equal(posts[0].kind, 'VOICE');
      assert.equal(posts[0].isNews, true);
      assert.equal(posts[0].newsTag, 'UNVERIFIED_NEWS');
      await ctx.close();
    });
  }
  await t('write screen: with Not news left selected the post carries no tag, in one tap', async () => {
    const g = await open();
    await g.page.goto(`${ORIGIN}/q/q1/write`);
    await g.page.getByRole('textbox').first().fill('Plain words.');
    await g.page.getByRole('button', { name: /^Post/ }).first().click();
    await g.page.waitForURL('**/posted?a=new1');
    assert.deepEqual({ ...g.posts[0] }, { kind: 'TEXT', body: 'Plain words.' });
    await g.ctx.close();
  });
  await t('Finish and post my voice: a held voice with autopost=1 sends itself in one tap, with no tag', async () => {
    const { page, posts, ctx } = await open();
    await page.goto(`${ORIGIN}/welcome`);
    await page.evaluate(() => new Promise<void>((res, rej) => {
      const r = indexedDB.open('voices-speak', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('drafts');
      r.onsuccess = () => { const tx = r.result.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ owner: null, questionId: 'q1', blob: new Blob([new Uint8Array(3000)], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [1, 2, 3], key: 'k-held', savedAt: Date.now() }, 'current'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    }));
    await page.goto(`${ORIGIN}/q/q1/speak?autopost=1`);
    await page.waitForURL('**/posted?a=new1', { timeout: 20000 });
    assert.equal(posts.length, 1);
    assert.deepEqual({ ...posts[0] }, { kind: 'VOICE', clipId: 'c1' });
    await ctx.close();
  });
  const override = { contentKind: 'TEXT', body: 'Tell us where you are. If you are safe, say so, so your people can hear it.', audioUrl: null, audioClipId: '44444444-4444-4444-8444-444444444444', audioDurationMs: 14000, imageUrl: 'https://cdn.fixb.test/file/override_image/x.png', linkUrl: 'https://example.com/flood-help', endsAt: new Date(Date.now() + 20 * 3600e3).toISOString() };
  for (const [w, h, tag, scheme] of [[390, 844, '390', 'light'], [390, 844, '390-dark', 'dark'], [1440, 900, '1440', 'light']] as const) {
    await t(`Home ${tag}: the override shows its message, picture, voice note and link button`, async () => {
      const { page, plays, ctx } = await open({ w, h, signedIn: false, override, scheme });
      await page.goto(`${ORIGIN}/`);
      await page.getByTestId('override-message').waitFor();
      await page.getByTestId('override-image').waitFor();
      await page.waitForFunction(() => { const i = document.querySelector('[data-testid=override-image]') as HTMLImageElement | null; return !!i && i.complete && i.naturalWidth > 0; });
      const link = page.getByRole('link', { name: /Open the link/ });
      assert.equal(await link.getAttribute('href'), 'https://example.com/flood-help');
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(plays.length, 0, 'the voice note is not fetched before a tap');
      await shot(page, `home-override-${tag}`, true);
      await page.getByTestId('override-audio').getByRole('button', { name: /Play voice/ }).click();
      await page.waitForTimeout(500);
      assert.deepEqual(plays, ['44444444-4444-4444-8444-444444444444']);
      await ctx.close();
    });
  }
  const ad = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'AUDIO_SLOT', brand: "Mama Nkechi's Kitchen", label: 'Ad', headline: "Hear this week's soup of the day", body: 'Fresh egusi, delivered hot in Ikeja.', imageUrl: null, audioClipId: '55555555-5555-4555-8555-555555555555', audioDurationMs: 15000, linkUrl: 'https://example.com/kitchen', ctaLabel: 'Visit page' };
  for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']] as const) {
    await t(`Home ${tag}: the audio advert is labelled Ad, plays on tap, and counts one view and one listen`, async () => {
      const { page, events, plays, ctx } = await open({ w, h, signedIn: false, audioAd: ad });
      await page.goto(`${ORIGIN}/`);
      const box = page.getByTestId('audio-ad');
      await box.scrollIntoViewIfNeeded();
      await box.waitFor();
      assert.ok(await box.getByText('Ad', { exact: true }).first().isVisible(), 'Ad label');
      await page.waitForTimeout(600);
      assert.equal(events.filter((e) => e.kind === 'IMPRESSION').length, 1);
      assert.equal(plays.length, 0);
      await shot(page, `home-audio-ad-${tag}`, true);
      await box.getByRole('button', { name: /Play voice/ }).click();
      await page.waitForTimeout(600);
      assert.deepEqual(plays, [ad.audioClipId]);
      assert.equal(events.filter((e) => e.kind === 'LISTEN').length, 1);
      await ctx.close();
    });
  }
  // ---- round 2
  await t('guest: the tag and the source chosen before joining are kept with the held recording', async () => {
    const { page, ctx } = await open({ signedIn: false });
    await page.goto(`${ORIGIN}/q/q1/speak`);
    await page.getByRole('button', { name: 'Start recording' }).click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await page.getByRole('button', { name: 'Request Verified News' }).click();
    await page.getByLabel('Your source').fill('Lagos State Emergency Agency');
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: /^Send/ }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/join') || u.pathname.includes('sign'), { timeout: 20000 });
    const tag = await page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onsuccess = () => { const g = r.result.transaction('drafts').objectStore('drafts').get('current'); g.onsuccess = () => res(g.result?.tag ?? null); g.onerror = () => rej(g.error); }; r.onerror = () => rej(r.error); }));
    assert.deepEqual(tag, { pick: 'REQUEST_VERIFIED', sourceName: 'Lagos State Emergency Agency', sourceUrl: '' });
    await ctx.close();
  });
  await t('Finish and post my voice sends the held tag and source in one tap', async () => {
    const { page, posts, ctx } = await open();
    await page.goto(`${ORIGIN}/welcome`);
    await page.evaluate(() => new Promise<void>((res, rej) => {
      const r = indexedDB.open('voices-speak', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('drafts');
      r.onsuccess = () => { const tx = r.result.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ owner: null, questionId: 'q1', blob: new Blob([new Uint8Array(3000)], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [1, 2, 3], key: 'k-held2', savedAt: Date.now(), tag: { pick: 'REQUEST_VERIFIED', sourceName: 'Lagos State Emergency Agency', sourceUrl: 'https://example.com/s' } }, 'current'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    }));
    await page.goto(`${ORIGIN}/q/q1/speak?autopost=1`);
    await page.waitForURL('**/posted?a=new1', { timeout: 20000 });
    assert.deepEqual({ ...posts[0] }, { kind: 'VOICE', clipId: 'c1', isNews: true, newsTag: 'UNVERIFIED_NEWS', requestVerified: true, newsSourceName: 'Lagos State Emergency Agency', newsSourceUrl: 'https://example.com/s' });
    await ctx.close();
  });
  for (const [w, h, tag] of [[1440, 900, '1440']] as const) {
    await t(`admin news ${tag}: Asking for Verified News is the first tab, shows the source, and approves`, async () => {
      const decisions: Record<string, unknown>[] = [];
      const item = { answer: answer({ id: 'n1', news: { tag: 'UNVERIFIED_NEWS', sourceName: null, sourceUrl: null, chosenBy: '@me.handle', chosenAt: new Date().toISOString() } }), flagCount: 0, flagReasons: [], verifiedRequested: true, sourceName: 'Lagos State Emergency Agency', sourceUrl: 'https://example.com/lasema', evidenceUrl: null, changeLog: [], summary: 'Water is up to my knees' };
      const { page, ctx } = await open({ w, h, roles: ['EDITOR'], extra: async (p, m, body, ok) => {
        if (p === '/admin/today') { await ok({ date: '2026-11-15', weekNumber: 1, topic, flowState: 'NORMAL', todaysQuestion: question(), stats: { sharesByTarget: [], voicesToday: 0, voicePercent: 0, pollVotes: 0, shares: 0, openReports: 0, oldestReportMinutes: null, dailyQuestionMailsToday: 0, weeklyTopicMailsToday: 0, topicMailBudgetLeftToday: 0 }, schedule: [], nextQuestion: null, needsAttention: { flaggedNews: 0, askingVerified: 1, openReports: 0, adsAwaiting: 0, resultsToCheck: 0, newsTags: 1 } }); return true; }
        if (p === '/admin/news/items') { await ok({ items: [item], nextCursor: null, waiting: 1, counts: { flagged: 0, askingVerified: 1, allChanges: 0 } }); return true; }
        if (p === '/admin/news/n1/decision' && m === 'POST') { decisions.push(JSON.parse(body)); await ok({}); return true; }
        return false;
      } });
      await page.goto(`${ORIGIN}/admin/news`);
      const tabs = page.getByRole('tablist', { name: 'News queues' }).getByRole('tab');
      await tabs.first().waitFor();
      assert.match(await tabs.first().innerText(), /Asking for Verified News/);
      assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
      assert.match(await page.getByTestId('request-source').innerText(), /Lagos State Emergency Agency/);
      await shot(page, `admin-news-asking-${tag}`, true);
      await page.getByLabel('Reason (the poster sees this)').fill('Checked with the agency.');
      await page.getByRole('button', { name: 'Approve Verified News' }).click();
      await page.getByText('Verified News approved').waitFor();
      assert.equal(decisions[0].decision, 'APPROVE_VERIFIED');
      assert.equal(decisions[0].sourceName, 'Lagos State Emergency Agency');
      await ctx.close();
    });
  }
  await t('settings: the News tag alerts switch saves notifyTagFollows', async () => {
    const patches: Record<string, unknown>[] = [];
    const settings = { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyWeeklyTopic: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, notifyTagFollows: true, dailyQuestionMinute: 480, shareMyWord: true };
    const { page, ctx } = await open({ extra: async (p, m, body, ok) => {
      if (p === '/me') { await ok({ id: 'u1', wawuId: 'w1', handle: 'me.handle', profileComplete: true, roles: [], status: 'ACTIVE', phoneMasked: '+234 *** 1234', savedCount: 0, replyCount: 0, reactionsReceived: 0, unreadNotifications: 0, allowances: allowance, settings, profile: { handle: 'me.handle', displayName: 'Me Person', bio: null, avatarUrl: null, countryCode: 'NG', state: null, city: null, languages: ['en'], voiceCard: null, voiceCount: 0 } }); return true; }
      if (p === '/me/settings') { if (m === 'PATCH') { patches.push(JSON.parse(body)); Object.assign(settings, JSON.parse(body)); } await ok(settings); return true; }
      if (p === '/categories' || p === '/me/categories') { await ok(p === '/categories' ? { items: [] } : { categories: [] }); return true; }
      return false;
    } });
    await page.goto(`${ORIGIN}/settings`);
    const sw = page.getByRole('switch', { name: 'News tag alerts' });
    await sw.waitFor();
    assert.equal(await sw.isChecked(), true);
    await shot(page, 'settings-tag-alerts-390', true);
    await sw.click();
    await page.waitForTimeout(500);
    assert.deepEqual(patches, [{ notifyTagFollows: false }]);
    await ctx.close();
  });
  for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']] as const) {
    await t(`${tag}: a 60 character label and a 100 character word wrap and never scroll sideways`, async () => {
      const longAd = { ...ad, headline: 'W'.repeat(100), body: 'B'.repeat(100), ctaLabel: 'Order the very long named product today from us now '.slice(0, 60) };
      const longOv = { contentKind: 'TEXT', body: 'Z'.repeat(200), audioUrl: null, imageUrl: null, linkUrl: 'https://example.com/' + 'p'.repeat(150), endsAt: new Date(Date.now() + 20 * 3600e3).toISOString() };
      const { page, ctx } = await open({ w, h, signedIn: false, override: longOv, audioAd: longAd });
      await page.goto(`${ORIGIN}/`);
      await page.getByTestId('audio-ad').waitFor();
      await page.getByTestId('override-message').waitFor();
      const widths = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
      assert.ok(widths.doc <= widths.win, `page scrolls sideways: ${widths.doc} > ${widths.win}`);
      await shot(page, `home-long-${tag}`, true);
      await ctx.close();
    });
  }
  await t('an advert link opens in a new tab with rel noopener noreferrer, and pauses the advert', async () => {
    const { page, plays, ctx } = await open({ signedIn: false, audioAd: ad });
    await page.goto(`${ORIGIN}/`);
    const box = page.getByTestId('audio-ad');
    await box.getByRole('button', { name: /Play voice/ }).click();
    await box.getByRole('button', { name: /Pause voice/ }).waitFor();
    const link = box.getByRole('link', { name: /Visit page/ });
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    await link.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
    await link.click();
    await box.getByRole('button', { name: /Play voice/ }).waitFor({ timeout: 5000 });
    assert.equal(plays.length >= 1, true);
    await ctx.close();
  });
} finally { await browser.close(); }
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
