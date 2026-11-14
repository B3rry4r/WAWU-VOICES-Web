// V-FIX-A proof against the built app (next start) with the API stubbed in the browser.
//   npx next build && npx next start -p 3971 &   then ORIGIN=http://127.0.0.1:3971 npx tsx e2e/fixa.e2e.mts
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3971';
const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/fixa';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const me = { id: 'u1', handle: 'me.handle', displayName: 'Me Person', state: null, avatarUrl: null };
const other = { id: 'u2', handle: 'tunde.a', displayName: 'Tunde A', state: 'Lagos', avatarUrl: null };
const now = () => new Date().toISOString();
const answer = (over: object = {}) => ({ id: 'a1', questionId: 'q1', author: me, kind: 'TEXT', body: 'Salary goes in two hours.', clip: null, createdAt: now(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 1, agreeCount: 1, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null, ...over });
const reply = (over: object = {}) => ({ id: 'r1', answerId: 'a1', author: me, stance: 'AGREE', kind: 'TEXT', body: 'Same for me.', clip: null, createdAt: now(), status: 'PUBLISHED', isMine: true, helpfulCount: 0, ...over });
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'When salary arrives, how long before it is gone?', hint: null, moodOptions: [], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 10, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 10, costs, tiers: [], extraVoice: [] };
const allowance = (free = 5) => ({ freePostsRemaining: free, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] });
const topic = { questionCount: 5, id: 't1', weekNumber: 1, title: 'Salary and spending', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 10, voicesCount: 10 };
const poll = { id: 'p1', kind: 'DAILY', title: 'Will you spend it?', choiceMode: 'SINGLE', status: 'OPEN', publicInterest: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString(), questionId: 'q1', topicId: null, totalVotes: 2, options: [{ id: 'o1', label: 'Yes', votes: 1, percent: 50 }, { id: 'o2', label: 'No', votes: 1, percent: 50 }], myVote: ['o1'], costToVoteMilli: 0 };
const results = { pollId: 'p1', status: 'OPEN', totalVotes: 2, options: poll.options, leadingOptionId: 'o1', asOf: now(), myVote: ['o1'] };

