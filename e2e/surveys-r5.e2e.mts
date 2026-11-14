// V-SURVEYS round 5 proof: H1 with two tabs (request log with Authorization subject and body), M2 and M3 for each failure kind,
// the admin survey and brand pages on a phone, and the Home record flow once. Every API call and the sign-in host are stubbed (context.route).
//   npx next build && npx next start -p 3981 &     then     npx tsx e2e/surveys-r5.e2e.mts
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
type Page = any; // eslint-disable-line

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3981';
const KEY = 'voices-web-session';
const tok = (sub: string, n: string) => `h.${Buffer.from(JSON.stringify({ sub, n })).toString('base64url')}.s`;
const claims = (auth?: string | null) => { try { const c = JSON.parse(Buffer.from((auth ?? '').replace('Bearer ', '').split('.')[1], 'base64url').toString()); return `${c.sub}:${c.n}`; } catch { return 'none'; } };
const A_OLD = tok('userA', 'old'), A_NEW = tok('userA', 'new'), B1 = tok('userB', '1');
const survey = {
  id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 'Power and light', questionCount: 3, note: 'x', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24'],
  questions: [
    { id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How many hours of light did you get yesterday?', options: [{ id: 'h1', label: '1 to 6 hours' }, { id: 'h2', label: '7 to 12 hours' }] },
    { id: 'q2', position: 2, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool when there is no light?', options: [{ id: 'o1', label: 'A fan on battery' }, { id: 'o2', label: 'Cold drinks' }] },
    { id: 'q3', position: 3, kind: 'SINGLE_CHOICE', prompt: 'Fridge or no fridge?', options: [{ id: 'f1', label: 'Fridge' }, { id: 'f2', label: 'No fridge' }] },
  ],
};
const me = (sub: string) => ({ phoneMasked: '+234 803 *** 4412', id: sub, wawuId: 'w', handle: sub + '.h', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: ['ADMIN', 'AD_MANAGER'], profile: { id: sub, handle: sub + '.h', displayName: sub, bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Lagos', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: { freePostsRemaining: 5, balanceMilli: 0, maxVoiceSeconds: 60, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs: {}, extraVoiceTokens: [] }, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'light', timezone: 'Africa/Lagos', notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480, shareMyWord: false, useMyStateForSurveys: false } });
const adminSurvey = { id: 's1', brandId: 'b1', brandName: 'Zobo Fresh', contactEmail: 'hello@zobo.example', title: 'Power and light', status: 'AWAITING_APPROVAL', label: 'Sponsored Survey', live: false, checks: [{ text: 'Dates are set', ok: true }, { text: 'Price is set', ok: false }], questions: survey.questions, categoryIds: [], states: [], startsOn: '2026-11-20', endsOn: '2026-11-30', frequencyCapPerDay: 1, priceKobo: null, responseTarget: 100, views: 0, starts: 0, completes: 0, skips: 0, responses: 0, rejectReason: null, changeRequest: null, submittedAt: null, approvedAt: null };
const head = { id: 's1', brandName: 'Zobo Fresh', title: 'Power and light', status: 'APPROVED', startsOn: '2026-11-20', endsOn: '2026-11-30', responseTarget: 100 };
const report = { survey: head, stage: 'RELEASED', ready: true, released: true, releasedAt: '2026-12-02T09:00:00Z', minGroupSize: 20, belowMinimum: false, totals: { views: 500, starts: 120, skips: 30, responses: 60, completionRate: 50 }, questions: [{ id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool?', answered: 60, options: [{ id: 'o1', label: 'Cold drinks', count: 40, share: 67, hidden: false }, { id: 'o2', label: 'A fan', count: 20, share: 33, hidden: false }], other: null, texts: [], voices: [] }], byState: [{ state: 'Lagos', responses: 30, share: 50 }], byStateOther: null, note: 'n' };

interface Mode { post: (n: number) => { status: number; body?: unknown; delay?: number; abort?: boolean; hang?: boolean } }
const log: { who: string; call: string; body: unknown }[] = [];
let mode: Mode = { post: () => ({ status: 201, body: { ok: true, note: '' } }) };
let posts = 0;
let refreshBodies: string[] = [];

async function setup(ctx: any) {
  await ctx.route('**/*', async (route: any) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN) || u.startsWith('data:')) return route.fallback();
    return route.fulfill({ status: 200, body: '' }); // the sign-in host and any other outside host
  });
  await ctx.route('**/auth/refresh', async (route: any) => {
    const b = JSON.parse(route.request().postData() ?? '{}');
    log.push({ who: 'refresh', call: 'POST /auth/refresh', body: b });
    refreshBodies.push(b.refreshToken);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: A_NEW, refreshToken: 'rA-new' } }) });
  });
  await ctx.route('**/api/v1/**', async (route: any) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace('/api/v1', '');
    const who = claims(req.headers()['authorization']);
    const json = (status: number, b?: unknown) => route.fulfill({ status, contentType: 'application/json', body: b === undefined ? '' : JSON.stringify(b) });
    if (req.method() !== 'GET') log.push({ who, call: `${req.method()} ${p}`, body: req.postData() ? JSON.parse(req.postData()) : null });
    if (p === '/me') return json(200, me(who.split(':')[0]));
    if (p === '/surveys/s1' && req.method() === 'GET') return json(200, survey);
    if (p === '/surveys/s1/events') return json(204);
    if (p === '/surveys/s1/responses') {
      if (req.headers()['authorization'] === `Bearer ${A_OLD}`) { await new Promise((r) => setTimeout(r, 1500)); return json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }); }
      posts += 1;
      const m = mode.post(posts);
      if (m.abort) return route.abort('failed');
      if (m.hang) return new Promise(() => undefined);
      return json(m.status, m.body);
    }
    if (p === '/surveys/placement') return json(200, { survey: null });
    if (p === '/admin/surveys') return json(200, { items: [adminSurvey, { ...adminSurvey, id: 's2', status: 'LIVE', live: true }], nextCursor: null, awaitingApproval: 1 });
    if (p === '/admin/surveys/s1') return json(200, adminSurvey);
    if (p === '/admin/surveys/s1/report') return json(200, report);
    if (p === '/admin/brands') return json(200, { items: [{ id: 'b1', name: 'Zobo Fresh', slug: 'zobo-fresh', tagline: 'Cold zobo.', website: 'https://zobo.example', contactEmail: 'hello@zobo.example', active: true, logoUrl: null, label: 'Brand' }] });
    if (p === '/admin/today') return json(200, { needsAttention: {} });
    if (p === '/categories') return json(200, { items: [] });
    return json(404, { error: { code: 'NOT_FOUND', message: 'none' } });
  });
}
const setSession = (page: Page, a: string, r: string) => page.evaluate(([k, x, y]: string[]) => localStorage.setItem(k, JSON.stringify({ accessToken: x, refreshToken: y })), [KEY, a, r]);
const stored = (page: Page) => page.evaluate((k: string) => JSON.parse(localStorage.getItem(k) ?? '{}'), KEY);
const out: Record<string, unknown> = {};
const fail = (m: string) => { console.log('FAIL:', m); process.exitCode = 1; };
const check = (cond: boolean, m: string) => { console.log(cond ? 'ok  ' : 'FAIL', m); if (!cond) process.exitCode = 1; };

