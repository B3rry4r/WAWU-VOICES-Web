// Round 9 fix 1, built app, API and sign-in stubbed in the browser. Prints what is shown and which calls went out.
//   ORIGIN=http://127.0.0.1:3977 [SURVEY=1] npx tsx e2e/surveys-r9-fix1.e2e.mts      (run it on this branch and on a build of origin/main)
import assert from 'node:assert/strict';
import type { Page, Route } from 'playwright-core';
import { launch, newWorld, signIn, world, ORIGIN } from './round7-stub.mts';

const SURVEY = process.env.SURVEY === '1';
const LINE = /signed in as someone else in another tab/;
const opt = (id: string, label: string) => ({ id, label });
const survey = { id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 't', questionCount: 2, note: 'n', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24'],
  questions: [{ id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool?', options: [opt('o1', 'A fan'), opt('o2', 'Cold drinks')] }, { id: 'q2', position: 2, kind: 'VOICE', prompt: 'Tell us more', options: [] }] };
const browser = await launch();
let failed = 0;

async function run(width: number, mode: 'signout' | 'otherperson') {
  const { w, person } = world(); const A = person('A'), B = person('B');
  const ctx = await newWorld(browser, width, w, A);
  const calls: string[] = [];
  await ctx.route('**/api/v1/**', async (route: Route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    if (m !== 'GET') calls.push(`${m} ${p} ${req.headers()['authorization'] ? 'bearer' : 'no-bearer'}`);
    if (SURVEY && p === '/surveys/s1' && m === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(survey) });
    if (SURVEY && p === '/surveys/s1/events') return route.fulfill({ status: 204 });
    if (SURVEY && p === '/surveys/s1/responses') { calls.push('RESPONSE'); return route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true,"note":""}' }); }
    return route.fallback();
  });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
  if (SURVEY) {
    await page.goto(`${ORIGIN}/surveys/s1`);
    await page.getByRole('radio', { name: 'Cold drinks' }).click();
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Question 2 of 2').waitFor();
  } else {
    await page.goto(`${ORIGIN}/q/q1/speak`);
    await page.getByRole('group', { name: 'Pick one word' }).waitFor();
    await page.getByRole('button', { name: /^HOPEFUL/ }).click();
    await page.getByRole('button', { name: /^Say it in/ }).click();
  }
  await page.getByRole('button', { name: 'Start recording' }).click(); await page.waitForTimeout(1500); await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.waitForTimeout(SURVEY ? 2500 : 800);
  const callsBefore = calls.length;
  const p2 = await ctx.newPage(); await p2.goto(`${ORIGIN}/terms`);
  if (mode === 'signout') await p2.evaluate(() => localStorage.removeItem('voices-web-session'));
  else await signIn(p2, B);
  await page.waitForTimeout(800);
  const send = page.getByRole('button', { name: /^Send/ }).first();
  if (await send.count()) await send.click({ timeout: 3000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  const line = await page.getByText(LINE).count();
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
  const after = calls.slice(callsBefore);
  console.log(`[${width}] ${SURVEY ? 'survey' : 'record'} ${mode}: line ${line}, url ${new URL(page.url()).pathname}, clips ${w.clips.length}, posts ${w.posts.length} (as B ${w.posts.filter((x) => x.sub === 'B').length}, clips as B ${w.clips.filter((x) => x.sub === 'B').length}), calls after the other tab: ${JSON.stringify(after)}`);
  console.log(`      shows: ${body}`);
  await ctx.close();
  return { line, w, after };
}
for (const width of [390, 1440]) {
  const a = await run(width, 'signout');
  const b = await run(width, 'otherperson');
  if (process.env.EXPECT === 'branch') {
    try { assert.equal(a.line, 0); assert.equal(b.line >= 1, true); assert.equal(b.w.clips.length, 0); assert.equal(b.w.posts.length, 0); } catch (e) { failed++; console.log('FAIL', (e as Error).message); }
  }
}
await browser.close();
console.log(failed ? 'FAILED' : 'done');
process.exit(failed ? 1 : 0);
