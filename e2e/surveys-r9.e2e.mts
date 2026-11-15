// V-SURVEYS round 9: the survey on the one rule (main's draft-owner), against the built app, API and sign-in host stubbed in the browser.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/surveys-r9.e2e.mts
import assert from 'node:assert/strict';
import type { Page, Route } from 'playwright-core';
import { launch, newWorld, signIn, seedDraft, draftKeys, world, ORIGIN } from './round7-stub.mts';

const SHOTS = process.env.SHOTS ?? 'docs/lead/proof/surveys-r9';
const LINE = 'You are signed in as someone else in another tab. Nothing was saved. Reload to carry on.';
const opt = (id: string, label: string) => ({ id, label });
const survey = { id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: 'How do you keep cool when there is no light?', questionCount: 3, note: 'n', myStatus: 'OPEN', voiceMaxSeconds: 30, ageBands: ['18-24'],
  questions: [{ id: 'q1', position: 1, kind: 'SINGLE_CHOICE', prompt: 'How do you keep cool?', options: [opt('o1', 'A fan'), opt('o2', 'Cold drinks')] }, { id: 'q2', position: 2, kind: 'TEXT', prompt: 'What do you miss most?', options: [] }, { id: 'q3', position: 3, kind: 'VOICE', prompt: 'Tell us more', options: [] }] };
const card = { id: 's1', label: 'Sponsored Survey', brandName: 'Zobo Fresh', brandSlug: 'zobo-fresh', brandWebsite: null, title: survey.title, questionCount: 3 };

const browser = await launch();
let failed = 0, passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

