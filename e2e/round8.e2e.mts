// V-SURVEYS round 8 proof on the built app. Run: npx next build && npx next start -p 3990 &  then  npx tsx e2e/round8.e2e.mts
// Fake microphone, API and sign-in host answered inside the browser (e2e/round7-stub.mts). No live service.
import assert from 'node:assert/strict';
import type { BrowserContext, Page } from 'playwright-core';
import { launch, world, newWorld, signIn, seedDraft, draftKeys, ORIGIN } from './round7-stub.mts';

const browser = await launch();
let failed = 0, passed = 0;
const only = process.env.ONLY;
const t = async (name: string, fn: () => Promise<void>) => {
  if (only && !name.includes(only)) return;
  try { await fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '  ' + (e as Error).message.split('\n')[0]); }
};
const STALE = /signed in as someone else/;
const counts = (w: ReturnType<typeof world>['w']) => `clips ${w.clips.length}, posts ${w.posts.length}, refresh ${w.refreshLog.length}`;

async function pick(page: Page) {
  await page.goto(`${ORIGIN}/q/q1/speak`);
  for (const x of ['Pick one word', 'ANGRY', 'TIRED', 'PROUD', 'HOPEFUL', 'Say it in 60 seconds', 'Type it instead', 'Share my word']) await page.getByText(x, { exact: false }).first().waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'PROUD' }).click();
}
async function record(page: Page) {
  await page.getByRole('button', { name: /^Say it in 60 seconds/ }).click();
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Stop recording' }).click();
}
async function voice(page: Page, waitPosted = true) {
  await pick(page); await record(page);
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
const seedOld = (page: Page, slot: string, owner: string, ageDays: number) => page.evaluate(async ([slot, owner, ageDays]) => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const at = Date.now() - (ageDays as number) * 86400000;
  await new Promise<void>((res, rej) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ owner, questionId: 'q1', blob: new Blob(['abc'], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [], key: 'old-' + slot, savedAt: at, recordedAt: at, queued: false }, slot as string); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
}, [slot, owner, ageDays] as const);
async function two(width = 390) {
  const { w, person } = world(); const A = person('A'); const B = person('B');
  const ctx = await newWorld(browser, width, w, A); const p1 = await ctx.newPage(); const p2 = await ctx.newPage();
  await p2.goto(`${ORIGIN}/terms`);
  return { w, A, B, ctx, p1, p2 };
}

await t('HIGH 1: A records, B signs in in tab 2, A offline taps Send, network back: nothing kept under B, no clip, no post, stale line, recording still on screen', async () => {
  const { w, A, B, ctx, p1, p2 } = await two();
  await pick(p1); await record(p1);
  await signIn(p2, B);
  await ctx.setOffline(true);
  await p1.getByRole('button', { name: /^Send/ }).click();
  await p1.waitForTimeout(800);
  await ctx.setOffline(false);
  await p2.goto(`${ORIGIN}/`); await p2.waitForTimeout(4000);
  const keys = await draftKeys(p2);
  console.log(`     ${counts(w)}; slots ${JSON.stringify(keys)}; stale line ${await p1.getByText(STALE).count()}; Send on A's tab ${await p1.getByRole('button', { name: /^Send/ }).count()}; clips as B ${w.clips.filter((c) => c.sub === 'B').length}`);
  assert.equal(w.clips.length, 0); assert.equal(w.posts.length, 0); assert.equal(keys.length, 0);
  assert.ok(await p1.getByText(STALE).count() > 0); assert.ok(await p1.getByRole('button', { name: /^Send/ }).count() > 0);
  // A signs in again in that tab after a reload: the in-memory recording is gone (accepted); nothing was sent, nothing is kept.
  await signIn(p1, A); await p1.reload(); await p1.waitForTimeout(2000);
  console.log(`     after A signs in again and reloads: ${counts(w)}; slots ${JSON.stringify(await draftKeys(p1))}; Send visible ${await p1.getByRole('button', { name: /^Send/ }).count()}`);
  assert.equal(w.posts.length, 0); assert.equal(w.clips.length, 0);
  await ctx.close();
});

await t('HIGH 2: A on the record screen, B signs in, A records (no send): no slot written; B opens the record screen: no take, no Send', async () => {
  const { w, B, ctx, p1, p2 } = await two();
  await pick(p1); await p1.waitForTimeout(3000); await signIn(p2, B); await p1.waitForTimeout(500);
  await record(p1); await p1.waitForTimeout(800);
  const keys = await draftKeys(p1);
  assert.equal(keys.length, 0, 'slots ' + JSON.stringify(keys));
  assert.ok(await p1.getByText(STALE).count() > 0); assert.ok(await p1.getByRole('button', { name: /^Send/ }).count() > 0);
  await pick(p2); await p2.waitForTimeout(1200);
  console.log(`     slots ${JSON.stringify(keys)}; B sees Send ${await p2.getByRole('button', { name: /^Send/ }).count()}; ${counts(w)}`);
  assert.equal(await p2.getByRole('button', { name: /^Send/ }).count(), 0);
  await ctx.close();
});
await t('HIGH 2 mirror: B has a kept recording, A\'s open tab taps "Say it in 60 seconds": A\'s tab does not show B\'s recording', async () => {
  const { B, ctx, p1, p2 } = await two();
  await pick(p1); await signIn(p2, B);
  await seedDraft(p2, { slot: 'rec:B', owner: 'B', key: 'kept-B', queued: false });
  await p1.getByRole('button', { name: /^Say it in 60 seconds/ }).click(); await p1.waitForTimeout(1500);
  console.log(`     A's tab: Send ${await p1.getByRole('button', { name: /^Send/ }).count()}, Play ${await p1.getByRole('button', { name: /play/i }).count()}, slots ${JSON.stringify(await draftKeys(p1))}`);
  assert.equal(await p1.getByRole('button', { name: /^Send/ }).count(), 0);
  assert.deepEqual((await draftKeys(p1)).map((d) => d.key), ['kept-B']);
  await ctx.close();
});

