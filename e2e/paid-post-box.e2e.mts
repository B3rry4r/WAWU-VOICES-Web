// V-PAID-POST-BOX proof against the built app (next start) with the API and the pay page stubbed in the browser. No live service.
//   npx next build && npx next start -p 3977 &   then ORIGIN=http://127.0.0.1:3977 npx tsx e2e/paid-post-box.e2e.mts
import { chromium, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3977';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const tok = 'h.' + Buffer.from(JSON.stringify({ sub: 'A' })).toString('base64url') + '.s';
const QID = '33333333-3333-4333-8333-333333333333';
const now = () => new Date().toISOString();
const WORDS = 'My honest answer about the country';
const question = { id: QID, kind: 'DAILY', status: 'LIVE', text: 'How do you feel about Nigeria right now?', hint: null, moodOptions: [], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const allowance = (free: number, bal: number) => ({ freePostsRemaining: free, balanceMilli: bal, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] });
const tier = { id: '11111111-1111-4111-8111-111111111111', slug: 'entry', name: 'Entry', priceKobo: 10000, unitsMilli: 100000, bonusMilli: 0, effectiveKoboPerUnit: 100, baseKoboPerUnit: 100, quote: { amountKobo: 10000, vatKobo: 750, chargeKobo: 150, totalKobo: 10900 } };
const PAY = '22222222-2222-4222-8222-222222222222';
const payment = { id: PAY, kind: 'UNITS', status: 'SUCCEEDED', amountKobo: 10000, vatKobo: 750, chargeKobo: 150, totalKobo: 10900, txRef: 'voices-1', title: 'Entry pack', unitsMilli: 100000, bonusMilli: 0, method: 'card', cardLast4: '4242', receiptNo: 'R1', failureReason: null, balanceMilli: 100000, createdAt: now(), verifiedAt: now(), token: null };
const answer = { id: 'new1', questionId: QID, author: { id: 'u1', handle: 'a.h', displayName: 'A', state: null, avatarUrl: null }, kind: 'TEXT', body: WORDS, clip: null, createdAt: now(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null };

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

async function open(w: number, free = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const posts: number[] = [];
  let paid = free;
  await ctx.route('**/__pay', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<script>paid=1;location.replace('${ORIGIN}/units/done?paymentId=${PAY}&status=successful&transaction_id=123')</script>` }));
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (m === 'POST' && p === `/questions/${QID}/answers`) {
      if (!paid) { posts.push(402); return ok({ error: { code: 'FREE_POSTS_EXHAUSTED', message: 'No free posts left.' } }, 402); }
      posts.push(201);
      return ok({ answer, charge: { costMilli: 5000, freeLeft: 0, balanceMilli: 95000 }, allowances: allowance(0, 95000) }, 201);
    }
    if (m === 'POST' && p === '/payments') return ok({ paymentId: PAY, checkoutUrl: ORIGIN + '/__pay', expiresAt: new Date(Date.now() + 36e5).toISOString() }, 201);
    if (p === `/payments/${PAY}/verify` || p === `/payments/${PAY}`) { if (m === 'POST' || p === `/payments/${PAY}`) paid = true; return ok(payment); }
    if (p === '/units/tiers') return ok({ vatRateBps: 750, tiers: [tier], minPackKobo: 10000, costs, extraVoice: [] });
    if (p === '/wallet') return ok({ balanceMilli: paid ? 95000 : 0, freePostsRemaining: 0, freePostsUsed: 10, allowances: allowance(0, 0), costs, tokens: [] });
    if (p === `/questions/${QID}` || p === '/questions/today') return ok(question);
    if (p === `/questions/${QID}/answers`) return ok({ items: [], nextCursor: null });
    if (p === '/config/public') return ok({ currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] });
    if (p === '/me/allowance') return ok(allowance(0, paid ? 95000 : 0));
    if (p === '/subscription-plans') return ok({ plans: [] });
    return ok({ items: [] });
  });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/terms`);
  await page.evaluate((a) => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: a, refreshToken: 'r' })), tok);
  return { page, posts };
}
const box = (page: Page) => page.getByRole('textbox');

for (const w of (process.env.W ? [Number(process.env.W)] : [390, 1440])) {
  await t(`[${w}] type, out of posts, buy, payment done, back to write: empty box, one post`, async () => {
    const { page, posts } = await open(w);
    await page.goto(`${ORIGIN}/q/${QID}/write`);
    await box(page).fill(WORDS);
    await page.getByRole('button', { name: /^Post/ }).click();
    await page.getByRole("link", { name: /^Get tokens/ }).click();
    await page.waitForURL(/\/units\/buy/);
    await page.getByRole('button', { name: /^Pay / }).click();
    await page.getByText('Your answer is posted').waitFor();
    console.log(`     [${w}] banner shown, post calls so far: ${JSON.stringify(posts)}`);
    await page.goto(`${ORIGIN}/q/${QID}/write`);
    await box(page).waitFor();
    const v = await box(page).inputValue();
    assert.equal(v, '');
    assert.deepEqual(posts, [402, 201]);
    assert.equal(posts.filter((s) => s === 201).length, 1);
    console.log(`     [${w}] write box value: ${JSON.stringify(v)}; answers route calls: ${JSON.stringify(posts)} (1 refused, 1 posted)`);
  });
  await t(`[${w}] a full page load of the payment-done page again: still empty, still one post`, async () => {
    const { page, posts } = await open(w);
    await page.goto(`${ORIGIN}/q/${QID}/write`);
    await box(page).fill(WORDS);
    await page.getByRole('button', { name: /^Post/ }).click();
    await page.getByRole("link", { name: /^Get tokens/ }).click();
    await page.waitForURL(/\/units\/buy/);
    await page.getByRole('button', { name: /^Pay / }).click();
    await page.getByText('Your answer is posted').waitFor();
    await page.reload();
    await page.waitForTimeout(1500);
    await page.goto(`${ORIGIN}/q/${QID}/write`);
    assert.equal(await box(page).inputValue(), '');
    assert.equal(posts.filter((s) => s === 201).length, 1);
  });
  await t(`[${w}] record screen: pick a word, Type it instead, type, Send: 1 post`, async () => {
    const { page, posts } = await open(w, true);
    await page.route('**/api/v1/questions/'+QID+'', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...question, moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'] }) }));
    await page.route('**/api/v1/me/allowance', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(allowance(5, 0)) }));
    await page.goto(`${ORIGIN}/q/${QID}/mood`); await page.getByRole('group', { name: 'Pick one word' }).waitFor();
    await page.getByRole('button', { name: /^HOPEFUL/ }).click();
    await page.getByRole('button', { name: /Type it instead/ }).click();
    await box(page).fill('Typed from the record screen');
    await page.getByRole('button', { name: /^(Send|Post)/ }).first().click();
    await page.waitForTimeout(1500);
    console.log(`     [${w}] record screen post calls: ${JSON.stringify(posts)}`);
    assert.equal(posts.length, 1);
  });
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL OK');
process.exit(failed ? 1 : 0);
