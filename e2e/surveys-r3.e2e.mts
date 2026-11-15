// V-SURVEYS round 3 proof against ONE `next build` served with `next start`, with a REAL local HTTP stub standing in for the API and WAWU ID.
//   NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4010/api/v1 NEXT_PUBLIC_WAWU_ID_BASE=http://127.0.0.1:4010/id npm run build
//   npx next start -p 3977 &      then   npx tsx e2e/surveys-r3.e2e.mts
// Every request the app sends (also those sent while a page closes) lands on the stub, which writes the request log. No live service is called.
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3977';
const SHOTS = process.env.SHOTS ?? 'docs/lead/surveys/shots-r3';
const PORT = 4010;
mkdirSync(SHOTS, { recursive: true });

// ---------- the stub ----------
const jwt = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s`;
const subOf = (auth?: string) => { try { return JSON.parse(Buffer.from((auth ?? '').replace('Bearer ', '').split('.')[1], 'base64url').toString()).sub as string; } catch { return 'nobody'; } };
interface Entry { n: number; at: number; user: string; method: string; path: string; body: unknown }
const log: Entry[] = [];
const mode = { closed: false, failResponses: 0, report: 'review' as string, forceReleaseConflict: false, released: false, lastPageServed: false, hidden: new Set<string>() };
const resetStub = () => { log.length = 0; Object.assign(mode, { closed: false, failResponses: 0, report: 'review', forceReleaseConflict: false, released: false, lastPageServed: false }); mode.hidden.clear(); };
let seq = 0;

const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const allowance = { freePostsRemaining: 7, balanceMilli: 12500, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const now = () => new Date().toISOString();
const topic = { questionCount: 5, id: 't1', weekNumber: 1, title: 'Power and light', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 10, voicesCount: 10 };
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'When salary arrives, how long before it is gone?', hint: null, moodOptions: [], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const meBody = (sub: string) => ({ phoneMasked: '+234 803 *** 4412', id: sub, wawuId: 'w', handle: sub + '.h', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: sub === 'admin' ? ['ADMIN'] : [], profile: { id: sub, handle: sub + '.h', displayName: sub === 'userB' ? 'Bola Ade' : 'Ngozi Eze', bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Lagos', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'light', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480, shareMyWord: false, useMyStateForSurveys: false } });
const survey = {
  id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 'Power and light', questionCount: 3, note: 'x', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24', '25-34'],
  questions: [
    { id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How many hours of light did you get yesterday?', options: [{ id: 'h1', label: '1 to 6 hours' }, { id: 'h2', label: '7 to 12 hours' }, { id: 'h3', label: 'More than 12 hours' }] },
    { id: 'q2', position: 2, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool when there is no light?', options: [{ id: 'o1', label: 'A fan on battery' }, { id: 'o2', label: 'Cold drinks' }] },
    { id: 'q3', position: 3, kind: 'VOICE', prompt: 'Anything else you want them to hear?', options: [] },
  ],
};
const survey2 = { ...survey, id: 's2', title: 'Voice first', questions: [{ id: 'v1', position: 1, kind: 'VOICE', prompt: 'Say it first', options: [] }, survey.questions[1], survey.questions[0]] };
const handle = (n: number) => String(n).padStart(2, '0').repeat(16);
const free = (n: number) => ({ id: handle(n), questionId: 'q9', prompt: 'Anything else you want them to hear?', kind: 'TEXT', text: `Written answer number ${n}`, seconds: null, hidden: mode.hidden.has(handle(n)) });
const pageOf: Record<string, number[]> = { '': [1, 2], c2: [3, 4], c3: [5, 6] };
const next: Record<string, string | null> = { '': 'c2', c2: 'c3', c3: null };
const head = { id: 's1', brandName: 'Zobo Fresh', title: 'Power and light', status: 'APPROVED', startsOn: '2026-11-20', endsOn: '2026-11-30', responseTarget: 200 };
const reportBody = () => {
  if (mode.released) return releasedReport('plain');
  if (mode.report === 'review') return { survey: head, stage: 'REVIEW', ready: true, released: false, answeredSoFar: 52, note: '' };
  return releasedReport(mode.report);
};
function releasedReport(kind: string) {
  const choice = (answered: number | null) => ({ id: 'q2', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool when there is no light?', answered, options: answered === null ? [{ id: 'o1', label: 'A fan on battery', count: null, share: null, hidden: true }, { id: 'o2', label: 'Cold drinks', count: null, share: null, hidden: true }] : [{ id: 'o1', label: 'A fan on battery', count: 38, share: 26, hidden: false }, { id: 'o2', label: 'Cold drinks', count: 108, share: 74, hidden: false }], other: null, texts: [], voices: [] });
  const text = { id: 'q3', position: 2, kind: 'TEXT', prompt: 'Anything else you want them to hear?', answered: 41, options: [], other: null, texts: ['Cold zobo helps a lot.'], voices: [] };
  return {
    stage: 'RELEASED', ready: true, released: true, releasedAt: '2026-12-02T09:00:00Z', survey: head, minGroupSize: 20, belowMinimum: false,
    totals: { views: 940, starts: 210, skips: 64, responses: 146, completionRate: 70 },
    questions: [choice(kind === 'nullanswered' ? null : 146), text],
    ...(kind === 'nobreakdown' ? {} : { byState: [{ state: 'Lagos', responses: 80, share: 55 }], byStateOther: null, byAgeBand: [{ ageBand: '25-34', responses: 62, share: 42 }], byAgeBandOther: null }),
    note: 'Results are combined and anonymous.',
  };
}

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const origin = req.headers.origin ?? ORIGIN;
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': String(req.headers['access-control-request-headers'] ?? '*'), 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url ?? '/', 'http://x');
    const p = url.pathname.replace(/^\/api\/v1/, '');
    const m = req.method ?? 'GET';
    const raw = Buffer.concat(chunks).toString();
    const body = raw && req.headers['content-type']?.includes('json') ? JSON.parse(raw) : null;
    const user = subOf(req.headers.authorization);
    const out = (status: number, b?: unknown) => { res.writeHead(status, { ...cors, 'content-type': 'application/json' }); res.end(b === undefined ? '' : JSON.stringify(b)); };
    const err = (status: number, message: string) => out(status, { error: { code: 'ERR', message } });
    if (m !== 'GET') log.push({ n: ++seq, at: Date.now(), user, method: m, path: url.pathname.replace('/api/v1', ''), body });
    // WAWU ID
    if (p === '/id/auth/login') { const sub = String(body?.identifier).startsWith('b') ? 'userB' : 'userA'; return out(200, { data: { accessToken: jwt(sub), refreshToken: 'r', user: { id: sub, fullName: sub, email: body?.identifier, phone: '', status: 'active' } } }); }
    if (p === '/id/auth/logout') return out(200, {});
    if (url.pathname.startsWith('/__put')) return out(200, {});
    // VOICES
    if (p === '/me') return out(200, meBody(user));
    if (p === '/surveys/placement') return out(200, { survey: null });
    if (p === '/surveys/s1' && m === 'GET') return out(200, survey);
    if (p === '/surveys/s2' && m === 'GET') return out(200, survey2);
    if (/^\/surveys\/s\d\/events$/.test(p)) return out(204);
    if (/^\/surveys\/s\d\/responses$/.test(p)) {
      if (mode.closed) return err(409, 'This survey has closed.');
      if (mode.failResponses > 0) { mode.failResponses--; return err(400, 'The answers did not go through. Try again.'); }
      return out(201, { ok: true, note: '' });
    }
    if (p === '/voice-clips' && m === 'POST') return out(201, { clip: { id: 'c' + seq, status: 'UPLOADING' }, putUrl: `http://127.0.0.1:${PORT}/__put` });
    if (/^\/voice-clips\/c\d+\/complete$/.test(p)) return out(200, { id: p.split('/')[2], status: 'PROCESSING' });
    if (/^\/voice-clips\/c\d+$/.test(p) && m === 'GET') return out(200, { id: p.split('/')[2], status: 'READY', durationMs: 2000, maxDurationMs: 30000, peaks: [] });
    if (/^\/voice-clips\/c\d+$/.test(p) && m === 'DELETE') return out(204);
    // admin
    if (p === '/admin/today') return out(200, { needsAttention: {} });
    if (p === '/categories') return out(200, { items: [] });
    if (p === '/admin/surveys/s1/report') return out(200, reportBody());
    if (p === '/admin/surveys/s1/free-answers' && m === 'GET') {
      const c = url.searchParams.get('cursor') ?? '';
      if (!(c in pageOf)) return err(422, 'That page link is not valid.');
      if (next[c] === null) mode.lastPageServed = true;
      return out(200, { released: false, items: pageOf[c].map(free), total: 6, hiddenCount: mode.hidden.size, nextCursor: next[c] });
    }
    const fa = p.match(/^\/admin\/surveys\/s1\/free-answers\/([0-9a-f]+)$/);
    if (fa && m === 'PATCH') { if (!/^[0-9a-f]{32}$/.test(fa[1])) return err(404, 'Not found.'); if (body?.hidden) mode.hidden.add(fa[1]); else mode.hidden.delete(fa[1]); return out(200, { id: fa[1], hidden: !!body?.hidden }); }
    if (p === '/admin/surveys/s1/release') {
      if (mode.forceReleaseConflict || !mode.lastPageServed) return err(409, 'Read the written answers before releasing the results.');
      mode.released = true;
      return out(200, { released: true, releasedAt: '2026-12-02T09:00:00Z', hiddenCount: mode.hidden.size, mailed: true });
    }
    if (p === '/config/public') return out(200, { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] });
    if (p === '/me/allowance') return out(200, allowance);
    if (p === '/home') return out(200, { topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Ngozi' });
    if (p === '/topics/current') return out(200, topic);
    if (p === '/questions/today') return out(200, question);
    if (p === '/me/answers') return out(200, { items: [], nextCursor: null });
    return out(200, { items: [], ad: null });
  });
});
await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));