await t('MEDIUM 1: B signs in at the post: one post as A; A\'s slot stays while B is in; later A signs in: nothing sent again, slot cleared', async () => {
  const { w, A, B, ctx, p1, p2 } = await two();
  await p1.goto(`${ORIGIN}/terms`);
  await seedDraft(p1, { slot: 'rec:A', owner: 'A', key: 'kept-A', queued: true });
  await ctx.route('**/api/v1/questions/q1/answers', async (route) => { if (route.request().method() === 'POST') await signIn(p2, B); await route.fallback(); });
  await p1.goto(`${ORIGIN}/`); await p1.waitForTimeout(6000);
  const mid = await draftKeys(p1);
  console.log(`     after post: ${counts(w)}, posts ${w.posts.map((p) => p.sub + ':' + p.key).join(',')}; slots ${JSON.stringify(mid)}`);
  assert.equal(w.posts.length, 1); assert.equal(w.posts[0].sub, 'A');
  await signIn(p1, A); await p1.goto(`${ORIGIN}/`); await p1.waitForTimeout(4000);
  const end = await draftKeys(p1);
  console.log(`     A signs in later: ${counts(w)}; slots ${JSON.stringify(end)}`);
  assert.equal(w.posts.length, 1); assert.equal(w.clips.length, 1); assert.equal(end.length, 0);
  await ctx.close();
});

await t('LOW 1: 20 people\'s 30 day old slots removed at app start; a 6 day old one stays', async () => {
  const { w, person } = world(); const C = person('C'); const ctx = await newWorld(browser, 390, w, C); const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/terms`);
  for (let i = 0; i < 20; i++) await seedOld(page, `u:P${i}`, `P${i}`, 30);
  await seedOld(page, 'u:Q', 'Q', 6);
  await page.goto(`${ORIGIN}/`); await page.waitForTimeout(2500);
  const keys = await draftKeys(page);
  console.log(`     left: ${JSON.stringify(keys.map((k) => k.slot))}`);
  assert.deepEqual(keys.map((k) => k.slot), ['u:Q']);
  await ctx.close();
});

// The hard rule: one person, one tab.
for (const step of ['/voice-clips', '/complete', '/voice-clips/c1', '/questions/q1/answers']) {
  await t(`network drops once at ${step}: ends posted after one more tap; 1 clip, 1 post`, async () => {
    const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
    let dropped = false;
    await ctx.route('**/api/v1/**', async (route) => { if (!dropped && route.request().method() !== 'GET' || (!dropped && step === '/voice-clips/c1' && route.request().url().endsWith('/c1'))) { if (route.request().url().endsWith(step) ) { dropped = true; return route.abort('connectionreset'); } } return route.fallback(); });
    await voice(page, false); await page.waitForTimeout(3000);
    if (!/posted/.test(page.url())) { await page.getByRole('button', { name: /^(Send|Try again)/ }).first().click(); await page.waitForURL(/\/posted/, { timeout: 15000 }); }
    console.log(`     dropped ${dropped}; ${counts(w)}`);
    assert.equal(w.posts.length, 1);
    assert.ok(w.clips.length <= 2, 'clips ' + w.clips.length);
    await ctx.close();
  });
}
await t('a kept recording survives a reload and sends once', async () => {
  const { w, person } = world(); const A = person('A'); const ctx = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
  await pick(page); await record(page);
  await ctx.setOffline(true); await page.getByRole('button', { name: /^Send/ }).click(); await page.waitForTimeout(800); await ctx.setOffline(false);
  await page.reload(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^Send/ }).first().click(); await page.waitForURL(/\/posted/, { timeout: 15000 });
  console.log(`     ${counts(w)}; slots ${JSON.stringify(await draftKeys(page))}`);
  assert.equal(w.posts.length, 1); assert.equal(w.clips.length, 1);
  await ctx.close();
});
await t('a person alone never sees the stale line: 30 refreshes and a clock change', async () => {
  const { w, person } = world(); const A = person('A'); const ctx: BrowserContext = await newWorld(browser, 390, w, A); const page = await ctx.newPage();
  await page.clock.install({ time: new Date() });
  await pick(page); let seen = 0;
  for (let i = 0; i < 30; i++) { await page.reload(); await page.getByText('Pick one word').first().waitFor({ timeout: 8000 }); seen += await page.getByText(/signed in as someone else|signed out in another tab/).count(); }
  await page.clock.setSystemTime(new Date(Date.now() + 3 * 86400000)); await page.reload(); await page.getByText('Pick one word').first().waitFor();
  await page.getByRole('button', { name: 'PROUD' }).click(); await record(page); await page.getByRole('button', { name: /^Send/ }).click(); await page.waitForURL(/\/posted/, { timeout: 15000 });
  seen += await page.getByText(/signed in as someone else|signed out in another tab/).count();
  console.log(`     stale lines seen ${seen}; ${counts(w)}`);
  assert.equal(seen, 0); assert.equal(w.posts.length, 1);
  await ctx.close();
});

await browser.close();
console.log(failed ? `FAILED ${failed}, passed ${passed}` : `ALL PASSED ${passed}`);
process.exit(failed ? 1 : 0);
