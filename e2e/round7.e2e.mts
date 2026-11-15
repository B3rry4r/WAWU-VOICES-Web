// V-SURVEYS round 7 proof on the built app. Run: npx next build && npx next start -p 3990 &  then  npx tsx e2e/round7.e2e.mts
// Fake microphone, API and sign-in host answered inside the browser (e2e/round7-stub.mts). No live service.
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { launch, world, newWorld, signIn, stored, seedDraft, draftKeys, jwt, ORIGIN } from './round7-stub.mts';

const browser = await launch();
let failed = 0, passed = 0;
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => {
  if (only && !name.includes(only)) return;
  try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '  ' + (e as Error).message.split('\n')[0]); }
};
const STALE = /signed in as someone else/;

async function pick(page: Page) {
  await page.goto(`${ORIGIN}/q/q1/speak`);
  for (const w of ['Pick one word', 'ANGRY', 'TIRED', 'PROUD', 'HOPEFUL', 'Say it in 60 seconds', 'Type it instead', 'Share my word']) await page.getByText(w, { exact: false }).first().waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'PROUD' }).click();
}
async function voice(page: Page, waitPosted = true) {
  await pick(page);
  await page.getByRole('button', { name: /^Say it in 60 seconds/ }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByRole('button', { name: /^Send/ }).click();
  if (waitPosted) await page.waitForURL(/\/posted/, { timeout: 15000 });
}
async function typed(page: Page) {
  await pick(page);
  await page.getByRole('button', { name: 'Type it instead' }).click();
  await page.getByRole('textbox').fill('Salary goes in two hours.');
  await page.getByRole('button', { name: /^Post/ }).click();
  await page.waitForURL(/\/posted/, { timeout: 15000 });
}
const counts = (w: ReturnType<typeof world>['w']) => `clips ${w.clips.length}, posts ${w.posts.length}, refresh ${w.refreshLog.length}`;

for (const width of [390, 1440]) {
  await t(`${width}: voice, 10 plain runs: 1 clip, 1 post, no refresh, no stale line`, async () => {
    for (let i = 1; i <= 10; i++) {
      const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, width, w, A); const page = await ctx.newPage();
      await voice(page);
      assert.equal(w.clips.length, 1); assert.equal(w.posts.length, 1); assert.equal(w.refreshLog.length, 0);
      assert.equal(await page.getByText(STALE).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'sideways scroll');
      if (i === 1 || i === 10) console.log(`     run ${i}: ${counts(w)}`);
      await ctx.close();
    }
  });
  await t(`${width}: typed, 10 plain runs: 1 post each`, async () => {
    for (let i = 1; i <= 10; i++) {
      const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, width, w, A); const page = await ctx.newPage();
      await typed(page);
      assert.equal(w.clips.length, 0); assert.equal(w.posts.length, 1); assert.equal(w.refreshLog.length, 0);
      assert.equal(await page.getByText(STALE).count(), 0);
      if (i === 1 || i === 10) console.log(`     run ${i}: ${counts(w)}`);
      await ctx.close();
    }
  });
}

for (const step of ['/voice-clips', '/complete', '/voice-clips/c1', '/questions/q1/answers']) {
  await t(`voice: token runs out at ${step}: one refresh, 1 clip, 1 post, no stale line`, async () => {
    const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
    w.expireAt = step; await voice(page);
    console.log(`     ${counts(w)}, post keys ${w.posts.map((p) => p.key?.slice(0, 8)).join(',')}`);
    assert.equal(w.refreshLog.length, 1); assert.equal(w.posts.length, 1); assert.equal(w.posts.every((p) => p.sub === 'A'), true);
    assert.equal(w.clips.length, 1); assert.equal(await page.getByText(STALE).count(), 0);
    await ctx.close();
  });
}
await t('typed: token runs out at the post: one refresh, 1 post', async () => {
  const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
  w.expireAt = '/questions/q1/answers'; await typed(page);
  console.log(`     ${counts(w)}`);
  assert.equal(w.refreshLog.length, 1); assert.equal(w.posts.length, 1); assert.equal(w.clips.length, 0);
  await ctx.close();
});

