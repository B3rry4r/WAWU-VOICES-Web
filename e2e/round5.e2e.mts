// V-PRELAUNCH round 5 proof against the built app.
//   VOICES_API_BASE=http://127.0.0.1:4010/api/v1 npx next start -p 3981 &
//   PART=post409|step|two|regress SHOTS=docs/lead/prelaunch/shots-r6/ npx tsx e2e/round5.e2e.mts
// The API is stubbed from contract/openapi.yaml shapes (browser calls by route, the server's share draw by a small node server). Nothing live is called.
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3981';
const SHOTS = process.env.SHOTS ?? 'docs/lead/prelaunch/shots-r6/';
mkdirSync(SHOTS, { recursive: true });
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const PART = process.env.PART ?? 'post409';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let opensAt = Infinity;
const me = { id: 'u1', handle: 'ada.o', displayName: 'Ada O', state: 'Lagos', avatarUrl: null };
const q = (over: object = {}) => ({ id: 'q9', kind: 'DAILY', status: 'SCHEDULED', startsAt: new Date(opensAt).toISOString(), endsAt: '2026-11-22T23:00:00.000Z', text: 'How do you feel about Nigeria right now?', hint: 'With everything going on, say it in your voice.', moodOptions: PART === 'post409' ? [] : ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: 't1', topicTitle: 'Are You Really Fine? You Dey Okay?', voiceCount: 0, voicesCount: 0, answerCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, ...over });
const topic = (over: object = {}) => ({ questionCount: 10, id: 't1', weekNumber: 1, title: 'Are You Really Fine? You Dey Okay?', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'SCHEDULED', sensitive: false, voiceCount: 0, voicesCount: 0, weeklyPollId: 'p1', reportId: null, whatNextPrompt: null, ...over });
const answer = { id: 'a1', questionId: 'q9', author: me, kind: 'TEXT', body: 'Hopeful, but tired of waiting.', clip: null, createdAt: '2026-11-14T23:02:00Z', editedAt: null, status: 'PUBLISHED', news: null, likeCount: 3, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], mood: null, questionText: 'x' };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 60, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 60, costs, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const meBody = { phoneMasked: '+234 803 *** 4412', id: 'u1', wawuId: 'w', handle: 'ada.o', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { ...me, bio: null, voiceCard: null, countryCode: 'NG', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } };
const isOpen = () => Date.now() >= opensAt;
const sharePage = (live: boolean) => ({ code: 'c1', objectType: 'QUESTION', topicLine: 'How do you feel about Nigeria right now?', countryAndTheme: 'Nigeria', arguments: [], leanLine: null, poll: null, proposalCount: null, topProposal: null, news: null, basedOnVoices: 0, summaryUpdatedAt: '2026-11-14T05:00:00Z', summaryLabel: 'x', featuredVoice: null, transcript: null, question: q(live ? { status: 'LIVE' } : {}), report: null, cardFallback: false, ctaLabel: 'Add your voice', openGraph: { title: 'How do you feel about Nigeria right now?', description: 'Opens soon', imageUrl: 'http://127.0.0.1:4010/c.png', url: 'http://127.0.0.1:3981/s/c1' } });
const server = createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  if ((req.url ?? '').split('?')[0] === '/api/v1/share/c1') { res.statusCode = 200; res.end(JSON.stringify(sharePage(isOpen()))); return; }
  res.statusCode = 404; res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }));
});
await new Promise<void>((r) => server.listen(4010, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const COMING = /Opens \w+ \d+ \w+/;
const text = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const shot = async (page: Page, name: string) => { await page.waitForTimeout(300); await page.screenshot({ path: `${SHOTS}${name}.png` }); };

type Opt = { skew?: number; hdr?: number | null; signedIn?: boolean; w: number; post?: (kind: string, key: string) => { status: number; body: unknown } | null; posts?: { kind: string; key: string; at: number }[] };
async function open(o: Opt): Promise<{ page: Page; ctx: BrowserContext; calls: number[] }> {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.w < 600 ? 844 : 900 }, deviceScaleFactor: 2, permissions: ['microphone'] });
  const calls: number[] = [];
  if (o.skew !== undefined) await ctx.clock.install({ time: new Date(Date.now() + o.skew) });
  if (o.signedIn) await ctx.addInitScript(() => { try { localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 'a.b.c', refreshToken: 'r' })); } catch { /* */ } });
  await ctx.route('https://up.test/**', (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace('/api/v1', '');
    calls.push(Date.now());
    const live = isOpen();
    const question = q(live ? { status: 'LIVE' } : {});
    const headers: Record<string, string> = {};
    if (o.hdr !== null) headers.date = new Date(Date.now() + (o.hdr ?? 0)).toUTCString();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(b) });
    const key = req.headers()['idempotency-key'] ?? '';
    if (req.method() === 'POST' && o.post) {
      const kind = /\/questions\/q9\/answers$/.test(p) ? 'answer' : /\/answers\/a1\/replies$/.test(p) ? 'reply' : '';
      if (kind) { o.posts?.push({ kind, key, at: Date.now() }); const r = o.post(kind, key); if (r) return ok(r.body, r.status); }
    }
    if (p === '/share/c1') return ok(sharePage(live));
    if (p === '/home') return ok({ topicOfWeek: topic(live ? { status: 'SCHEDULED' } : {}), dailyQuestion: question, flashPoll: null, trending: live ? [answer] : [], newConversations: [], sponsored: null, greetingName: null });
    if (p === '/questions/today' || p === '/questions/q9') return ok(question);
    if (p === '/questions/q9/answers') return ok({ items: live ? [{ type: 'answer', answer }] : [], nextCursor: null });
    if (p === '/questions/q9/polls') return ok({ items: [] });
    if (p === '/questions/q9/moods') return ok({ total: 0, items: [] });
    if (p === '/topics/current') return ok(topic(live ? { status: 'SCHEDULED' } : {}));
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return o.signedIn ? ok(allowance) : ok({ error: { code: 'UNAUTHENTICATED', message: 'no' } }, 401);
    if (p === '/me') return o.signedIn ? ok(meBody) : ok({ error: { code: 'UNAUTHENTICATED', message: 'no' } }, 401);
    if (p === '/answers/a1') return ok(answer);
    if (p === '/answers/a1/replies') return ok({ items: [], nextCursor: null });
    if (p === '/voice-clips' && req.method() === 'POST') { const id = `c${calls.length}`; return ok({ clip: { id, status: 'UPLOADING', durationMs: null, maxDurationMs: 60000, peaks: null, transcript: null }, putUrl: 'https://up.test/put', putHeaders: {}, expiresAt: '2026-12-01T00:00:00Z' }, 201); }
    if (/^\/voice-clips\/[^/]+\/complete$/.test(p) || (/^\/voice-clips\/[^/]+$/.test(p) && req.method() === 'GET')) return ok({ id: p.split('/')[2], status: 'READY', durationMs: 2000, maxDurationMs: 60000, peaks: [], transcript: null });
    if (p === '/weekly-reports/latest' || p.startsWith('/polls/current')) return ok(null);
    if (p.startsWith('/share/c1/events')) return ok({}, 202);
    return ok({ items: [], nextCursor: null });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('     console.error: ' + m.text().slice(0, 200)); });
  return { page, ctx, calls };
}
const inView = async (page: Page, loc: ReturnType<Page['getByText']>) => {
  const b = await loc.boundingBox(); const vp = page.viewportSize()!;
  return !!b && b.y >= 0 && b.y + b.height <= vp.height && b.x >= 0 && b.x + b.width <= vp.width;
};