// ---------- the runs ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const allLogs: Record<string, Entry[]> = {};
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => {
  if (only && !name.includes(only)) return;
  resetStub();
  try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); }
  allLogs[name] = log.map((e) => ({ ...e }));
};
async function ctxFor(w: number, h: number, sub?: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'light' });
  if (sub) await ctx.addInitScript((tok) => { if (!localStorage.getItem('voices-web-session')) localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: tok, refreshToken: 'r' })); }, jwt(sub));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  return { ctx, page };
}
const shot = async (page: Page, name: string, w: number) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/${name}-${w}.png` }); };
const kinds = (user?: string) => log.filter((e) => /\/surveys\/s\d\/events$/.test(e.path) && (!user || e.user === user)).map((e) => `${e.user}:${(e.body as { kind: string }).kind}`);
const keysIn = (page: Page) => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('wawu.survey.')));
async function record(page: Page) {
  await page.getByRole('button', { name: /record|tap to/i }).first().click();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: /stop/i }).first().click();
}
async function toQ3(page: Page) {
  await page.getByRole('radio', { name: '1 to 6 hours' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 2 of 3').waitFor();
  await page.getByRole('radio', { name: 'Cold drinks' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 3 of 3').waitFor();
}

try {
  for (const [w, h] of [[390, 844], [1440, 900]] as [number, number][]) {
    await t(`N1 ${w}: five reloads, a hidden tab, a tab switch and a closed tab send no SKIP`, async () => {
      const { ctx, page } = await ctxFor(w, h, 'userA');
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('radio', { name: '1 to 6 hours' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      for (let i = 0; i < 5; i++) { await page.reload(); await page.getByText('Question 2 of 3').waitFor(); }
      // a hidden tab and a switch to another tab and back
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); });
      const other = await ctx.newPage(); await other.goto('about:blank'); await other.bringToFront(); await page.bringToFront();
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(500);
      assert.equal(await page.getByText('Question 2 of 3').count(), 1, 'the survey is still open at question 2');
      assert.equal(await page.getByRole('radio', { name: '1 to 6 hours' }).count(), 0);
      assert.deepEqual(kinds(), ['userA:START'], 'only the one START, no SKIP');
      await shot(page, 'N1-after-five-reloads', w);
      await other.close();
      await page.close({ runBeforeUnload: true });
      await new Promise((r) => setTimeout(r, 800));
      assert.deepEqual(kinds(), ['userA:START'], 'closing the tab sent nothing');
      await ctx.close();
    });
    await t(`N1 ${w}: a real choice to leave sends one SKIP, once per survey per person per tab`, async () => {
      const { ctx, page } = await ctxFor(w, h, 'userA');
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('radio', { name: '1 to 6 hours' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      await page.getByRole('button', { name: 'Leave the survey' }).first().click();
      await page.getByRole('dialog').getByText('Leave the survey?').waitFor();
      await shot(page, 'N1-leave-sheet', w);
      await page.getByRole('button', { name: 'Leave', exact: true }).click();
      await page.waitForURL(`${ORIGIN}/`);
      await page.waitForTimeout(400);
      assert.deepEqual(kinds(), ['userA:START', 'userA:SKIP']);
      // back in, then away by an app link (a client-side navigation): still one
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      assert.equal(await page.getByRole('radio', { name: '1 to 6 hours' }).getAttribute('aria-checked'), 'false', 'the draft went with the leave');
      await page.evaluate(() => (window as unknown as { next: { router: { push: (p: string) => void } } }).next.router.push('/'));
      await page.waitForURL(`${ORIGIN}/`);
      await page.waitForTimeout(400);
      assert.deepEqual(kinds(), ['userA:START', 'userA:SKIP'], 'no second SKIP');
      await ctx.close();
    });
    await t(`N4 ${w}: a link away inside the app sends a SKIP and removes the draft; Back with no answers too`, async () => {
      const { ctx, page } = await ctxFor(w, h, 'userA');
      await page.goto(`${ORIGIN}/`);
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await page.getByRole('radio', { name: '1 to 6 hours' }).click();
      await page.getByRole('button', { name: 'Send answer' }).click();
      await page.getByText('Question 2 of 3').waitFor();
      assert.ok((await keysIn(page)).some((k) => k.endsWith('.draft')));
      await page.evaluate(() => (window as unknown as { next: { router: { push: (p: string) => void } } }).next.router.push('/profile'));
      await page.waitForURL(`${ORIGIN}/profile`);
      await page.waitForTimeout(400);
      assert.deepEqual(kinds(), ['userA:START', 'userA:SKIP']);
      assert.deepEqual((await keysIn(page)).filter((k) => k.endsWith('.draft')), [], 'the draft is gone');
      assert.deepEqual((await keysIn(page)).sort(), ['wawu.survey.userA.s1.skipped', 'wawu.survey.userA.s1.started']);
      await ctx.close();
    });
  }

  for (const [w, h] of [[390, 844], [1440, 900]] as [number, number][]) {
    await t(`N2 ${w}: person A answers two questions and signs out; person B signs in on the same tab and finds question 1`, async () => {
      const { ctx, page } = await ctxFor(w, h);
      const signIn = async (who: string) => {
        await page.goto(`${ORIGIN}/sign-in`);
        await page.getByLabel('Email or phone number').fill(`${who}@example.test`);
        await page.getByLabel('Password').fill('a-long-password');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'));
      };
      await signIn('a');
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await toQ3(page);
      const before = await keysIn(page);
      assert.ok(before.length >= 2 && before.every((k) => k.startsWith('wawu.survey.userA.')), 'kept under A: ' + before.join(','));
      await page.goto(`${ORIGIN}/settings`);
      await page.getByRole('button', { name: 'Sign out' }).filter({ visible: true }).first().click();
      await page.waitForURL(`${ORIGIN}/`);
      assert.deepEqual(await keysIn(page), [], 'nothing of A is left after sign-out');
      await signIn('b');
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      assert.equal(await page.getByRole('radio', { name: '1 to 6 hours' }).getAttribute('aria-checked'), 'false');
      await page.waitForTimeout(400);
      assert.deepEqual(kinds(), ['userA:START', 'userB:START'], 'B START is sent');
      assert.ok((await keysIn(page)).every((k) => k.startsWith('wawu.survey.userB.')));
      await shot(page, 'N2-person-B-question-1', w);
      await ctx.close();
    });
  }

  for (const [w, h] of [[390, 844], [1440, 900]] as [number, number][]) {
    await t(`N3 ${w}: a recording is kept the moment it is ready (last question), a reload shows it ready, and it sends`, async () => {
      const { ctx, page } = await ctxFor(w, h, 'userA');
      mode.failResponses = 0;
      await page.goto(`${ORIGIN}/surveys/s1`);
      await page.getByText('Question 1 of 3').waitFor();
      await toQ3(page);
      await record(page);
      await page.getByTestId('voice-ready').waitFor();
      const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem('wawu.survey.userA.s1.draft') as string));
      assert.equal(draft.given.q3.kind, 'voice');
      assert.ok(/^c\d+$/.test(draft.given.q3.clipId), 'the clip id is in the draft before anything is sent');
      assert.equal(log.filter((e) => e.path === '/surveys/s1/responses').length, 0, 'nothing posted yet');
      await page.reload();
      await page.getByTestId('voice-ready').waitFor();
      assert.ok((await page.getByTestId('voice-ready').innerText()).includes('Your voice answer is ready'));
      await shot(page, 'N3-voice-ready-after-reload', w);
      await page.getByRole('button', { name: 'Send answer' }).last().click();
      await page.getByText('Thanks. Your answers are in.').waitFor();
      const post = log.find((e) => e.path === '/surveys/s1/responses')!.body as { answers: Record<string, string>[] };
      assert.equal(post.answers[2].clipId, draft.given.q3.clipId);
      assert.deepEqual((await keysIn(page)).filter((k) => k.endsWith('.draft')), []);
      await ctx.close();
    });
    await t(`N3 ${w}: a voice answer on a middle question is kept too (reload, go back to it)`, async () => {
      const { ctx, page } = await ctxFor(w, h, 'userA');
      await page.goto(`${ORIGIN}/surveys/s2`);
      await page.getByText('Question 1 of 3').waitFor();
      await record(page);
      await page.getByTestId('voice-ready').waitFor();
      await page.reload();
      await page.getByTestId('voice-ready').waitFor();
      await page.getByRole('button', { name: 'Send answer' }).last().click();
      await page.getByText('Question 2 of 3').waitFor();
      await page.reload();
      await page.getByText('Question 2 of 3').waitFor();
      // the phone has no Back button on the Survey board (the first question can be reached again by the desktop Back only)
      if (w >= 1024) {
        await page.getByRole('button', { name: 'Back' }).filter({ visible: true }).first().click();
        await page.getByTestId('voice-ready').waitFor();
        await shot(page, 'N3-middle-question-ready', w);
      }
      assert.deepEqual(kinds(), ['userA:START']);
      await ctx.close();
    });
    await t(`closed ${w}: an answer after the survey closed shows the server's words and goes back with the feed place kept`, async () => {
      const { ctx, page } = await ctxFor(w, h, 'userA');
      await page.goto(`${ORIGIN}/`);
      await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 700); });
      await page.waitForTimeout(300);
      const y = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => (window as unknown as { next: { router: { push: (p: string) => void } } }).next.router.push('/surveys/s1'));
      await page.getByText('Question 1 of 3').waitFor();
      await toQ3(page);
      mode.closed = true;
      await record(page);
      await page.getByTestId('voice-ready').waitFor();
      await page.getByRole('button', { name: 'Send answer' }).last().click();
      await page.getByTestId('survey-closed').getByText('This survey has closed.').waitFor();
      assert.equal(await page.getByText('Thanks. Your answers are in.').count(), 0);
      assert.deepEqual((await keysIn(page)).filter((k) => k.endsWith('.draft')), []);
      await shot(page, 'Closed-409', w);
      await page.getByRole('button', { name: 'Back to where you were' }).click();
      await page.waitForURL(`${ORIGIN}/`);
      await page.waitForTimeout(600);
      const y2 = await page.evaluate(() => window.scrollY);
      assert.ok(Math.abs(y2 - y) < 40, `feed place kept: scrollY was ${y}, now ${y2}`);
      assert.deepEqual(kinds(), ['userA:START'], 'no SKIP for a closed survey');
      await ctx.close();
    });
  }

  const w = 1440, h = 900;
  await t(`admin ${w}: three-page review list, Release off until the last page, handles sent, 409 in the server's words`, async () => {
    const { ctx, page } = await ctxFor(w, h, 'admin');
    await page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await page.getByText('Written answer number 2').waitFor();
    const rel = page.getByRole('button', { name: 'Release the results' });
    assert.equal(await rel.isDisabled(), true);
    await page.getByText('Read the written answers before releasing the results.').waitFor();
    await shot(page, 'Review-page-1-of-3', w);
    await page.getByRole('button', { name: /^Hide: Written answer number 1/ }).click();
    await page.getByText('1 of 6 hidden').waitFor();
    const patch = log.filter((e) => e.method === 'PATCH');
    assert.equal(patch.length, 1);
    assert.equal(patch[0].path, `/admin/surveys/s1/free-answers/${handle(1)}`);
    assert.deepEqual(patch[0].body, { hidden: true });
    await page.getByRole('button', { name: 'Show more answers' }).click();
    await page.getByText('Written answer number 4').waitFor();
    assert.equal(await rel.isDisabled(), true);
    await page.getByRole('button', { name: 'Show more answers' }).click();
    await page.getByText('Written answer number 6').waitFor();
    assert.equal(await rel.isDisabled(), false);
    assert.equal(await page.getByText('Read the written answers before releasing the results.').count(), 0);
    await shot(page, 'Review-last-page-release-on', w);
    mode.forceReleaseConflict = true;
    await rel.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Release the results' }).click();
    await page.getByRole('alert').getByText('Read the written answers before releasing the results.').waitFor();
    await shot(page, 'Release-409-server-words', w);
    mode.forceReleaseConflict = false;
    await page.getByRole('button', { name: 'Release the results' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Release the results' }).click();
    await page.getByTestId('stage-released').waitFor();
    assert.equal(log.filter((e) => e.path.endsWith('/release')).length, 2);
    await ctx.close();
  });
  await t(`admin ${w}: release before the last page is read answers 409 from the server (page button stays off)`, async () => {
    const { ctx, page } = await ctxFor(w, h, 'admin');
    await page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await page.getByText('Written answer number 2').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Release the results' }).isDisabled(), true);
    assert.equal(log.filter((e) => e.path.endsWith('/release')).length, 0);
    await ctx.close();
  });
  await t(`admin ${w}: a question with answered null shows no figure`, async () => {
    mode.report = 'nullanswered';
    const { ctx, page } = await ctxFor(w, h, 'admin');
    await page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await page.getByTestId('too-few').waitFor();
    const text = await page.locator('body').innerText();
    assert.ok(!/\bnull\b|NaN/.test(text));
    assert.ok(!/0 answered this question/.test(text));
    assert.ok(text.includes('Too few answers to show'));
    assert.ok(text.includes('41 answered this question'));
    await shot(page, 'Report-answered-null', w);
    await ctx.close();
  });
  await t(`admin ${w}: a report with a breakdown missing draws nothing for it`, async () => {
    mode.report = 'nobreakdown';
    const { ctx, page } = await ctxFor(w, h, 'admin');
    await page.goto(`${ORIGIN}/admin/surveys/s1/results`);
    await page.getByTestId('stage-released').waitFor();
    assert.equal(await page.getByText('By state').count(), 0);
    assert.equal(await page.getByText('By age band').count(), 0);
    await shot(page, 'Report-no-breakdown', w);
    mode.report = 'plain';
    await page.reload();
    await page.getByText('By state').waitFor();
    await shot(page, 'Report-with-breakdown', w);
    await ctx.close();
  });
} finally {
  writeFileSync(`${SHOTS}/request-logs.json`, JSON.stringify(Object.fromEntries(Object.entries(allLogs).map(([k, v]) => [k, v.map((e) => ({ n: e.n, user: e.user, call: `${e.method} ${e.path}`, body: e.body }))])), null, 1));
  await browser.close();
  server.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL OK');
process.exit(failed ? 1 : 0);
