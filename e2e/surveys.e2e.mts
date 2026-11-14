// V-SURVEYS proof against the built app (next start) with the API stubbed in the browser. No live service is called.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/surveys.e2e.mts
// Pictures go to docs/lead/surveys/shots/ (390x844 and 1440x900, deviceScaleFactor 2) to be set beside the boards.
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3977';
const SHOTS = process.env.SHOTS ?? 'docs/lead/surveys/shots';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
mkdirSync(SHOTS, { recursive: true });

const now = () => new Date().toISOString();
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const allowance = { freePostsRemaining: 7, balanceMilli: 12500, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const topic = { questionCount: 5, id: 't1', weekNumber: 1, title: 'Power and light', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 10, voicesCount: 10 };
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'When salary arrives, how long before it is gone?', hint: null, moodOptions: [], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const meBody = (roles: string[]) => ({ phoneMasked: '+234 803 *** 4412', id: 'u1', wawuId: 'w', handle: 'me.handle', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles, profile: { id: 'u1', handle: 'me.handle', displayName: 'Ngozi Eze', bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Lagos', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'light', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480, shareMyWord: false, useMyStateForSurveys: false } });

const opts = (...l: string[]) => l.map((label, i) => ({ id: 'o' + (i + 1), label }));
const surveyBody = (over: object = {}) => ({
  id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: 'https://zobo.example', title: 'Power and light', questionCount: 3,
  note: 'x', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24', '25-34', '35-44', '45-54', '55+'],
  questions: [
    { id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How many hours of light did you get yesterday?', options: [{ id: 'h1', label: '1 to 6 hours' }, { id: 'h2', label: '7 to 12 hours' }, { id: 'h3', label: 'More than 12 hours' }] },
    { id: 'q2', position: 2, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool when there is no light?', options: opts('A fan on battery', 'Cold drinks', 'Sleep outside', 'I just bear it') },
    { id: 'q3', position: 3, kind: 'VOICE', prompt: 'Anything else you want them to hear?', options: [] },
  ], ...over,
});
const brandPage = { brand: { name: 'Zobo Fresh', slug: 'zobo-fresh', tagline: 'Cold zobo and kunu, brewed in Lagos every morning. Delivered on Lagos Island and Lekki.', website: 'https://zobo.example', logoUrl: null, label: 'Sponsored' },
  surveys: [{ id: 's1', title: 'How do you keep cool when there is no light?', label: 'Sponsored Survey', questionCount: 3, endsOn: null }],
  ads: [{ id: 'a1', kind: 'FEED_CARD', label: 'Ad', headline: 'Cold zobo, delivered in 30 minutes', body: 'Lagos Island and Lekki only. Order before 6pm.', imageUrl: null, linkUrl: 'https://zobo.example/order', ctaLabel: 'Order now' }] };

const adminSurvey = (over: object = {}) => ({ id: 's1', brandId: null, brandName: 'Zobo Fresh', contactEmail: 'hello@zobo.example', title: 'Power and light', status: 'AWAITING_APPROVAL', label: 'Sponsored Survey', live: false,
  checks: [{ text: 'No banned wording', ok: true }, { text: 'Dates are set', ok: true }, { text: 'A price is set', ok: false }],
  questions: surveyBody().questions, categoryIds: [], states: ['Lagos'], startsOn: '2026-11-20', endsOn: '2026-11-30', frequencyCapPerDay: 1, priceKobo: null, responseTarget: 200,
  views: 0, starts: 0, completes: 0, skips: 0, responses: 0, rejectReason: null, changeRequest: null, submittedAt: now(), approvedAt: null, ...over });
const report = (over: object = {}) => ({ stage: 'RELEASED', ready: true, released: true, releasedAt: '2026-12-02T09:00:00Z', survey: { id: 's1', brandName: 'Zobo Fresh', title: 'Power and light', status: 'APPROVED', startsOn: '2026-11-20', endsOn: '2026-11-30', responseTarget: 200 }, minGroupSize: 20, belowMinimum: false,
  totals: { views: 940, starts: 210, skips: 64, responses: 146, completionRate: 70 },
  questions: [
    { id: 'q2', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool when there is no light?', answered: 146, options: [{ id: 'o1', label: 'A fan on battery', count: 38, share: 26, hidden: false }, { id: 'o2', label: 'Cold drinks', count: 67, share: 46, hidden: false }, { id: 'o3', label: 'Sleep outside', count: 29, share: 20, hidden: false }, { id: 'o4', label: 'I just bear it', count: null, share: null, hidden: true }], other: null, texts: [], voices: [] },
    { id: 'q3', position: 2, kind: 'TEXT', prompt: 'Anything else you want them to hear?', answered: 41, options: [], other: null, texts: ['Cold zobo helps a lot.', 'Please deliver to Ikorodu too.'], voices: [] },
    { id: 'q4', position: 3, kind: 'VOICE', prompt: 'Say it in your own words', answered: 22, options: [], other: null, texts: [], voices: [{ transcript: 'We run the freezer on a generator.', seconds: 12 }] },
  ],
  byState: [{ state: 'Lagos', responses: 80, share: 55 }, { state: 'Ogun', responses: 31, share: 21 }], byAgeBand: [{ ageBand: '25-34', responses: 62, share: 42 }, { ageBand: '35-44', responses: 40, share: 27 }],
  note: 'Results are combined and anonymous. Free answers have contact details removed.', ...over });

const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

type Call = { method: string; path: string; body: Record<string, unknown> | null };
interface Opts { freeHidden?: boolean; roles?: string[]; placement?: object | null; placementStatus?: number; answerStatus?: number; survey?: object; report?: object; offline?: boolean; signedOut?: boolean }
async function open(w: number, h: number, o: Opts = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'light' });
  if (!o.signedOut) await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const calls: Call[] = [];
  const hiddenIds = new Set<string>(o.freeHidden ? ['f2'] : []);
  const freeItems = () => [{ id: 'f1', questionId: 'q3', prompt: 'Anything else you want them to hear?', kind: 'TEXT', text: 'Cold zobo helps a lot.', seconds: null }, { id: 'f2', questionId: 'q3', prompt: 'Anything else you want them to hear?', kind: 'TEXT', text: 'Please deliver to Ikorodu too.', seconds: null }, { id: 'f3', questionId: 'q4', prompt: 'Say it in your own words', kind: 'VOICE', text: 'We run the freezer on a generator.', seconds: 12 }].map((x) => ({ ...x, hidden: hiddenIds.has(x.id) }));
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const err = (status: number, message: string) => ok({ error: { code: 'ERR', message } }, status);
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    if (m !== 'GET') calls.push({ method: m, path: p, body });
    if (o.offline && p.startsWith('/surveys/s1') && m === 'GET') return route.abort('internetdisconnected');
    if (p === '/surveys/placement') return o.placementStatus ? err(o.placementStatus, 'no') : ok({ survey: o.placement === undefined ? { id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 'How do you keep cool when there is no light?', questionCount: 3 } : o.placement });
    if (p === '/surveys/s1' && m === 'GET') return ok(o.survey ?? surveyBody());
    if (p === '/surveys/s1/events') return route.fulfill({ status: 204 });
    if (p === '/surveys/s1/responses') return o.answerStatus === 409 ? err(409, 'You already answered this survey.') : ok({ ok: true, note: '' }, 201);
    if (p === '/brands/zobo-fresh') return ok(brandPage);
    if (p === '/brands/nope') return err(404, 'no');
    if (p === '/ads/placement') return ok({ ad: null });
    if (p === '/voice-clips' && m === 'POST') return ok({ clip: { id: 'c1', status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (p === '/voice-clips/c1/complete') return ok({ id: 'c1', status: 'PROCESSING' });
    if (p === '/voice-clips/c1') return ok({ id: 'c1', status: 'READY', durationMs: 12000, maxDurationMs: 30000, peaks: [] });
    if (p === '/admin/surveys' && m === 'GET') return ok({ items: [adminSurvey(), adminSurvey({ id: 's2', brandName: 'Kunu Co', title: 'Evening snacks', status: 'APPROVED', live: true, views: 940, starts: 210, responses: 146, priceKobo: 5000000 }), adminSurvey({ id: 's3', brandName: 'Bright Solar', title: 'Backup power', status: 'DRAFT' })], nextCursor: null, awaitingApproval: 1 });
    if (p === '/admin/surveys/s1/decision') return err(422, 'A price is needed before this can run.');
    if (p === '/admin/surveys/s1/free-answers' && m === 'GET') return ok({ released: false, items: freeItems(), total: 3, hiddenCount: hiddenIds.size });
    const fa = p.match(/^\/admin\/surveys\/s1\/free-answers\/(\w+)$/);
    if (fa && m === 'PATCH') { if (body?.hidden) hiddenIds.add(fa[1]); else hiddenIds.delete(fa[1]); return ok({ id: fa[1], hidden: !!body?.hidden }); }
    if (p === '/admin/surveys/s1/release') return ok({ released: true, releasedAt: '2026-12-02T09:00:00Z', hiddenCount: hiddenIds.size, mailed: true });
    if (p === '/admin/ads' && m === 'GET') return ok({ items: [{ id: 'a1', brand: 'Zobo Fresh', brandId: null, kind: 'FEED_CARD', status: 'AWAITING_APPROVAL', live: false, headline: 'Cold zobo, delivered', body: null, linkUrl: 'https://zobo.example', ctaLabel: null, imageUrl: null, audioClipId: null, categoryIds: [], states: [], ageBands: [], startsOn: null, endsOn: null, frequencyCapPerDay: 3, priceKobo: null, views: 0, taps: 0, listens: 0, rejectReason: null, changeRequest: null, checks: [] }], nextCursor: null, awaitingApproval: 1 });
    if (p === '/me/settings' && m === 'PATCH') return ok({ ...meBody([]).settings, ...(body ?? {}) });
    if (p === '/admin/surveys/s1/report') return ok(o.report ?? report());
    if (p === '/admin/brands') return ok({ items: [{ id: 'b1', name: 'Zobo Fresh', slug: 'zobo-fresh', tagline: 'Cold zobo.', website: 'https://zobo.example', contactEmail: 'hello@zobo.example', active: true, logoUrl: null, label: 'Brand' }, { id: 'b2', name: 'Kunu Co', slug: 'kunu-co', tagline: null, website: null, contactEmail: null, active: false, logoUrl: null, label: 'Brand' }] });
    if (p === '/admin/today') return ok({ needsAttention: { ads: 1 } });
    if (p === '/categories') return ok({ items: [{ id: 'c1', slug: 'power', name: 'Power and light', blurb: null, voicesThisWeek: 0, questionCount: 0 }, { id: 'c2', slug: 'money', name: 'Money', blurb: null, voicesThisWeek: 0, questionCount: 0 }] });
    if (p === '/config/public') return ok({ currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] });
    if (p === '/me/allowance') return ok(allowance);
    if (p === '/me') return ok(meBody(o.roles ?? []));
    if (p === '/home') return ok({ topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Ngozi' });
    if (p === '/topics/current') return ok(topic);
    if (p === '/questions/today') return ok(question);
    if (p === '/polls/flash') return ok({ items: [] });
    if (p === '/me/answers') return ok({ items: [], nextCursor: null });
    return ok({ items: [] });
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR ' + e.message + ' ' + (e.stack ?? '').split('\n').slice(1,3).join(' | ')); });
  return { page, calls, ctx };
}
const shot = async (page: Page, name: string, w: number) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500); return page.screenshot({ path: `${SHOTS}/${name}-${w}.png` }); };
const find = (calls: Call[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);
const kinds = (calls: Call[]) => find(calls, 'POST', '/surveys/s1/events').map((c) => c.body?.kind);
const SIZES: [number, number][] = [[390, 844], [1440, 900]];

try {
  for (const [w, h] of SIZES) {
    await t(`Home feed card at ${w}: labelled card, one VIEW, opens the survey`, async () => {
      const { page, calls, ctx } = await open(w, h);
      await page.goto(`${ORIGIN}/`);
      const card = page.locator('section[aria-label="Sponsored Survey from Zobo Fresh"]');
      await card.scrollIntoViewIfNeeded();
      await card.waitFor();
      await card.getByText('Sponsored Survey', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Start the survey' }).getAttribute('href'), '/surveys/s1');
      await page.waitForTimeout(300);
      assert.deepEqual(kinds(calls), ['VIEW']);
      await card.scrollIntoViewIfNeeded();
      await shot(page, 'FeedCard', w);
      await ctx.close();
    });
    await t(`Home with no survey (null) and with a failed placement at ${w}: nothing drawn`, async () => {
      for (const o of [{ placement: null }, { placementStatus: 500 }]) {
        const { page, ctx } = await open(w, h, o);
        await page.goto(`${ORIGIN}/`);
        await page.getByRole('heading', { level: 1 }).first().waitFor();
        await page.waitForTimeout(400);
        assert.equal(await page.locator('section[aria-label^="Sponsored Survey"]').count(), 0);
        await ctx.close();
      }
    });
    await t(`Survey at ${w}: question 2 of 3, answer by answer, record by voice, send, Done`, async () => {
      const { page, calls, ctx } = await open(w, h);
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('radio', { name: '1 to 6 hours' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      await shot(page, 'Survey', w);
      await page.getByRole('radio', { name: 'Cold drinks' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 3 of 3').waitFor();
      await shot(page, 'SurveyVoice', w);
      // record with the fake microphone
      await page.getByRole('button', { name: /record|tap to/i }).first().click();
      await page.waitForTimeout(1600);
      await page.getByRole('button', { name: /stop/i }).first().click();
      await page.getByRole('button', { name: 'Send answer' }).last().waitFor();
      await shot(page, 'SurveyShare', w);
      await page.getByRole('switch', { name: 'Share my state' }).click();
      await page.getByRole('button', { name: 'Send answer' }).last().click();
      await page.getByText('Thanks. Your answers are in.').waitFor();
      const post = find(calls, 'POST', '/surveys/s1/responses')[0].body as { answers: Record<string, string>[]; shareState?: boolean };
      assert.equal(post.answers.length, 3);
      assert.deepEqual(post.answers.slice(0, 2), [{ questionId: 'q1', optionId: 'h1' }, { questionId: 'q2', optionId: 'o2' }]);
      assert.equal(post.answers[2].clipId, 'c1');
      assert.equal(post.shareState, true);
      assert.equal(find(calls, 'POST', '/voice-clips')[0].body?.purpose, 'SURVEY_ANSWER');
      assert.deepEqual(kinds(calls), ['START']);
      assert.ok(!/₦|token/i.test(await page.locator('main').innerText()), 'a price or token word is on the Done screen');
      await shot(page, 'SurveyDone', w);
      await ctx.close();
    });
    await t(`Survey at ${w}: a second answer (409) shows Done, not an error`, async () => {
      const { page, ctx } = await open(w, h, { answerStatus: 409, survey: surveyBody({ questionCount: 1, questions: [surveyBody().questions[1]] }) });
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByRole('radio', { name: 'Cold drinks' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Thanks. Your answers are in.').waitFor();
      assert.equal(await page.getByText('You already answered this survey.').count(), 0);
      await ctx.close();
    });
    await t(`Survey at ${w}: Skip leaves the question out; Leave counts a SKIP and goes Home`, async () => {
      const { page, calls, ctx } = await open(w, h);
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('button', { name: w < 1024 ? 'Skip' : 'Skip this question', exact: true }).click();
      await page.getByText('Question 2 of 3').waitFor();
      await page.getByRole('button', { name: 'Leave the survey' }).filter({ visible: true }).first().click();
      await page.waitForURL(`${ORIGIN}/`);
      assert.deepEqual(kinds(calls), ['START', 'SKIP']);
      assert.equal(find(calls, 'POST', '/surveys/s1/responses').length, 0);
      await ctx.close();
    });
    await t(`Survey at ${w}: offline load shows the offline banner with Try again`, async () => {
      const { page, ctx } = await open(w, h, { offline: true });
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('You are offline').waitFor();
      await page.getByRole('button', { name: 'Try again' }).waitFor();
      await shot(page, 'SurveyOffline', w);
      await ctx.close();
    });
    await t(`Brand page at ${w}`, async () => {
      const { page, ctx } = await open(w, h, { signedOut: true });
      await page.goto(`${ORIGIN}/brands/zobo-fresh`);
      await page.getByRole('heading', { name: 'Zobo Fresh', exact: true }).waitFor();
      await page.getByText('Cold zobo, delivered in 30 minutes').waitFor();
      assert.ok(!/@/.test(await page.locator('main').innerText()), 'an address shows on the brand page');
      await shot(page, 'BrandPage', w);
      await page.goto(`${ORIGIN}/brands/nope`);
      await page.getByText('We could not find that brand').waitFor();
      await ctx.close();
    });
  }

  // ---- round 2
  await t('H1 at 390: no VIEW while the card is below the fold; one VIEW when half of it shows', async () => {
    const { page, calls, ctx } = await open(390, 844);
    await page.goto(`${ORIGIN}/`);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    await page.waitForTimeout(1200);
    assert.deepEqual(kinds(calls), []);
    await page.locator('section[aria-label="Sponsored Survey from Zobo Fresh"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    assert.deepEqual(kinds(calls), ['VIEW']);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('section[aria-label="Sponsored Survey from Zobo Fresh"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    assert.deepEqual(kinds(calls), ['VIEW']);
    await ctx.close();
  });
  for (const [w, h] of SIZES) {
    await t(`H2 and H3 at ${w}: a reload keeps the answers and the place, and sends no second START`, async () => {
      const { page, calls, ctx } = await open(w, h);
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('radio', { name: '1 to 6 hours' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      await page.reload();
      await page.getByText('Question 2 of 3').waitFor();
      // question 1 still holds its answer
      await page.getByRole('button', { name: 'Back', exact: true }).filter({ visible: true }).first().click().catch(() => undefined);
      if (w < 1024) {
        // the phone has no Back button: skip forward and back is not drawn; the saved answer goes out with the send
        await page.getByRole('radio', { name: 'Cold drinks' }).click();
        await page.getByRole('button', { name: 'Send answer' }).click();
        await page.getByText('Question 3 of 3').waitFor();
      } else {
        await page.getByText('Question 1 of 3').waitFor();
        await page.locator('[role=radio][aria-checked=true]').filter({ hasText: '1 to 6 hours' }).waitFor({ timeout: 4000 });
      }
      assert.equal(kinds(calls).filter((k) => k === 'START').length, 1, JSON.stringify(kinds(calls)));
      await ctx.close();
    });
    await t(`H3 at ${w}: Back with answers asks on the page; Keep going stays; Leave sends one SKIP`, async () => {
      const { page, calls, ctx } = await open(w, h);
      await page.goto(`${ORIGIN}/`);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('radio', { name: '1 to 6 hours' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      await page.goBack();
      await page.getByText('Your answers so far have not been sent.').waitFor();
      assert.ok(page.url().includes('/surveys/s1'));
      await shot(page, 'SurveyLeaveAsk', w);
      await page.getByRole('button', { name: 'Keep going' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      assert.deepEqual(kinds(calls), ['START']);
      await page.goBack();
      await page.getByRole('button', { name: 'Leave', exact: true }).click();
      await page.waitForURL(`${ORIGIN}/`);
      await page.waitForTimeout(300);
      assert.deepEqual(kinds(calls), ['START', 'SKIP']);
      await ctx.close();
    });
    await t(`H3 at ${w}: Back with no answers sends one SKIP; closing the tab sends one SKIP`, async () => {
      const a = await open(w, h);
      await a.page.goto(`${ORIGIN}/`);
      await a.page.getByRole('heading', { level: 1 }).first().waitFor();
      await a.page.goto(`${ORIGIN}/surveys/s1`);
      await a.page.getByText('Question 1 of 3').waitFor();
      await a.page.goBack();
      await a.page.waitForURL(`${ORIGIN}/`);
      await a.page.waitForTimeout(300);
      assert.deepEqual(kinds(a.calls), ['START', 'SKIP']);
      await a.ctx.close();
      // A request sent while the page unloads is not seen by the stub, so the page's own fetch is watched: one SKIP, with keepalive.
      const b = await open(w, h);
      await b.ctx.addInitScript(() => {
        const f = window.fetch;
        window.fetch = function (i: RequestInfo | URL, init?: RequestInit) {
          if (String(init?.body).includes('SKIP')) sessionStorage.setItem('skips', String(Number(sessionStorage.getItem('skips') ?? 0) + 1) + (init?.keepalive ? 'k' : ''));
          return f.call(window, i, init);
        } as typeof fetch;
      });
      await b.page.goto(`${ORIGIN}/surveys/s1`);
      await b.page.getByText('Question 1 of 3').waitFor();
      await b.page.goto(`${ORIGIN}/sign-in`);
      await b.page.waitForTimeout(500);
      assert.equal(await b.page.evaluate(() => sessionStorage.getItem('skips')), '1k');
      await b.ctx.close();
    });
  }
  await t('Round 2 admin at 1440: running, review (one hidden), release confirm, released', async () => {
    const run = await open(1440, 900, { roles: ['ADMIN'], report: { survey: { id: 's1', brandName: 'Zobo Fresh', title: 'Power and light', status: 'APPROVED', startsOn: '2026-11-20', endsOn: '2026-11-30', responseTarget: 200 }, stage: 'RUNNING', ready: false, released: false, answeredSoFar: 146, note: '' } });
    await run.page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await run.page.getByTestId('answered-so-far').waitFor();
    assert.equal(await run.page.getByTestId('answered-so-far').innerText(), '146 people have answered so far');
    await shot(run.page, 'AdminResultsRunning', 1440);
    await run.ctx.close();
    const rv = await open(1440, 900, { roles: ['ADMIN'], report: { survey: { id: 's1', brandName: 'Zobo Fresh', title: 'Power and light', status: 'APPROVED', startsOn: '2026-11-20', endsOn: '2026-11-30', responseTarget: 200 }, stage: 'REVIEW', ready: true, released: false, answeredSoFar: 200, note: '' } });
    await rv.page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await rv.page.getByText('Please deliver to Ikorodu too.').waitFor();
    await rv.page.getByRole('button', { name: /^Hide: Please deliver/ }).click();
    await rv.page.getByText('1 of 3 hidden').waitFor();
    assert.deepEqual(find(rv.calls, 'PATCH', '/admin/surveys/s1/free-answers/f2').map((c) => c.body), [{ hidden: true }]);
    await shot(rv.page, 'AdminResultsReview', 1440);
    await rv.page.getByRole('button', { name: 'Release the results' }).click();
    await rv.page.getByRole('dialog').waitFor();
    assert.equal(find(rv.calls, 'POST', '/admin/surveys/s1/release').length, 0);
    await shot(rv.page, 'AdminReleaseConfirm', 1440);
    await rv.ctx.close();
    const rl = await open(1440, 900, { roles: ['ADMIN'] });
    await rl.page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await rl.page.getByTestId('released-at').waitFor();
    await shot(rl.page, 'AdminResultsReleased', 1440);
    await rl.ctx.close();
  });
  await t('Round 2 admin at 1440: adverts form brand select; Settings switch', async () => {
    const { page, calls, ctx } = await open(1440, 900, { roles: ['AD_MANAGER'] });
    await page.goto(`${ORIGIN}/admin/ads`);
    await page.getByRole('button', { name: 'Edit advert' }).click();
    const sel = page.getByLabel('Brand page (optional)');
    await sel.waitFor();
    await page.getByRole('option', { name: 'Zobo Fresh' }).waitFor({ state: 'attached' });
    await sel.selectOption({ label: 'Zobo Fresh' });
    await sel.scrollIntoViewIfNeeded();
    await shot(page, 'AdminAdsBrandSelect', 1440);
    await ctx.close();
    const s = await open(1440, 900);
    await s.page.goto(`${ORIGIN}/settings`);
    const sw = s.page.getByRole('switch', { name: /Use my state to choose surveys for me/ });
    await sw.waitFor();
    await sw.scrollIntoViewIfNeeded();
    await sw.click();
    await s.page.waitForTimeout(400);
    assert.deepEqual(find(s.calls, 'PATCH', '/me/settings').map((c) => c.body), [{ useMyStateForSurveys: true }]);
    await shot(s.page, 'SettingsSurveySwitch', 1440);
    await s.ctx.close();
  });

  // ---- admin, desktop only
  await t('Admin Sponsored Surveys at 1440: list, review, refusal words as given, new survey form', async () => {
    const { page, ctx } = await open(1440, 900, { roles: ['AD_MANAGER'] });
    await page.goto(`${ORIGIN}/admin/surveys`);
    await page.getByRole('heading', { name: 'Sponsored Surveys' }).waitFor();
    await page.getByRole('button', { name: 'Approve' }).waitFor();
    await shot(page, 'AdminSurveys', 1440);
    await page.getByRole('button', { name: 'Approve' }).click();
    await page.getByText('A price is needed before this can run.').waitFor();
    await shot(page, 'AdminSurveysRefused', 1440);
    await page.getByRole('button', { name: 'New survey' }).click();
    await page.getByLabel('Brand name').waitFor();
    await page.getByRole('button', { name: 'Add a question' }).click();
    await shot(page, 'AdminSurveyForm', 1440);
    const nav = await page.getByRole('navigation', { name: 'Admin pages' }).innerText();
    assert.ok(nav.indexOf('Adverts') < nav.indexOf('Sponsored Surveys') && nav.indexOf('Sponsored Surveys') < nav.indexOf('Brand pages'), nav);
    await ctx.close();
  });
  await t('Admin results at 1440: totals, shares, hidden option, CSV saves; below the minimum', async () => {
    const { page, ctx } = await open(1440, 900, { roles: ['ADMIN'] });
    await page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await page.getByText('Cold drinks').waitFor();
    await shot(page, 'AdminResults', 1440);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save as CSV' }).click()]);
    assert.match(dl.suggestedFilename(), /^survey-results-zobo-fresh-power-and-light\.csv$/);
    const path = await dl.path();
    const { readFileSync } = await import('node:fs');
    const csv = readFileSync(path!, 'utf8');
    assert.ok(csv.includes('Choice,How do you keep cool when there is no light?,Cold drinks,67,46,'), csv);
    assert.ok(!/s1|[0-9a-f]{8}-[0-9a-f]{4}/.test(csv), 'an id is in the CSV');
    await ctx.close();
    const lo = await open(1440, 900, { roles: ['ADMIN'], report: report({ belowMinimum: true, totals: { views: 31, starts: 9, skips: 4, responses: null, completionRate: null }, questions: [], byState: [], byAgeBand: [], note: 'Fewer than 20 people have answered, so nothing about them is shown yet.' }) });
    await lo.page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await lo.page.getByTestId('below-minimum').waitFor();
    await shot(lo.page, 'AdminResultsBelowMinimum', 1440);
    await lo.ctx.close();
  });
  await t('Admin Brand pages at 1440', async () => {
    const { page, ctx } = await open(1440, 900, { roles: ['AD_MANAGER'] });
    await page.goto(`${ORIGIN}/admin/brands`);
    await page.getByRole('heading', { name: 'Brand pages' }).waitFor();
    await page.getByRole('button', { name: 'Edit Zobo Fresh' }).click();
    await page.getByLabel('Choose a logo').waitFor({ state: 'attached' });
    await shot(page, 'AdminBrands', 1440);
    await ctx.close();
  });
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL OK');
process.exit(failed ? 1 : 0);