async function toLastAndAnswer(page: Page) {
  await page.goto(ORIGIN + '/surveys/s1');
  await page.getByText('Question 1 of 3').waitFor({ timeout: 10000 });
  await page.getByRole('radio', { name: '7 to 12 hours' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByRole('radio', { name: 'Cold drinks' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByRole('radio', { name: 'Fridge', exact: true }).click();
}

const browser = await chromium.launch();
for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const tag = `${vp.width}x${vp.height}`;
  console.log('=== H1', tag);
  // H1: A's token has run out; 401 after a wait; B signs in in tab 2 meanwhile.
  log.length = 0; posts = 0; refreshBodies = [];
  let ctx = await browser.newContext({ viewport: vp });
  await setup(ctx);
  let t1 = await ctx.newPage();
  await t1.goto(ORIGIN + '/faq'); await setSession(t1, A_OLD, 'rA-old');
  await toLastAndAnswer(t1);
  const t2 = await ctx.newPage(); await t2.goto(ORIGIN + '/faq');
  await t1.bringToFront();
  await t1.getByRole('button', { name: 'Send answer' }).click();
  await new Promise((r) => setTimeout(r, 400));
  await setSession(t2, B1, 'rB-1'); // B signs in during the 401 wait
  await new Promise((r) => setTimeout(r, 2500));
  const body = await t1.locator('body').innerText();
  console.log(JSON.stringify(log.filter((l) => l.call.includes('responses') || l.call.includes('refresh')), null, 0));
  check(body.includes('You are signed in as someone else in another tab'), `${tag} A's tab shows the stale notice`);
  check(!log.some((l) => l.call.includes('responses') && l.who.startsWith('userB')), `${tag} no survey request carried B's token`);
  check(!log.some((l) => l.call === 'POST /auth/refresh'), `${tag} B's refresh token was never used`);
  check(log.filter((l) => l.call.includes('responses')).length === 1, `${tag} only A's first try went out`);
  const s = await stored(t1);
  check(s.accessToken === B1 && s.refreshToken === 'rB-1', `${tag} B's sign-in is intact`);
  await ctx.close();

  // Plain: A alone refreshes; the send goes through once, as A.
  log.length = 0; posts = 0; refreshBodies = [];
  ctx = await browser.newContext({ viewport: vp }); await setup(ctx);
  t1 = await ctx.newPage(); await t1.goto(ORIGIN + '/faq'); await setSession(t1, A_OLD, 'rA-old');
  await toLastAndAnswer(t1);
  await t1.getByRole('button', { name: 'Send answer' }).click();
  await t1.getByText('Thanks. Your answers are in.').waitFor({ timeout: 8000 });
  console.log(JSON.stringify(log.filter((l) => l.call.includes('responses') || l.call.includes('refresh'))));
  check(refreshBodies.length === 1 && refreshBodies[0] === 'rA-old', `${tag} A alone: one refresh with A's token`);
  check(log.filter((l) => l.call.includes('responses')).map((l) => l.who).join() === 'userA:old,userA:new', `${tag} A alone: first try 401, retry as A, one success`);
  await ctx.close();

  // M2 and M3: each failure kind.
  const kinds: [string, Mode['post'], RegExp, RegExp[]][] = [
    ['offline', () => ({ status: 0, abort: true }), /You look offline/, [/not sent/i, /recording/i]],
    ['no answer (timeout)', () => ({ status: 0, hang: true }), /We could not confirm your answers were received\. Tap Send again/, [/not sent/i, /recording/i]],
    ['server fault', () => ({ status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } }), /Something went wrong on our side/, [/not sent/i, /recording/i, /boom/]],
    ['refused', () => ({ status: 422, body: { error: { code: 'INVALID', message: 'Pick one of the choices.' } } }), /Pick one of the choices\./, [/recording/i]],
  ];
  for (const [name, post, want, never] of kinds) {
    log.length = 0; posts = 0; mode = { post };
    ctx = await browser.newContext({ viewport: vp }); await setup(ctx);
    const p = await ctx.newPage(); await p.goto(ORIGIN + '/faq'); await setSession(p, A_NEW, 'rA-new');
    await toLastAndAnswer(p);
    await p.getByRole('button', { name: 'Send answer' }).click();
    const box = p.getByTestId('survey-problem');
    await box.waitFor({ timeout: name.startsWith('no answer') ? 15000 : 8000 });
    await new Promise((r) => setTimeout(r, 900)); // the scroll
    const text = await box.innerText();
    const r = await box.boundingBox(); const sb = await p.getByRole('button', { name: 'Send answer' }).boundingBox();
    const tab = await p.evaluate(() => { const n = document.querySelector('nav[aria-label], [data-testid="tabbar"]'); return n ? n.getBoundingClientRect().top : null; });
    const inView = !!r && r.y >= 0 && r.y + r.height <= vp.height && (tab === null || tab <= 0 || r.y + r.height <= tab + 1);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    check(want.test(text) && never.every((n) => !n.test(text)), `${tag} ${name}: words "${text.replace(/\s+/g, ' ').slice(0, 130)}"`);
    check(inView, `${tag} ${name}: line in view (y=${r?.y}, h=${r?.height}, send y=${sb?.y}, tab top=${tab})`);
    check(await box.locator('[role=alert]').count() === 1, `${tag} ${name}: announced (role alert)`);
    check(sw <= vp.width, `${tag} ${name}: no sideways scroll (${sw})`);
    check(!/[–—]/.test(text), `${tag} ${name}: no dash`);
    if (name === 'refused' || name === 'server fault') await p.screenshot({ path: `/tmp/claude-0/r5-fail-${name.split(' ')[0]}-${vp.width}.png` });
    await ctx.close();
  }
  mode = { post: () => ({ status: 201, body: { ok: true, note: '' } }) };

  // Admin survey and brand pages inside the phone frame.
  if (vp.width === 390) {
    ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true }); await setup(ctx);
    const p = await ctx.newPage(); await p.goto(ORIGIN + '/faq'); await setSession(p, tok('admin', '1'), 'r');
    for (const path of ['/admin/surveys', '/admin/surveys/s1/results', '/admin/brands']) {
      await p.goto(ORIGIN + path); await p.waitForTimeout(1800);
      const m = await p.evaluate(() => {
        const small = [...document.querySelectorAll('button, a, select, input, textarea, [role=button]')].filter((e) => { const r = (e as HTMLElement).getBoundingClientRect(); const cs = getComputedStyle(e as HTMLElement); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.height < 44; }).map((e) => `${e.tagName}:${(e.textContent ?? '').trim().slice(0, 24) || e.getAttribute('aria-label')}:${Math.round((e as HTMLElement).getBoundingClientRect().height)}`);
        return { sw: document.documentElement.scrollWidth, small, phone: !!document.querySelector('[data-testid=phone-page-name]'), text: document.body.innerText.slice(0, 60).replace(/\n/g, ' | ') };
      });
      check(m.sw <= 390 && m.phone, `${path} phone frame, scrollWidth ${m.sw}`);
      if (m.sw > 390) console.log('WIDE', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible').slice(0, 6).map((e) => e.tagName + '.' + String((e as HTMLElement).className).slice(0, 60) + ' sw=' + e.scrollWidth + ' cw=' + e.clientWidth))));
      if (m.sw > 390) console.log('OFFENDERS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => !e.closest('table') && e.getBoundingClientRect().right > 390.5).slice(0, 8).map((e) => e.tagName + '.' + String((e as HTMLElement).className).slice(0, 80) + ' r=' + Math.round(e.getBoundingClientRect().right)))));
      console.log(path, 'under 44px:', JSON.stringify(m.small));
      await p.screenshot({ path: `/tmp/claude-0/r5-admin${path.replace(/\//g, '-')}.png` });
      if (path === '/admin/surveys') {
        await p.getByRole('button', { name: /New survey/ }).first().click(); await p.waitForTimeout(800);
        const f = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, small: [...document.querySelectorAll('button, a, select, input, textarea')].filter((e) => { const r = (e as HTMLElement).getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44 && e.getAttribute('type') !== 'checkbox' && e.getAttribute('type') !== 'radio'; }).map((e) => `${e.tagName}:${(e.textContent ?? '').trim().slice(0, 20) || e.getAttribute('aria-label') || e.id}:${Math.round((e as HTMLElement).getBoundingClientRect().height)}`) }));
        check(f.sw <= 390, `/admin/surveys new-survey form scrollWidth ${f.sw}`); console.log('form under 44px:', JSON.stringify(f.small));
        await p.screenshot({ path: '/tmp/claude-0/r5-admin-new-survey.png' });
      }
    }
    await ctx.close();
  }
}
await browser.close();
void out; void fail;