await t('offline then back, two tabs of A open: 1 clip, 1 post', async () => {
  const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
  await pick(page); await page.getByRole('button', { name: /^Say it in 60 seconds/ }).click();
  await page.getByRole('button', { name: 'Start recording' }).click(); await page.waitForTimeout(1300); await page.getByRole('button', { name: 'Stop recording' }).click();
  const p2 = await ctx.newPage(); await p2.goto(`${ORIGIN}/terms`);
  w.offline = true;
  await page.getByRole('button', { name: /^Send/ }).click(); await page.waitForTimeout(1500);
  assert.equal(w.posts.length, 0);
  w.offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); await p2.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(5000);
  console.log(`     ${counts(w)}, kept after: ${JSON.stringify(await draftKeys(page))}`);
  assert.equal(w.clips.length, 1); assert.equal(w.posts.length, 1);
  await ctx.close();
});

/** H1: A's saved recording is sent by the outbox; A's token runs out at the post; B signs in in tab 2 while the refresh waits. */
for (const kind of ['answer', 'reply'] as const) {
  await t(`H1 outbox ${kind}: A's token runs out at the post, B signs in during the wait: no post as B, B's tokens untouched`, async () => {
    const { w, person } = world(); const A = person('A'); const B = person('B'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/terms`);
    await seedDraft(page, { slot: 'rec:A', owner: 'A', key: 'kept-' + kind, queued: true, ...(kind === 'reply' ? { reply: { answerId: 'a1', stance: 'AGREE' } } : {}) });
    w.expireAt = kind === 'reply' ? '/replies' : '/questions/q1/answers';
    let release!: () => void; w.gate = new Promise<void>((r) => { release = r; });
    const p2 = await ctx.newPage(); await p2.goto(`${ORIGIN}/terms`);
    w.onRefresh = () => { w.onRefresh = null; void (async () => { await signIn(p2, B); release(); })(); };
    await page.goto(`${ORIGIN}/`); await page.waitForTimeout(6000);
    const bPosts = w.posts.filter((p) => p.sub === 'B'); const aPosts = w.posts.filter((p) => p.sub === 'A');
    const bRefreshUsed = w.refreshLog.filter((r) => r.startsWith('rB'));
    console.log(`     posts as A ${aPosts.length}, as B ${bPosts.length}; B refresh tokens spent ${bRefreshUsed.length}; stored ${JSON.stringify((await stored(page))?.refreshToken)}; kept ${JSON.stringify(await draftKeys(page))}`);
    assert.equal(bPosts.length, 0); assert.equal(bRefreshUsed.length, 0);
    assert.equal((await stored(page))?.accessToken, B.access); assert.equal((await stored(page))?.refreshToken, B.refresh);
    // main's rule (draft-owner): a signed-in person's load removes recordings other people left behind, so A's copy may be gone; what matters is no post as B.
    await ctx.close();
  });
  await t(`H1 outbox ${kind}: A alone, token runs out at the post: sent once`, async () => {
    const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/terms`);
    await seedDraft(page, { slot: 'rec:A', owner: 'A', key: 'kept-' + kind, queued: true, ...(kind === 'reply' ? { reply: { answerId: 'a1', stance: 'AGREE' } } : {}) });
    w.expireAt = kind === 'reply' ? '/replies' : '/questions/q1/answers';
    await page.goto(`${ORIGIN}/`); await page.waitForTimeout(6000);
    console.log(`     ${counts(w)}, posts ${w.posts.map((p) => p.sub + ':' + p.key).join(',')}, kept ${JSON.stringify(await draftKeys(page))}`);
    assert.equal(w.posts.length, 1); assert.equal(w.posts[0].sub, 'A'); assert.equal(w.clips.length, 1); assert.equal((await draftKeys(page)).length, 0);
    await ctx.close();
  });
}

// M2 (A's kept recording survives B's visit) belonged to the per-person slot design that was dropped; main's draft-owner rule removes it when B loads (pinned by tests/draft-owner.test.tsx).

await browser.close();
console.log(failed ? `FAILED ${failed}, passed ${passed}` : `ALL PASSED ${passed}`);
process.exit(failed ? 1 : 0);