const browser = await chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
let failed = 0;
const only = process.env.ONLY; const t = async (name: string, fn: () => Promise<void>) => { if (only && !name.includes(only)) return; try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

type Call = { method: string; path: string; body: Record<string, unknown> | null };
async function open(w: number, opts: { answers?: object[]; replies?: object[]; threads?: object[]; free?: number; postStatus?: number } = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width: w, height: w < 600 ? 844 : 900 } });
  await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    if (m !== 'GET') calls.push({ method: m, path: p, body });
    if (m === 'PATCH' && p === '/answers/a1') return ok(answer({ body: body.body, editedAt: now() }));
    if (m === 'DELETE' && (p === '/answers/a1' || p === '/replies/r1')) return route.fulfill({ status: 204 });
    if (m === 'POST' && p === '/answers/a2/replies') return ok({ reply: reply({ id: 'rv', kind: 'VOICE' }), charge: { costMilli: 0, freeLeft: 4, balanceMilli: 0 }, allowances: allowance() }, opts.postStatus ?? 201);
    if (m === 'POST' && p === '/polls/p1/explanation') return ok({ answer: answer({ kind: 'VOICE' }) }, 201);
    if (m === 'POST' && p === '/reports') return ok({ id: 'rep1', blocked: false }, 201);
    if (m === 'POST' && p === '/support/messages') return ok({ id: 's1' }, 201);
    if (p === '/voice-clips' && m === 'POST') return ok({ clip: { id: 'c1', status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201);
    if (p === '/voice-clips/c1/complete') return ok({ id: 'c1', status: 'PROCESSING' });
    if (p === '/voice-clips/c1') return ok({ id: 'c1', status: 'READY' });
    if (p === '/questions/q1') return ok(question);
    if (p === '/questions/q1/answers') return ok({ items: (opts.answers ?? [answer()]).map((a) => ({ type: 'answer', answer: a })), nextCursor: null });
    if (p === '/questions/q1/polls') return ok({ items: [poll] });
    if (p === '/polls/p1') return ok(poll);
    if (p === '/polls/p1/results') return ok(results);
    if (p === '/answers/a1') return ok(answer());
    if (p === '/answers/a2') return ok(answer({ id: 'a2', author: other, isMine: false }));
    if (p === '/answers/a1/replies') return ok({ items: opts.replies ?? [reply()], nextCursor: null, counts: { agree: 1, disagree: 0, experience: 0 } });
    if (p === '/answers/a2/replies') return ok({ items: [], nextCursor: null, counts: { agree: 0, disagree: 0, experience: 0 } });
    if (p === '/result-threads') return ok({ items: opts.threads ?? [], nextCursor: null });
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance(opts.free));
    if (p === '/me') return ok({ phoneMasked: '+234 803 *** 4412', id: 'u1', wawuId: 'w', handle: 'me.handle', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { id: 'u1', handle: 'me.handle', displayName: 'Me Person', bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Enugu', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance(), unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 } });
    if (p === '/home') return ok({ topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Me' });
    if (p === '/topics/current') return ok(topic);
    if (p === '/questions/today') return ok(question);
    return ok({ items: [] });
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();
  return { page, calls, ctx };
}
const shot = async (page: Page, name: string) => { await page.waitForTimeout(450); return page.screenshot({ path: `${SHOTS}-${name}.png` }); };
const find = (calls: Call[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);

try {
  // ---- 1. own post: Edit and Delete; others see only Report
  for (const w of [390, 1440]) {
    await t(`own text answer menu at ${w}: Edit sends PATCH, Delete asks first and sends DELETE`, async () => {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/q/q1`);
      await page.getByRole('button', { name: /^More:/ }).first().click();
      await page.getByRole('button', { name: 'Edit this post' }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Report this voice' }).count(), 0, 'own post still offers Report');
      await shot(page, `menu-own-${w}`);
      await page.getByRole('button', { name: 'Edit this post' }).click();
      await page.getByLabel('Your words').fill('Salary goes in one hour.');
      await shot(page, `edit-${w}`);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Your post is updated.').waitFor();
      assert.deepEqual(find(calls, 'PATCH', '/answers/a1')[0].body, { body: 'Salary goes in one hour.' });
      assert.ok(await page.getByText('Salary goes in one hour.').first().isVisible());
      await page.getByRole('button', { name: /^More:/ }).first().click();
      await page.getByRole('button', { name: 'Delete this post' }).click();
      await page.getByText('Delete this voice?').waitFor();
      assert.equal(find(calls, 'DELETE', '/answers/a1').length, 0, 'deleted before the confirm');
      await shot(page, `delete-confirm-${w}`);
      await page.getByRole('button', { name: 'Keep it' }).click();
      assert.equal(find(calls, 'DELETE', '/answers/a1').length, 0);
      await page.getByRole('button', { name: /^More:/ }).first().click();
      await page.getByRole('button', { name: 'Delete this post' }).click();
      await page.getByRole('button', { name: 'Delete voice' }).click();
      await page.getByText('Your post is deleted.').waitFor();
      assert.equal(find(calls, 'DELETE', '/answers/a1').length, 1);
      const body = await page.locator('main').innerText();
      assert.ok(!/\b1 voices?\b/.test(body) && !/View 1 repl/.test(body), 'a count still includes the deleted post: ' + body.slice(0, 400));
      assert.ok(/0 voices/.test(body), 'count should read 0 voices');
      await shot(page, `after-delete-${w}`);
      await ctx.close();
    });
  }
  await t('own voice answer: Delete but no Edit; someone else: Report only', async () => {
    const { page, ctx } = await open(390, { answers: [answer({ id: 'a3', kind: 'VOICE', body: null, clip: { id: 'k1', status: 'READY', durationMs: 8000, transcript: null } }), answer({ id: 'a2', author: other, isMine: false })] });
    await page.goto(`${ORIGIN}/q/q1`);
    await page.getByRole('button', { name: /^More:/ }).first().click();
    await page.getByRole('button', { name: 'Delete this post' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Edit this post' }).count(), 0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^More:/ }).nth(1).click();
    await page.getByRole('link', { name: 'Report this voice' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Edit this post' }).count() + await page.getByRole('button', { name: 'Delete this post' }).count(), 0);
    await ctx.close();
  });
  await t('edit past the window shows the server words', async () => {
    const { page, ctx } = await open(390);
    await ctx.route('**/api/v1/answers/a1', (r) => r.request().method() === 'PATCH' ? r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'EDIT_WINDOW_PASSED', message: 'You can only edit within 5 minutes of posting.' } }) }) : r.fallback());
    await page.goto(`${ORIGIN}/q/q1`);
    await page.getByRole('button', { name: /^More:/ }).first().click();
    await page.getByRole('button', { name: 'Edit this post' }).click();
    await page.getByLabel('Your words').fill('Late edit');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('You can only edit within 5 minutes of posting.').waitFor();
    await shot(page, 'edit-refused-390');
    await ctx.close();
  });
  await t('own reply: Delete asks first, then DELETE /replies/r1', async () => {
    const { page, calls, ctx } = await open(390);
    await page.goto(`${ORIGIN}/q/q1/a/a1`);
    await page.getByRole('button', { name: 'Delete my reply' }).click();
    await page.getByText('Delete this reply?').waitFor();
    assert.equal(find(calls, 'DELETE', '/replies/r1').length, 0);
    await shot(page, 'reply-delete-390');
    await page.getByRole('button', { name: 'Delete reply' }).click();
    await page.getByText('Reply deleted.').waitFor();
    assert.equal(find(calls, 'DELETE', '/replies/r1').length, 1);
    await ctx.close();
  });

  // ---- 2. reply by voice
  for (const w of [390, 1440]) {
    await t(`reply by voice at ${w}: clip purpose REPLY, then POST replies kind VOICE`, async () => {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/q/q1/a/a2`);
      await (w === 1440 ? page.getByRole('button', { name: 'Use voice' }) : page.getByRole('button', { name: 'Reply by voice' })).click();
      await page.getByText('Pick how you are replying first.').waitFor();
      await shot(page, `reply-voice-pick-${w}`);
      await page.getByRole('button', { name: 'I disagree' }).last().click();
      await page.getByRole('button', { name: 'Start recording' }).click();
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Stop recording' }).click();
      await page.getByRole('button', { name: /^Send/ }).waitFor();
      await shot(page, `reply-voice-preview-${w}`);
      await page.getByRole('button', { name: /^Send/ }).click();
      await page.getByText('Reply posted.').waitFor({ timeout: 20000 });
      assert.equal(find(calls, 'POST', '/voice-clips')[0].body!.purpose, 'REPLY');
      const post = find(calls, 'POST', '/answers/a2/replies');
      assert.equal(post.length, 1);
      assert.equal(post[0].body!.kind, 'VOICE'); assert.equal(post[0].body!.clipId, 'c1'); assert.equal(post[0].body!.stance, 'DISAGREE');
      assert.ok(!('body' in post[0].body!));
      await ctx.close();
    });
  }

  // ---- 3. explain my vote by voice
  for (const w of [390, 1440]) {
    await t(`explain my vote by voice at ${w}: clip purpose VOTE_EXPLANATION, POST explanation kind VOICE`, async () => {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/q/q1/results`);
      await page.getByRole('button', { name: 'In words' }).waitFor();
      await shot(page, `explain-choice-${w}`);
      await page.getByRole('button', { name: 'By voice' }).click();
      await page.getByRole('button', { name: 'Start recording' }).click();
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Stop recording' }).click();
      await shot(page, `explain-preview-${w}`);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByText('Posted', { exact: true }).waitFor({ timeout: 20000 });
      assert.equal(find(calls, 'POST', '/voice-clips')[0].body!.purpose, 'VOTE_EXPLANATION');
      const post = find(calls, 'POST', '/polls/p1/explanation');
      assert.equal(post.length, 1);
      assert.equal(post[0].body!.kind, 'VOICE'); assert.equal(post[0].body!.clipId, 'c1');
      await ctx.close();
    });
  }

  // ---- 4. This is about me
  for (const w of [390, 1440]) {
    await t(`report has "This is about me" at ${w} and sends ABOUT_ME`, async () => {
      const { page, calls, ctx } = await open(w, { answers: [] });
      await page.goto(`${ORIGIN}/report/ANSWER/a2`);
      await page.getByRole('radio', { name: 'This is about me' }).click();
      await shot(page, `report-${w}`);
      await page.getByRole('button', { name: 'Send report' }).click();
      await page.getByText('Thanks. We got your report.').waitFor();
      assert.equal(find(calls, 'POST', '/reports')[0].body!.reason, 'ABOUT_ME');
      await ctx.close();
    });
  }

  // ---- 5. Help and contact
  for (const w of [390, 1440]) {
    await t(`Settings row opens Help and contact at ${w}; the form posts to /support/messages`, async () => {
      const { page, calls, ctx } = await open(w);
      await page.goto(`${ORIGIN}/settings`);
      await page.getByRole('link', { name: 'Help and contact' }).first().click();
      await page.waitForURL('**/settings/help');
      assert.equal((await page.getByTestId('support-email').innerText()).trim(), 'support@wawuafrica.com');
      await page.getByRole('button', { name: 'A payment' }).click();
      await page.getByLabel('Your message').fill('I paid but got no tokens.');
      await shot(page, `help-${w}`);
      await page.getByRole('button', { name: 'Send message' }).click();
      await page.getByText('We got your message.').waitFor();
      assert.deepEqual(find(calls, 'POST', '/support/messages')[0].body, { topic: 'PAYMENT', message: 'I paid but got no tokens.' });
      await shot(page, `help-sent-${w}`);
      await ctx.close();
    });
  }
  await t('help page carries the payment from a link (?payment=)', async () => {
    const { page, calls, ctx } = await open(390);
    const id = '11111111-2222-4333-8444-555555555555';
    await page.goto(`${ORIGIN}/settings/help?topic=PAYMENT&payment=${id}`);
    await page.getByLabel('Your message').fill('Trace it please.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByText('We got your message.').waitFor();
    assert.deepEqual(find(calls, 'POST', '/support/messages')[0].body, { topic: 'PAYMENT', message: 'Trace it please.', paymentId: id });
    await ctx.close();
  });

  // ---- 6. live results thread link
  for (const w of [390, 1440]) {
    await t(`live results link on the question and results pages at ${w}`, async () => {
      const thread = { id: 't1', title: 'Election Week', subtitle: null, heldOn: '2027-01-16', status: 'OPEN', postCount: 3, verifiedCount: 1, toCheck: 0 };
      const { page, ctx } = await open(w, { threads: [thread] });
      await page.goto(`${ORIGIN}/q/q1`);
      const l = page.getByTestId('live-results-link');
      await l.waitFor();
      assert.equal(await l.getAttribute('href'), '/live/t1');
      await shot(page, `live-link-question-${w}`);
      await page.goto(`${ORIGIN}/q/q1/results`);
      await page.getByTestId('live-results-link').waitFor();
      await ctx.close();
      const none = await open(w, { threads: [{ ...thread, status: 'CLOSED' }] });
      await none.page.goto(`${ORIGIN}/q/q1`);
      await none.page.getByText('When salary arrives').first().waitFor();
      await none.page.waitForTimeout(500);
      assert.equal(await none.page.getByTestId('live-results-link').count(), 0, 'a closed thread should not be advertised');
      await none.ctx.close();
    });
  }

  // ---- 8. weekly report on phones
  for (const [name, path] of [['Discover', '/discover'], ['Home', '/']] as const) {
    await t(`${name} carries a visible Weekly report link at 390, hidden at 1440 (the side bar has it)`, async () => {
      const { page, ctx } = await open(390);
      await page.goto(`${ORIGIN}${path}`);
      const l = page.locator('main').getByRole('link', { name: /Weekly report/ }).first();
      await l.waitFor();
      assert.equal(await l.getAttribute('href'), '/weekly');
      assert.ok(await l.isVisible());
      await shot(page, `weekly-${name.toLowerCase()}-390`);
      await l.click();
      await page.waitForURL('**/weekly');
      await ctx.close();
      const d = await open(1440);
      await d.page.goto(`${ORIGIN}${path}`);
      await d.page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Weekly report' }).waitFor();
      assert.equal(await d.page.locator('main').getByRole('link', { name: /Weekly report/ }).filter({ visible: true } as never).count(), 0);
      await shot(d.page, `weekly-${name.toLowerCase()}-1440`);
      await d.ctx.close();
    });
  }
} finally { await browser.close(); }
if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('ALL PASSED');
