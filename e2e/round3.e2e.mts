// V-PRELAUNCH round 3 proof against the built app (next start), the API stubbed on a real clock.
//   VOICES_API_BASE=http://127.0.0.1:4010/api/v1 npx next start -p 3981 &   then   PART=h1|sheet|clock npx tsx e2e/round3.e2e.mts
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3981';
const SHOTS = process.env.SHOTS ?? 'docs/lead/prelaunch/shots-r4/';
mkdirSync(SHOTS, { recursive: true });
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const PART = process.env.PART ?? 'all';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let opensAt = Infinity; // real ms at which the API starts to say LIVE
let fault: { kind: string; until: number } | null = null; // from the instant until `until`, the share answer fails this way
let linkRefused = false;
let reqs: number[] = [];
let offlineNow = false; // the network is off: the browser's API calls fail as they would on a phone with no signal
const me = { id: 'u1', handle: 'ada.o', displayName: 'Ada O', state: 'Lagos', avatarUrl: null };
const q = (over: object = {}) => ({ id: 'q9', kind: 'DAILY', status: 'SCHEDULED', startsAt: new Date(opensAt).toISOString(), endsAt: '2026-11-22T23:00:00.000Z', text: 'How do you feel about Nigeria right now?', hint: 'With everything going on, say it in your voice. 10 seconds.', moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: 't1', topicTitle: 'Are You Really Fine? You Dey Okay?', voiceCount: 0, voicesCount: 0, answerCount: 0, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, ...over });
const topic = (over: object = {}) => ({ questionCount: 10, id: 't1', weekNumber: 1, title: 'Are You Really Fine? You Dey Okay?', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'SCHEDULED', sensitive: false, voiceCount: 0, voicesCount: 0, weeklyPollId: 'p1', reportId: null, whatNextPrompt: null, ...over });
const answer = { id: 'a1', questionId: 'q9', author: me, kind: 'TEXT', body: 'Hopeful, but tired of waiting.', clip: null, createdAt: '2026-11-14T23:02:00Z', editedAt: null, status: 'PUBLISHED', news: null, likeCount: 3, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: ['TRENDING'], mood: 'HOPEFUL', questionText: 'x' };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] };
const allowance = { freePostsRemaining: 10, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const meBody = { phoneMasked: '+234 803 *** 4412', id: 'u1', wawuId: 'w', handle: 'ada.o', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { ...me, bio: null, voiceCard: null, countryCode: 'NG', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } };

const isOpen = () => Date.now() >= opensAt;
const sharePage = (live: boolean) => ({ code: 'c1', objectType: 'QUESTION', topicLine: 'How do you feel about Nigeria right now?', countryAndTheme: 'Nigeria', arguments: [], leanLine: null, poll: null, proposalCount: null, topProposal: null, news: null, basedOnVoices: 0, summaryUpdatedAt: '2026-11-14T05:00:00Z', summaryLabel: 'x', featuredVoice: null, transcript: null, question: q(live ? { status: 'LIVE' } : {}), report: null, cardFallback: false, ctaLabel: 'Add your voice', openGraph: { title: 'How do you feel about Nigeria right now?', description: 'Opens soon', imageUrl: 'http://127.0.0.1:4010/c.png', url: 'http://127.0.0.1:3981/s/c1' } });
type Ans = { status: number; body: unknown; delay: number };
function shareAnswer(): Ans {
  const now = Date.now();
  const f = fault && now >= opensAt && now < fault.until ? fault.kind : null;
  if (f === '500') return { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } }, delay: 0 };
  if (f === '502') return { status: 502, body: 'Bad gateway', delay: 0 };
  if (f === '503') return { status: 503, body: { error: { code: 'BUSY', message: 'We are busy.' } }, delay: 0 };
  if (f === 'hang') return { status: 200, body: sharePage(isOpen()), delay: 14_000 };
  if (f === '404') return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'gone' } }, delay: 0 };
  return { status: 200, body: sharePage(isOpen()), delay: 0 };
}
const server = createServer(async (req, res) => {
  const p = (req.url ?? '').split('?')[0];
  res.setHeader('content-type', 'application/json');
  if (p === '/api/v1/share/c1') { reqs.push(Date.now()); const a = shareAnswer(); if (a.delay) await sleep(a.delay); res.statusCode = a.status; res.end(typeof a.body === 'string' ? a.body : JSON.stringify(a.body)); return; }
  res.statusCode = 404; res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }));
});
await new Promise<void>((r) => server.listen(4010, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

type Ctx = { page: Page; ctx: BrowserContext; calls: number[] };
async function open(w: number, o: { skew?: number; signedIn?: boolean } = {}): Promise<Ctx> {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
  const calls: number[] = [];
  if (o.skew !== undefined) await ctx.clock.install({ time: new Date(Date.now() + o.skew) });
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace('/api/v1', '');
    const at = Date.now();
    calls.push(at); reqs.push(at);
    const live = isOpen();
    const question = q(live ? { status: 'LIVE' } : {});
    const tp = topic(live ? { status: 'SCHEDULED' } : {});
    if (offlineNow) return route.abort('internetdisconnected');
    const headers = { date: new Date().toUTCString() };
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(b) });
    if (p === '/share/c1') { const a = shareAnswer(); if (a.delay) await sleep(a.delay); return route.fulfill({ status: a.status, contentType: 'application/json', headers, body: typeof a.body === 'string' ? a.body : JSON.stringify(a.body) }); }
    if (p === '/home') return ok({ topicOfWeek: tp, dailyQuestion: question, flashPoll: null, trending: live ? [answer] : [], newConversations: [], sponsored: null, greetingName: null });
    if (p === '/questions/today' || p === '/questions/q9') return ok(question);
    if (p === '/questions/q9/answers') return ok({ items: live ? [{ type: 'answer', answer }] : [], nextCursor: null });
    if (p === '/questions/q9/polls') return ok({ items: [] });
    if (p === '/questions/q9/moods') return ok({ total: 0, items: [] });
    if (p === '/topics/current') return ok(tp);
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance' || p === '/me') return ok({ error: { code: 'UNAUTHORIZED', message: 'no' } }, 401);
    if (p === '/weekly-reports/latest') return ok(null);
    if (p === '/share/links') return linkRefused ? ok({ error: { code: 'QUESTION_NOT_OPEN', message: 'no' } }, 409) : ok({ code: 'c1', url: 'https://usevoices.com/s/c1', cardStatus: 'FALLBACK', imageUrl: null, previewText: 'How do you feel about Nigeria right now?\nhttps://usevoices.com/s/c1' });
    if (p.startsWith('/share/c1/events')) return ok({}, 202);
    if (p.startsWith('/polls/current')) return ok(null);
    return ok({ items: [], nextCursor: null });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('     console.error: ' + m.text().slice(0, 300)); });
  return { page, ctx, calls };
}
const text = async (page: Page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const shot = async (page: Page, name: string) => { await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}${name}.png` }); };
const COMING = /Opens \w+ \d+ \w+/;

// ---------- H1 and friends: the share page at the instant ----------
async function shareRun(w: number, kind: string, extra: 'offline' | null = null) {
  opensAt = Date.now() + 14_000;
  fault = kind === 'none' ? null : { kind, until: opensAt + (kind === 'hang' ? 14_000 : 20_000) };
  const { page, ctx } = await open(w);
  await page.goto(`${ORIGIN}/s/c1`);
  await page.getByText(COMING).first().waitFor();
  const samples: string[] = [];
  const t0 = Date.now();
  let offlineAt = 0;
  if (extra === 'offline') { await sleep(Math.max(0, opensAt - 1_000 - Date.now())); offlineNow = true; await ctx.setOffline(true); offlineAt = Date.now(); }
  let liveAt = 0; let errorSeen = false;
  const recoverAt = extra === 'offline' ? opensAt + 30_000 : fault ? fault.until : opensAt;
  let onlineAt = 0;
  while (Date.now() - opensAt < 70_000) {
    const now = Date.now();
    if (extra === 'offline' && !onlineAt && now >= recoverAt) { offlineNow = false; await ctx.setOffline(false); onlineAt = Date.now(); }
    const s = await text(page);
    if (/We could not open that link|We are busy|We could not find/.test(s)) { errorSeen = true; samples.push(`${((now - opensAt) / 1000).toFixed(1)}s ERROR ${s.slice(0, 80)}`); if (kind !== '404') break; }
    if (/Add your voice/.test(s) && !COMING.test(s)) { liveAt = now; break; }
    if (kind === '404' && /We could not find/.test(s)) { liveAt = now; break; }
    await sleep(100);
  }
  const from = kind === '404' ? opensAt : extra === 'offline' ? onlineAt : fault ? fault.until : opensAt;
  const res = { kind: extra ?? kind, w, errorSeen, liveAfterRecovery: liveAt ? +((liveAt - from) / 1000).toFixed(2) : null, afterInstant: liveAt ? +((liveAt - opensAt) / 1000).toFixed(2) : null, samples };
  await shot(page, `share-${extra ?? kind}-${w}-${liveAt ? 'end' : 'stuck'}`);
  await ctx.close(); void t0; void offlineAt;
  return res;
}
if (PART === 'all' || PART === 'h1') {
  for (const w of [390, 1440]) {
    for (const [k, extra] of ([['500', null], ['502', null], ['503', null], ['hang', null], ['none', 'offline'], ['404', null]] as [string, 'offline' | null][]).filter(([k, e]) => !process.env.KINDS || process.env.KINDS.split(',').includes(e ?? k))) {
      console.log('H1', JSON.stringify(await shareRun(w, k, extra)));
    }
  }
}

// ---------- M1: the share sheet ----------
if (PART === 'all' || PART === 'sheet') {
  opensAt = Date.now() + 3_600_000; fault = null;
  const screens: [string, string, (p: Page) => Promise<void>][] = [
    ['home', '/', async (p) => { await p.locator('.vx-hero').getByRole('button', { name: 'Share', exact: true }).click(); }],
    ['landing', '/welcome', async (p) => { await p.getByRole('button', { name: 'Share', exact: true }).first().click(); }],
    ['go', '/go', async (p) => { await p.getByRole('button', { name: 'Share', exact: true }).first().click(); }],
    ['question', '/q/q9', async (p) => { await p.getByRole('button', { name: 'Share this question' }).locator('visible=true').first().click(); }],
  ];
  for (const w of [390, 1440]) for (const refused of [true, false]) for (const [name, path, click] of screens) {
    linkRefused = refused;
    const { page, ctx } = await open(w);
    await page.goto(`${ORIGIN}${path}`);
    await page.getByText(COMING).first().waitFor();
    await click(page);
    await page.getByRole('dialog').waitFor().catch(() => undefined);
    await page.waitForTimeout(900);
    const dlg = page.getByRole('dialog').first();
    const s = (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ');
    const btns = await dlg.getByRole('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()));
    let clip = '';
    if (refused) {
      await dlg.getByRole('button', { name: /Copy the question/ }).click();
      clip = await page.evaluate(() => navigator.clipboard.readText());
    }
    console.log('SHEET', JSON.stringify({ w, name, refused, url: page.url().replace(ORIGIN, ''), text: s.slice(0, 220), btns, clip, hasTitleLine: /A card and a link go out/.test(s), free: /Sharing is free/.test(s), disabled: await dlg.locator('button:disabled').count() }));
    await shot(page, `sheet-${refused ? 'refused' : 'ok'}-${name}-${w}`);
    await ctx.close();
  }
  linkRefused = false;
}

// ---------- L-a: the opening on a running clock, device clock right / slow / fast ----------
if (PART === 'all' || PART === 'clock') {
  fault = null;
  const SKEWS: [string, number][] = [['right', 0], ['10min slow', -600_000], ['10min fast', 600_000], ['3h slow', -10_800_000]];
  const SCREENS: [string, string, (s: string, p: Page) => Promise<boolean>][] = [
    ['home', '/', async (s) => !COMING.test(s) && /Today’s question/i.test(s)],
    ['go', '/go', async (_s, p) => (await p.locator('[data-testid=go-ANGRY]').count()) > 0],
    ['question', '/q/q9', async (s, p) => (await p.getByTestId('q-coming-up').count()) === 0 && /Hopeful, but tired/.test(s)],
    ['speak', '/speak', async (s, p) => (await p.getByTestId('q-coming-up').count()) === 0 && !COMING.test(s) && s.length > 40],
    ['share', '/s/c1', async (s) => /Add your voice/.test(s) && !COMING.test(s)],
  ];
  const runs = Number(process.env.RUNS ?? 5);
  const widths = (process.env.WIDTHS ?? '390,1440').split(',').map(Number);
  const table: Record<string, number[]> = {};
  const beforeCounts: Record<string, number> = {};
  for (const w of widths) for (let run = 0; run < runs; run++) {
    opensAt = Date.now() + 50_000;
    const pages: { key: string; page: Page; ctx: BrowserContext; calls: number[]; live: (s: string, p: Page) => Promise<boolean> }[] = [];
    for (const [sk, skew] of SKEWS) for (const [name, path, live] of SCREENS) {
      const o = await open(w, { skew });
      pages.push({ key: `${w}|${sk}|${name}`, ...o, live });
      o.page.goto(`${ORIGIN}${path}`).catch(() => undefined);
    }
    await sleep(15_000);
    for (const p of pages) if (COMING.test(await text(p.page)) === false) console.log('     not coming-up at start: ' + p.key);
    const settled = Date.now();
    const pre = new Map(pages.map((p) => [p.key, p.calls.length]));
    await sleep(Math.max(0, opensAt - Date.now() - 500));
    for (const p of pages) { const n = p.calls.filter((c) => c > settled && c < opensAt).length; beforeCounts[p.key] = (beforeCounts[p.key] ?? 0) + n; void pre; }
    await Promise.all(pages.map(async (p) => {
      for (;;) {
        const s = await text(p.page).catch(() => '');
        if (await p.live(s, p.page).catch(() => false)) { (table[p.key] ??= []).push(+((Date.now() - opensAt) / 1000).toFixed(2)); break; }
        if (Date.now() - opensAt > 90_000) { (table[p.key] ??= []).push(999); break; }
        await sleep(100);
      }
    }));
    if (run === 0) for (const p of pages) if (p.key.includes('|right|') || p.key.includes('3h')) await shot(p.page, `open-live-${p.key.replace(/\|/g, '-').replace(/ /g, '')}`);
    for (const p of pages) await p.ctx.close();
    console.log(`  run ${run + 1}/${runs} width ${w} done`);
  }
  for (const [k, v] of Object.entries(table)) console.log('CLOCK', k, JSON.stringify(v), 'min', Math.min(...v), 'max', Math.max(...v), 'requests before instant', beforeCounts[k]);
}
await browser.close(); server.close();