// ---------- MEDIUM-1: the server answers 409 CONFLICT three times, then 201 ----------
if (PART === 'post409') {
  opensAt = Date.now() - 3_600_000;
  const receipt = (kind: string) => kind === 'answer'
    ? { answer: { ...answer, id: 'a9', isMine: true }, charge: { costMilli: 0, usedFreePost: true, balanceMilli: 0 }, allowances: allowance }
    : { reply: { id: 'r9', answerId: 'a1', author: me, stance: 'AGREE', kind: 'TEXT', body: 'x', clip: null, createdAt: '2026-11-14T23:02:00Z' }, charge: { costMilli: 0, usedFreePost: true, balanceMilli: 0 }, allowances: allowance };
  type Flow = { name: string; path: string; word: string; run: (page: Page, n: number) => Promise<void>; kind: 'answer' | 'reply' };
  const startRec = async (page: Page) => { await page.getByRole('button', { name: 'Start recording' }).click(); await sleep(2200); await page.getByRole('button', { name: 'Stop recording' }).click(); await page.getByRole('button', { name: /^Send/ }).first().waitFor(); };
  const flows: Flow[] = [
    { name: 'text-answer', path: '/q/q9/write', word: 'Post', kind: 'answer', run: async (page, n) => { if (n === 0) await page.getByRole('textbox').fill('Same words every time'); await page.getByRole('button', { name: /^Post/ }).click(); } },
    { name: 'voice-answer', path: '/q/q9/speak', word: 'Send', kind: 'answer', run: async (page, n) => { if (n === 0) await startRec(page); await page.getByRole('button', { name: /^Send/ }).first().click(); } },
    { name: 'text-reply', path: '/q/q9/write?reply=a1', word: 'Post', kind: 'reply', run: async (page, n) => { if (n === 0) { await page.getByRole('textbox').fill('I agree with this'); const c = page.getByRole('button', { name: /I agree/ }).first(); if (await c.count()) await c.click().catch(() => undefined); } await page.getByRole('button', { name: /^Post/ }).click(); } },
    { name: 'voice-reply', path: '/q/q9/a/a1', word: 'Send', kind: 'reply', run: async (page, n) => { if (n === 0) { await page.getByRole('button', { name: 'Reply by voice' }).first().click(); await page.getByRole('button', { name: 'I agree', exact: false }).last().click(); await startRec(page); } await page.getByRole('dialog').getByRole('button', { name: /^Send/ }).first().click(); } },
  ];
  for (const w of (process.env.WIDTHS ?? '390,1440').split(',').map(Number)) for (const f of flows) {
    let served = 0; const posts: { kind: string; key: string; at: number }[] = [];
    const { page, ctx } = await open({ w, signedIn: true, posts, post: (kind) => (kind === f.kind ? (served++ < 3 ? { status: 409, body: { error: { code: 'CONFLICT', message: 'Start again with a new key', requestId: 'r' } } } : { status: 201, body: receipt(kind) }) : null) });
    await page.goto(`${ORIGIN}${f.path}`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const line = page.getByText(`That did not post. Tap ${f.word} to try again.`).first();
    const views: boolean[] = []; const generic: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      await f.run(page, i);
      if (i < 3) {
        await line.waitFor({ timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        views.push(await inView(page, line));
        generic.push(/Something went wrong on our side/.test(await text(page)));
        if (i === 2) await shot(page, `post409-${f.name}-${w}`);
      } else await page.waitForTimeout(2500);
    }
    const mine = posts.filter((p) => p.kind === f.kind);
    console.log('POST409', JSON.stringify({ w, flow: f.name, requests: mine.length, statuses: [409, 409, 409, 201].slice(0, mine.length), keysAllDifferent: new Set(mine.map((p) => p.key)).size === mine.length, keys: mine.map((p) => p.key.slice(0, 8)), lineInViewAfter409: views, genericLine: generic, url: page.url().replace(ORIGIN, ''), finalPostsAccepted: served - 3 }));
    await ctx.close();
  }
}

// ---------- the opening on a running clock: helpers ----------
const SCREENS: [string, string, (s: string, p: Page) => Promise<boolean>][] = [
  ['home', '/', async (s) => !COMING.test(s) && /Today’s question/i.test(s)],
  ['landing', '/welcome', async (s) => !COMING.test(s) && /Today’s question/i.test(s)],
  ['join', '/join', async (s) => !COMING.test(s) && !/Coming up/.test(s) && s.length > 40],
  ['go', '/go', async (_s, p) => (await p.locator('[data-testid=go-ANGRY]').count()) > 0 || /Pick a word|ANGRY|Angry/.test(await text(p))],
  ['question', '/q/q9', async (s, p) => (await p.getByTestId('q-coming-up').count()) === 0 && /Hopeful, but tired/.test(s)],
  ['speak', '/speak', async (s, p) => (await p.getByTestId('q-coming-up').count()) === 0 && !COMING.test(s) && s.length > 40],
  ['share', '/s/c1', async (s) => /Add your voice/.test(s) && !COMING.test(s)],
];
type Cell = { name: string; skew: number; hdr: number | null; step?: number };
async function race(cells: Cell[], w: number, lead: number, screens = SCREENS.filter((s) => !process.env.PAGES || process.env.PAGES.split(',').includes(s[0])), after?: (c: Cell, pages: { name: string; page: Page; ctx: BrowserContext; calls: number[] }[]) => Promise<void>) {
  opensAt = Date.now() + lead;
  const all: { cell: Cell; name: string; page: Page; ctx: BrowserContext; calls: number[]; live: (s: string, p: Page) => Promise<boolean> }[] = [];
  const t0 = Date.now();
  for (const cell of cells) for (const [name, path, live] of screens) {
    const o = await open({ w, skew: cell.skew, hdr: cell.hdr });
    all.push({ cell, name, ...o, live });
    o.page.goto(`${ORIGIN}${path}`).catch(() => undefined);
  }
  await sleep(14_000);
  for (const c of all) if (!COMING.test(await text(c.page).catch(() => ''))) console.log(`     not coming up at start: ${c.cell.name} ${c.name}`);
  const settled = Date.now();
  if (cells.some((c) => c.step !== undefined)) {
    await sleep(Math.max(0, t0 + 24_000 - Date.now()));
    for (const c of all) if (c.cell.step !== undefined) await c.ctx.clock.setSystemTime(new Date(Date.now() + c.cell.skew + c.cell.step));
  }
  await sleep(Math.max(0, opensAt - Date.now() - 400));
  const res: Record<string, { secs: number[]; before: number[]; names: string[] }> = {};
  await Promise.all(all.map(async (c) => {
    const r = (res[c.cell.name] ??= { secs: [], before: [], names: [] });
    r.before.push(c.calls.filter((t) => t > settled && t < opensAt).length);
    for (;;) {
      const s = await text(c.page).catch(() => '');
      if (await c.live(s, c.page).catch(() => false)) { r.secs.push(+((Date.now() - opensAt) / 1000).toFixed(2)); r.names.push(c.name); break; }
      if (Date.now() - opensAt > 60_000) { r.secs.push(999); r.names.push(c.name); console.log(`     stuck ${c.cell.name} ${c.name}: ${s.slice(0, 160)}`); break; }
      await sleep(100);
    }
  }));
  if (after) for (const c of cells) await after(c, all.filter((x) => x.cell === c));
  for (const c of all) await c.ctx.close();
  return { res, minutes: (opensAt - settled) / 60_000 };
}
const summary = (name: string, r: { secs: number[]; before: number[]; names?: string[] }, minutes: number) => `${name}: live ${r.secs.map((s, i) => `${r.names?.[i] ?? ''}=${s >= 999 ? 'NOT LIVE in 60s' : s}`).join(' ')} | min ${Math.min(...r.secs)} max ${Math.max(...r.secs)} | asks before the instant per page ${r.before.join(',')} over ${minutes.toFixed(1)} min (per page per minute ${(Math.max(...r.before) / minutes).toFixed(1)} worst)`;

// ---------- MEDIUM-2: device clock steps while the page is open ----------
if (PART === 'step') {
  for (const w of (process.env.WIDTHS ?? '390').split(',').map(Number)) {
    for (const step of (process.env.STEPS ? process.env.STEPS.split(',').map(Number) : [-600_000, -10_800_000, 600_000, 10_800_000])) {
      const { res, minutes } = await race([{ name: `step ${step / 60_000} min`, skew: 0, hdr: 0, step }], w, 60_000);
      for (const [k, v] of Object.entries(res)) console.log('STEP', w, summary(k, v, minutes));
    }
  }
}

// ---------- MEDIUM-3: two guesses ----------
if (PART === 'two') {
  const cells: Cell[] = [
    { name: 'header right, device 10 min slow', skew: -600_000, hdr: 0 },
    { name: 'header right, device 10 min fast', skew: 600_000, hdr: 0 },
    { name: 'device right, header 10 min slow', skew: 0, hdr: -600_000 },
    { name: 'device right, header 10 min fast', skew: 0, hdr: 600_000 },
    { name: 'header missing, device right', skew: 0, hdr: null },
    { name: 'header missing, device 10 min slow (may be late)', skew: -600_000, hdr: null },
    { name: 'both wrong the same way: device and header 10 min slow (late by design)', skew: -600_000, hdr: -600_000 },
  ];
  const only = process.env.ONLY ? Number(process.env.ONLY) : null;
  for (const w of (process.env.WIDTHS ?? '390').split(',').map(Number)) {
    const { res, minutes } = await race(only === null ? cells : [cells[only]], w, Number(process.env.LEAD ?? 200_000));
    for (const [k, v] of Object.entries(res)) console.log('TWO', w, summary(k, v, minutes));
  }
}

// ---------- the regression: both clocks right ----------
if (PART === 'regress') {
  for (const w of (process.env.WIDTHS ?? '390,1440').split(',').map(Number)) {
    const all: Record<string, { secs: number[]; before: number[]; names?: string[] }> = {};
    for (let run = 0; run < Number(process.env.RUNS ?? 5); run++) {
      const { res } = await race([{ name: 'both right', skew: 0, hdr: 0 }], w, 50_000, SCREENS.filter((s) => ['home', 'go', 'question', 'speak', 'share'].includes(s[0])), async (_c, pages) => {
        if (run === 0) for (const p of pages) await shot(p.page, `regress-live-${p.name}-${w}`);
      });
      const r = res['both right'];
      (all['both right'] ??= { secs: [], before: [] }).secs.push(...r.secs); all['both right'].before.push(...r.before);
      console.log(`  run ${run + 1} width ${w}: ${r.secs.join(' ')} before ${r.before.join(',')}`);
    }
    console.log('REGRESS', w, summary('both right (5 runs x 5 pages)', all['both right'], 50 / 60));
  }
}

// ---------- MEDIUM-2, return to the tab: clock stepped, tab hidden through the instant, shown 12 s after ----------
if (PART === 'back') {
  const setVis = (p: Page, hidden: boolean) => p.evaluate((h) => { Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: h, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); if (!h) window.dispatchEvent(new Event('focus')); }, hidden);
  for (const step of (process.env.STEPS ? process.env.STEPS.split(',').map(Number) : [-600_000, -10_800_000, 10_800_000])) {
    opensAt = Date.now() + 50_000;
    const pages: { name: string; page: Page; ctx: BrowserContext; calls: number[]; live: (s: string, p: Page) => Promise<boolean> }[] = [];
    for (const [name, path, live] of SCREENS) { const o = await open({ w: 390, skew: 0, hdr: 0 }); pages.push({ name, ...o, live }); o.page.goto(`${ORIGIN}${path}`).catch(() => undefined); }
    await sleep(16_000);
    for (const c of pages) await c.ctx.clock.setSystemTime(new Date(Date.now() + step));
    for (const c of pages) await setVis(c.page, true);
    const hiddenFrom = Date.now(); const callsHidden = new Map(pages.map((c) => [c.name, c.calls.length]));
    await sleep(Math.max(0, opensAt + 12_000 - Date.now()));
    const stillComing = (await Promise.all(pages.map(async (c) => COMING.test(await text(c.page)) ? 1 : 0))).reduce((a: number, b: number) => a + b, 0);
    const shownAt = Date.now();
    const asksHidden = pages.map((c) => `${c.name}:${c.calls.length - (callsHidden.get(c.name) ?? 0)}`).join(',');
    for (const c of pages) await setVis(c.page, false === true);
    const secs: string[] = [];
    await Promise.all(pages.map(async (c) => { for (;;) { const s = await text(c.page).catch(() => ''); if (await c.live(s, c.page).catch(() => false)) { secs.push(`${c.name}=${((Date.now() - shownAt) / 1000).toFixed(2)}`); break; } if (Date.now() - shownAt > 30_000) { secs.push(`${c.name}=NOT LIVE in 30s`); break; } await sleep(100); } }));
    console.log('BACK', JSON.stringify({ step: `${step / 60_000} min`, hiddenForSeconds: +((shownAt - hiddenFrom) / 1000).toFixed(1), stillComingUpWhenShown: stillComing, apiCallsWhileHidden: asksHidden, secondsToLiveAfterShown: secs.join(' ') }));
    if (step === -600_000) for (const c of pages.slice(0, 1)) await shot(c.page, `back-${c.name}-390`);
    for (const c of pages) await c.ctx.close();
  }
}
await browser.close(); server.close();