async function surveyWorld(width: number, start?: { access: string; refresh: string }) {
  const { w, person } = world();
  const A = person('A'), B = person('B');
  const ctx = await newWorld(browser, width, w, start);
  const log = { purposes: [] as string[], responses: [] as { sub: string; body: any }[], events: [] as string[] };
  await ctx.route('**/api/v1/**', async (route: Route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const token = (req.headers()['authorization'] ?? '').replace('Bearer ', '');
    const sub = w.subOf.get(token) ?? '';
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    if (m === 'POST' && p === '/voice-clips') log.purposes.push(body?.purpose);
    if (p === '/surveys/placement') return ok({ survey: card });
    if (p === '/surveys/s1' && m === 'GET') return sub ? ok(survey) : ok({ error: { code: 'UNAUTHORIZED', message: 'sign in' } }, 401);
    if (p === '/surveys/s1/events') { log.events.push(body?.kind + ':' + sub); return route.fulfill({ status: 204 }); }
    if (p === '/surveys/s1/responses') { log.responses.push({ sub, body }); return ok({ ok: true, note: '' }, 201); }
    return route.fallback();
  });
  return { w, A, B, ctx, log };
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/r9-${name}.png` });
async function record(page: Page) {
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: 'Stop recording' }).click();
}
async function toVoiceQuestion(page: Page) {
  await page.getByRole('radio', { name: 'Cold drinks' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 2 of 3').waitFor();
  await page.getByRole('textbox').fill('The fridge');
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 3 of 3').waitFor();
}

for (const width of [390, 1440]) {
  await t(`d1 [${width}] one person: card on Home, choice, written, voice (record, Send), done: 1 clip SURVEY_ANSWER, 1 answer`, async () => {
    const { w, A, ctx, log } = await surveyWorld(width);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/`);
    const cardEl = page.locator('section[aria-label="Sponsored Survey from Zobo Fresh"]');
    await cardEl.waitFor({ timeout: 10000 });
    await cardEl.scrollIntoViewIfNeeded();
    await shot(page, `home-card-${width}`);
    await page.getByRole('link', { name: 'Start the survey' }).click();
    await page.waitForURL(/\/surveys\/s1/);
    await toVoiceQuestion(page);
    await record(page);
    await page.getByTestId('voice-ready').waitFor({ timeout: 10000 });
    await shot(page, `voice-ready-${width}`);
    await page.getByRole('button', { name: 'Send answer' }).click();
    await page.getByText('Thanks. Your answers are in.').waitFor({ timeout: 10000 });
    await shot(page, `done-${width}`);
    console.log(`     clips ${w.clips.length} purposes ${JSON.stringify(log.purposes)} responses ${log.responses.length} sub ${log.responses[0]?.sub} answers ${JSON.stringify(log.responses[0]?.body?.answers)}`);
    assert.equal(w.clips.length, 1); assert.deepEqual(log.purposes, ['SURVEY_ANSWER']);
    assert.equal(log.responses.length, 1); assert.equal(log.responses[0].sub, 'A');
    assert.equal(log.responses[0].body.answers.length, 3); assert.ok(log.responses[0].body.answers[2].clipId);
    assert.equal(await page.getByText(LINE).count(), 0);
    await ctx.close();
  });
  await t(`d2 [${width}] two people: A's survey tab on the voice question, B signs in in tab 2, A records: nothing as B, nothing sent, line shown, B's kept recording untouched`, async () => {
    const { w, A, B, ctx, log } = await surveyWorld(width, undefined);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/surveys/s1`);
    await toVoiceQuestion(page);
    await page.waitForTimeout(3000);
    const p2 = await ctx.newPage(); await p2.goto(`${ORIGIN}/terms`);
    await signIn(p2, B); await seedDraft(p2, { slot: 'rec:B', owner: 'B', key: 'kept-B', queued: false });
    await page.getByRole('button', { name: 'Start recording' }).click().catch(() => undefined);
    await page.waitForTimeout(2800);
    await page.getByRole('button', { name: 'Stop recording' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    for (const x of ['Send answer', 'Delete', 'Record again']) { const el = page.getByRole('button', { name: x }); if (await el.count()) await el.first().click().catch(() => undefined); }
    await page.waitForTimeout(1200);
    await shot(page, `two-people-${width}`);
    const line = await page.getByText(/signed in as someone else in another tab/).count();
    const keys = await draftKeys(p2);
    console.log(`     clips ${w.clips.length} (as B: ${w.clips.filter((c) => c.sub === 'B').length}), responses ${log.responses.length}, posts ${w.posts.length}, deleted ${w.deleted}, line ${line}, B kept ${JSON.stringify(keys)}`);
    assert.equal(w.clips.length, 0); assert.equal(log.responses.length, 0); assert.equal(w.posts.length, 0); assert.equal(w.deleted, 0);
    assert.ok(line >= 1, 'the line is shown');
    assert.deepEqual(keys, [{ slot: 'rec:B', key: 'kept-B' }]);
    await ctx.close();
  });
}

await t('d3 [390] a guest opens a survey and is asked to sign in, signs in, comes back, answers once', async () => {
  const { w, A, ctx, log } = await surveyWorld(390, undefined);
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/surveys/s1`);
  await page.getByText('Sign in to answer').waitFor({ timeout: 10000 });
  await shot(page, 'guest-sign-in-390');
  assert.equal(log.responses.length, 0);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/sign-in/, { timeout: 8000 });
  assert.ok(decodeURIComponent(page.url()).includes('next=/surveys/s1'));
  await signIn(page, A);
  await page.goto(`${ORIGIN}/surveys/s1`);
  await page.getByRole('radio', { name: 'Cold drinks' }).click();
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 2 of 3').waitFor();
  await page.getByRole('textbox').fill('The fridge');
  await page.getByRole('button', { name: 'Send answer' }).click();
  await page.getByText('Question 3 of 3').waitFor();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByText('Thanks. Your answers are in.').waitFor({ timeout: 10000 });
  console.log(`     responses ${log.responses.length} as ${log.responses[0]?.sub}, clips ${w.clips.length}`);
  assert.equal(log.responses.length, 1); assert.equal(log.responses[0].sub, 'A');
  await ctx.close();
});

// The voice reply door is the phone dock (dt:hidden in ThreadScreen); the desktop thread has no voice reply, so this runs at 390 only.
for (const width of [390]) {
  await t(`b [${width}] a voice reply: 1 clip (REPLY), 1 reply as A, the line never shown`, async () => {
    const { w, A, ctx } = await surveyWorld(width);
    const page = await ctx.newPage(); await page.goto(`${ORIGIN}/terms`); await signIn(page, A);
    await page.goto(`${ORIGIN}/q/q1/a/a1`);
    await page.getByRole('button', { name: 'Reply by voice' }).locator('visible=true').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'I agree' }).click();
    await record(page);
    await page.getByRole('button', { name: /^Send/ }).first().click();
    await page.waitForTimeout(2500);
    const replies = w.posts.filter((p) => /replies$/.test(p.path));
    console.log(`     clips ${w.clips.length}, replies ${replies.length} as ${replies[0]?.sub}`);
    assert.equal(w.clips.length, 1); assert.equal(replies.length, 1); assert.equal(replies[0].sub, 'A');
    assert.equal(await page.getByText(/signed in as someone else/).count(), 0);
    await ctx.close();
  });
}

await browser.close();
console.log(failed ? `FAILED ${failed}, passed ${passed}` : `ALL PASSED ${passed}`);
process.exit(failed ? 1 : 0);
