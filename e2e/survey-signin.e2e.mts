// V-SURVEY-SIGNIN: nobody signed in any more on a survey: it ends on "Sign in to answer". Built app, API stubbed in the browser (401 to every signed-in route with no bearer).
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/survey-signin.e2e.mts
import assert from 'node:assert/strict';
import type { Page, Route } from 'playwright-core';
import { launch, newWorld, signIn, world, ORIGIN } from './round7-stub.mts';

const LINE = 'You are signed in as someone else in another tab. Nothing was saved. Reload to carry on.';
const opt = (id: string, label: string) => ({ id, label });
const survey = { id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 'How do you keep cool?', questionCount: 3, note: 'n', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24'],
  questions: [{ id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool?', options: [opt('o1', 'A fan'), opt('o2', 'Cold drinks')] }, { id: 'q2', position: 2, kind: 'TEXT', prompt: 'What do you miss most?', options: [] }, { id: 'q3', position: 3, kind: 'VOICE', prompt: 'Tell us more', options: [] }] };
const UNAUTH = { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' };
const browser = await launch();
let failed = 0, passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

async function sw(width: number) {
  const { w, person } = world();
  const A = person('A'), B = person('B');
  const ctx = await newWorld(browser, width, w);
  const log = { responses: [] as string[], unauth: 0, clips: 0 };
  await ctx.route('**/api/v1/**', async (route: Route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const token = (req.headers()['authorization'] ?? '').replace('Bearer ', '');
    const sub = w.subOf.get(token) ?? '';
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const signedOnly = p.startsWith('/surveys/s1') || p.startsWith('/voice-clips');
    if (signedOnly && !sub) { log.unauth++; return ok(UNAUTH, 401); }
    if (p === '/surveys/s1' && m === 'GET') return ok(survey);
    if (p === '/surveys/s1/events') return route.fulfill({ status: 204 });
    if (p === '/surveys/s1/responses') { log.responses.push(sub); return ok({ ok: true, note: '' }, 201); }
    if (m === 'POST' && p === '/voice-clips') log.clips++;
    return route.fallback();
  });
  return { A, B, ctx, log };
}
const removeSession = (page: Page) => page.evaluate(() => localStorage.removeItem('voices-web-session'));
async function toQ3(page: Page) {
  await page.getByRole('radio', { name: 'Cold drinks' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 2 of 3').waitFor();
  await page.getByRole('textbox').fill('The fridge');
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 3 of 3').waitFor();
}
async function record(page: Page) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: 'Stop recording' }).click();
}
const drafts = (page: Page) => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.endsWith('.draft')).length);
const endsSignedOut = async (page: Page, log: { responses: string[] }) => {
  await page.getByText('Sign in to answer').waitFor({ timeout: 10000 });
  assert.equal(await page.getByText(LINE).count(), 0);
  assert.equal(await page.getByText(/Thanks/).count(), 0);
  assert.equal(log.responses.length, 0);
  assert.equal(await drafts(page), 1, 'the draft stays stored');
};

for (const width of [390, 1440]) {
  await t(`[${width}] session removed in another tab BEFORE the voice take: record, ends on Sign in to answer`, async () => {
    const { A, ctx, log } = await sw(width);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/surveys/s1`); await toQ3(page);
    const p2 = await ctx.newPage(); await p2.goto(`${ORIGIN}/terms`); await removeSession(p2);
    await page.bringToFront();
    await endsSignedOut(page, log);
    await ctx.close();
  });
  await t(`[${width}] session ends with no signal BEFORE the voice take: record, ends on Sign in to answer, nothing uploaded as a person`, async () => {
    const { A, ctx, log } = await sw(width);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/surveys/s1`); await toQ3(page);
    await removeSession(page); // same tab: no storage event
    await record(page);
    await endsSignedOut(page, log);
    await ctx.close();
  });
  await t(`[${width}] session ends BEFORE Send (server answers 401): ends on Sign in to answer; same person signs in again: answers restored, exactly 1 response`, async () => {
    const { A, ctx, log } = await sw(width);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/surveys/s1`); await toQ3(page);
    await removeSession(page);
    await page.getByRole('button', { name: 'Skip' }).filter({ visible: true }).first().click();
    await endsSignedOut(page, log);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/sign-in/, { timeout: 8000 });
    assert.ok(decodeURIComponent(page.url()).includes('next=/surveys/s1'));
    await signIn(page, A);
    await page.goto(`${ORIGIN}/surveys/s1`);
    await page.getByText('Question 3 of 3').waitFor();
    await page.getByRole('button', { name: 'Skip' }).filter({ visible: true }).first().click();
    await page.getByText('Thanks. Your answers are in.').waitFor({ timeout: 10000 });
    assert.deepEqual(log.responses, ['A']);
    await ctx.close();
  });
  await t(`[${width}] a normal run, start to done: 1 response`, async () => {
    const { A, ctx, log } = await sw(width);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/surveys/s1`); await toQ3(page);
    await record(page);
    await page.getByTestId('voice-ready').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Thanks. Your answers are in.').waitFor({ timeout: 10000 });
    assert.deepEqual(log.responses, ['A']); assert.equal(log.clips, 1);
    assert.equal(await page.getByText('Sign in to answer').count(), 0);
    await ctx.close();
  });
}
await browser.close();
console.log(`${passed} ok, ${failed} FAILED`);
process.exit(failed ? 1 : 0);
