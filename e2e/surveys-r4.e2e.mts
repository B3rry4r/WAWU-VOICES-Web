// V-SURVEYS round 4 proof: two tabs in one browser context, the API stubbed with context.route (no live service).
//   npx next build && npx next start -p 3979 &     then     npx tsx e2e/surveys-r4.e2e.mts
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
type BrowserContext = any; type Page = any; // eslint-disable-line
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3979';
const SHOTS = process.env.SHOTS ?? 'docs/lead/surveys/shots-r4';
const jwt = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s`;
const subOf = (auth?: string) => { try { return JSON.parse(Buffer.from((auth ?? '').replace('Bearer ', '').split('.')[1], 'base64url').toString()).sub as string; } catch { return 'nobody'; } };
const survey = {
  id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 'Power and light', questionCount: 3, note: 'x', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24'],
  questions: [
    { id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How many hours of light did you get yesterday?', options: [{ id: 'h1', label: '1 to 6 hours' }, { id: 'h2', label: '7 to 12 hours' }] },
    { id: 'q2', position: 2, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool when there is no light?', options: [{ id: 'o1', label: 'A fan on battery' }, { id: 'o2', label: 'Cold drinks' }] },
    { id: 'q3', position: 3, kind: 'SINGLE_CHOICE', prompt: 'Fridge or no fridge?', options: [{ id: 'f1', label: 'Fridge' }, { id: 'f2', label: 'No fridge' }] },
  ],
};
const log: { user: string; method: string; path: string; body: unknown }[] = [];
const me = (sub: string) => ({ phoneMasked: '+234 803 *** 4412', id: sub, wawuId: 'w', handle: sub + '.h', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { id: sub, handle: sub + '.h', displayName: sub, bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Lagos', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs: {}, extraVoiceTokens: [] }, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'light', timezone: 'Africa/Lagos', notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480, shareMyWord: false, useMyStateForSurveys: false } });

async function setup(ctx: BrowserContext) {
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace('/api/v1', '');
    const user = subOf(req.headers()['authorization']);
    const json = (status: number, b?: unknown) => route.fulfill({ status, contentType: 'application/json', body: b === undefined ? '' : JSON.stringify(b) });
    if (req.method() !== 'GET') log.push({ user, method: req.method(), path: p, body: req.postData() ? JSON.parse(req.postData() as string) : null });
    if (p === '/me') return json(200, me(user));
    if (p === '/surveys/s1' && req.method() === 'GET') return json(200, survey);
    if (p === '/surveys/s1/events') return json(204);
    if (p === '/surveys/s1/responses') return json(201, { ok: true, note: '' });
    if (p === '/surveys/placement') return json(200, { survey: null });
    return json(404, { error: { code: 'NOT_FOUND', message: 'none' } });
  });
}
const KEY = 'voices-web-session';
const signIn = (page: Page, sub: string) => page.evaluate(([k, t]) => localStorage.setItem(k, JSON.stringify({ accessToken: t, refreshToken: 'r' })), [KEY, jwt(sub)]);
const signOut = (page: Page) => page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ accessToken: null, refreshToken: null })), KEY);
const sess = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).filter((k) => k.startsWith('wawu.survey.')).map((k) => [k, sessionStorage.getItem(k)])));
const NOTICE = 'You are signed in as someone else in another tab. Reload to carry on.';
const out: Record<string, unknown> = {};

const browser = await chromium.launch();
for (const blockEvents of [false, true]) {
  const label = blockEvents ? 'events-lost' : 'events-delivered';
  log.length = 0;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setup(ctx);
  if (blockEvents) await ctx.addInitScript(() => { for (const t of ['storage', 'focus', 'pageshow']) window.addEventListener(t, (e) => e.stopImmediatePropagation()); document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation()); });
  const t1 = await ctx.newPage();
  await t1.goto(ORIGIN + '/faq'); // any page on the origin, to reach its storage
  await signIn(t1, 'userA');
  await t1.goto(ORIGIN + '/surveys/s1');
  console.log(label, 'start');
  await t1.getByText('Question 1 of 3').waitFor({ timeout: 8000 }).catch(async () => { await t1.screenshot({ path: '/tmp/claude-0/dbg.png' }); console.log(await t1.locator('body').innerText()); throw new Error('survey did not load'); });
  await t1.getByRole('radio', { name: '7 to 12 hours' }).click();
  await t1.getByRole('button', { name: 'Send answer' }).click();
  await t1.getByText('Question 2 of 3').waitFor();
  await t1.getByRole('radio', { name: 'Cold drinks' }).click();
  await t1.getByRole('button', { name: 'Send answer' }).click();
  await t1.getByText('Question 3 of 3').waitFor();
  await t1.getByRole('radio', { name: 'Fridge', exact: true }).click(); // chosen, not sent
  const sentByA = log.length; // START only
  // tab 2: sign out, sign in as B
  const t2 = await ctx.newPage();
  await t2.goto(ORIGIN + '/faq');
  await signOut(t2);
  await signIn(t2, 'userB');
  await t2.waitForTimeout(300);
  const before = log.length;
  if (!blockEvents) await t1.getByText(NOTICE).waitFor({ timeout: 4000 }); // the storage event alone did it, tab 1 was never touched
  let notice = await t1.getByText(NOTICE).isVisible();
  await t1.bringToFront();
  await t1.waitForTimeout(300);
  notice = await t1.getByText(NOTICE).isVisible();
  if (!notice) { // events never reached the tab: the press itself finds out
    await t1.getByRole('button', { name: 'Send answer' }).click();
    await t1.getByText(NOTICE).waitFor();
  }
  await t1.screenshot({ path: `${SHOTS}/stale-notice-${label}-390.png` });
  const sentAsB = log.slice(before).filter((l) => l.user === 'userB');
  assert.equal(log.slice(before).length, 0, 'no request at all after B signed in, from tab 1');
  assert.equal(sentAsB.length, 0);
  assert.ok(await t1.getByRole('button', { name: 'Reload' }).isVisible());
  // reload shows B's own empty survey
  await t1.getByRole('button', { name: 'Reload' }).click();
  await t1.getByText('Question 1 of 3').waitFor();
  assert.equal(await t1.getByRole('radio', { name: '7 to 12 hours' }).getAttribute('aria-checked'), 'false');
  await t1.screenshot({ path: `${SHOTS}/after-reload-B-${label}-390.png` });
  const afterReload = log.slice(before).map((l) => `${l.user}:${l.path.split('/').pop()}:${(l.body as { kind?: string } | null)?.kind ?? ''}`);
  // B fills a draft, signs out, A signs in: A sees A's draft
  await t1.getByRole('radio', { name: '1 to 6 hours' }).click();
  await t1.getByRole('button', { name: 'Send answer' }).click();
  await t1.getByText('Question 2 of 3').waitFor();
  await signOut(t2);
  await signIn(t2, 'userA');
  await t1.reload();
  await t1.getByText('Question 3 of 3').waitFor(); // A's own position
  const bSelected = await t1.getByRole('radio', { name: 'Fridge', exact: true }).getAttribute('aria-checked');
  const all = await sess(t1) as Record<string, string>;
  const keys = Object.keys(all).sort();
  const given = (k: string) => Object.entries(JSON.parse(all[k]).given as Record<string, { optionId: string }>).map(([q, g]) => `${q}=${g.optionId}`).join(',');
  assert.equal(given('wawu.survey.userA.s1.draft'), 'q1=h2,q2=o2');
  assert.equal(given('wawu.survey.userB.s1.draft'), 'q1=h1');
  await t1.screenshot({ path: `${SHOTS}/A-sees-A-draft-${label}-390.png` });
  const responses = log.filter((l) => l.path.endsWith('/responses'));
  out[label] = { requestsFromTab1AfterBSignedIn: log.slice(before).length - afterReload.length, afterReload, A_draft_position: 'Question 3 of 3', fridgeChecked: bSelected, keys, responsesSent: responses.length, eventsAll: log.filter((l) => l.path.endsWith('/events')).map((l) => `${l.user}:${(l.body as { kind: string }).kind}`), sentByAbeforeSwitch: sentByA };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
