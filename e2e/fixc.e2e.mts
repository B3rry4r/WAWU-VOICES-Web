// V-FIX-C proof against the built app (next start) with the API stubbed in the browser.
//   npx next build && npx next start -p 3971 &   then ORIGIN=http://127.0.0.1:3971 npx tsx e2e/fixc.e2e.mts
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3971';
const SHOTS = process.env.SHOTS ?? '/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/shots/fixc';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let failed = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' ' + (e as Error).message); } };

type Call = { method: string; path: string; body: any };
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'no' } };

async function open(roles: string[], width: number, route: (p: string, method: string, body: any, ok: (b: unknown, s?: number) => Promise<void>) => Promise<boolean | void>) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  await ctx.addInitScript(() => localStorage.setItem('voices-web-session', JSON.stringify({ accessToken: 't', refreshToken: 'r' })));
  const calls: Call[] = [];
  await ctx.route('**/api/v1/**', async (r) => {
    const req = r.request(); const p = new URL(req.url()).pathname.replace('/api/v1', '') + (new URL(req.url()).search);
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    const ok = async (b: unknown, status = 200) => { await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) }); };
    calls.push({ method: req.method(), path: p, body });
    if (p === '/me') return ok({ id: 'u', handle: 'ngozi.e', roles, profile: { displayName: 'Ngozi Eze' } });
    if (p.startsWith('/admin/today')) return ok(NOT_FOUND, 404);
    if (await route(p, req.method(), body, ok)) return;
    return ok(NOT_FOUND, 404);
  });
  return { page: await ctx.newPage(), calls, ctx };
}

const mkQ = (id: string, text: string, day: string, slot: number, status = 'SCHEDULED') => ({ id, kind: 'DAILY', slotIndex: slot, day, text, hint: null, status, pinned: false, isSpare: false, categoryId: null, voiceCount: 0 });
const DRAFT = {
  topicId: 't1', source: 'DATA', aiAvailable: false, aiNote: null,
  draft: { mainView: 'publish their assets and plans', mainViewVoices: 5400, opposingView: 'debate in public', opposingViewVoices: 2100, pollLine: '“Publish their assets and plans” leads with 44% of 9,680 votes. The poll is still open.', nextStepsLine: '214 proposals in 38 groups. Most supported so far: Put the salary date and a late-payment penalty in every offer letter' },
  basedOnVoices: 12480, basedOnVotes: 9680,
  moods: [{ mood: 'ANGRY', count: 412, percent: 44 }, { mood: 'TIRED', count: 254, percent: 27 }, { mood: 'HOPEFUL', count: 160, percent: 17 }, { mood: 'PROUD', count: 113, percent: 12 }],
  categories: [{ name: 'Money', voices: 7200 }, { name: 'Work', voices: 3100 }],
  quotes: [{ answerId: 'a1', kind: 'TEXT', reactions: 214, excerpt: 'Salary is gone in a day, to rent, family and transport.' }, { answerId: 'a2', kind: 'VOICE', reactions: 96, excerpt: 'I move my savings out before the bills come.' }],
};

try {
  for (const ai of [false, true]) {
    await t(`calendar: summary screen, AI ${ai ? 'on' : 'off'}`, async () => {
      let saved: any = null;
      const { page, calls, ctx } = await open(['EDITOR'], 1440, async (p, m, body, ok) => {
        if (p.startsWith('/admin/topics/t1/summary/draft')) return ok({ ...DRAFT, aiAvailable: ai, source: body.ai ? 'AI' : 'DATA', aiNote: body.ai ? 'Read 200 of 12,480 voices; the counts are scaled up from them. Check them.' : null, draft: body.ai ? { ...DRAFT.draft, mainView: 'getting paid on the day it was promised', mainViewVoices: 5100 } : DRAFT.draft }).then(() => true);
        if (p.startsWith('/admin/topics/t1/summary') && m === 'GET') return ok({ aiAvailable: ai, summary: saved }).then(() => true);
        if (p.startsWith('/admin/topics/t1/summary') && m === 'PUT') { saved = { topicId: 't1', ...body, basedOnVoices: 12480, basedOnVotes: 9680, updatedAt: new Date().toISOString(), reviewedByEditor: body.approve }; return ok(saved).then(() => true); }
        if (p.startsWith('/admin/topics/t1')) return ok({ topic: { id: 't1', weekNumber: 4, title: 'Salary, Bonuses and Year-End Money', blurb: null, countryCode: 'NG', startsOn: '2026-12-07', endsOn: '2026-12-13', status: 'LIVE', sensitive: false, whatNextPrompt: 'What is one practical change that would make pay fairer in your workplace?', questionCount: 7 }, questions: [mkQ('d1', 'When salary arrives, how long before it is gone?', '2026-12-07', 1, 'LIVE'), mkQ('d2', 'Have you ever been paid late?', '2026-12-08', 2)], spare: [], poll: { id: 'p1', title: 'What should be tackled first?', endsAt: '2026-12-13T22:59:00Z', options: [{ id: 'o1', label: 'Pay salaries on time' }, { id: 'o2', label: 'Publish pay bands' }] } }).then(() => true);
        if (p.startsWith('/admin/topics')) return ok({ items: [{ weekNumber: 4, topicId: 't1', title: 'Salary, Bonuses and Year-End Money', startsOn: '2026-12-07', status: 'LIVE' }], nextCursor: null, counts: { live: 1, scheduled: 0, inReview: 0, draft: 0, sensitive: 0 }, totals: { weeks: 1, questions: 7 } }).then(() => true);
      });
      await page.goto(`${ORIGIN}/admin/calendar`);
      await page.getByText('Argument chips and “Based on N voices”').waitFor();
      await page.screenshot({ path: `${SHOTS}/summary-1-empty-ai${ai ? 'on' : 'off'}-1440.png`, fullPage: true });
      await page.getByRole('button', { name: 'Write the summary' }).click();
      await page.getByLabel('Main view', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Main view', { exact: true }).inputValue(), 'publish their assets and plans');
      const aiBtn = page.getByRole('button', { name: 'Draft with AI' });
      assert.equal(await aiBtn.isDisabled(), !ai);
      const says = await page.getByRole('status').filter({ hasText: /AI/ }).first().innerText();
      assert.ok(ai ? /reads this week/.test(says) : /AI drafting is off here\. The draft from the data still works\./.test(says), says);
      if (ai) {
        await aiBtn.click();
        await page.waitForFunction(() => (document.querySelector('input[value="getting paid on the day it was promised"]') != null));
        assert.ok(await page.getByText(/Read 200 of 12,480 voices/).isVisible());
      }
      await page.screenshot({ path: `${SHOTS}/summary-2-editing-ai${ai ? 'on' : 'off'}-1440.png`, fullPage: true });
      await page.getByRole('button', { name: 'Save and show on What Next' }).click();
      await page.getByText('Shown on What Next', { exact: true }).waitFor();
      const put = calls.find((c) => c.method === 'PUT')!;
      assert.equal(put.body.approve, true); assert.equal(put.body.aiDrafted, ai);
      assert.ok((await page.locator('body').innerText()).includes('Based on 12,480 voices and 9,680 votes'));
      await page.screenshot({ path: `${SHOTS}/summary-3-saved-ai${ai ? 'on' : 'off'}-1440.png`, fullPage: true });
      await ctx.close();
    });
  }

  await t('group ideas: suggestion, confirm, group listed', async () => {
    let confirmed = false;
    const items = (g: string | null) => [
      { id: 'p1', kind: 'TEXT', text: 'Put the salary date and a late-payment penalty in every offer letter', supportCount: 9, challengeCount: 0, groupId: g, groupTitle: g ? 'Pay date in the offer letter' : null, createdAt: '2026-11-14T10:00:00Z' },
      { id: 'p2', kind: 'TEXT', text: 'Salary date in the offer letter with a penalty for late payment', supportCount: 4, challengeCount: 1, groupId: g, groupTitle: g ? 'Pay date in the offer letter' : null, createdAt: '2026-11-14T10:00:00Z' },
      { id: 'p3', kind: 'TEXT', text: 'Offer letters should state the salary date and late payment penalty', supportCount: 2, challengeCount: 0, groupId: g, groupTitle: g ? 'Pay date in the offer letter' : null, createdAt: '2026-11-14T10:00:00Z' },
      { id: 'p4', kind: 'TEXT', text: 'Publish pay bands for every role', supportCount: 7, challengeCount: 2, groupId: null, groupTitle: null, createdAt: '2026-11-14T10:00:00Z' },
      { id: 'p5', kind: 'VOICE', text: 'A spoken idea about transport pay', supportCount: 1, challengeCount: 0, groupId: null, groupTitle: null, createdAt: '2026-11-14T10:00:00Z' },
    ];
    const { page, calls, ctx } = await open(['MODERATOR'], 1440, async (p, m, body, ok) => {
      if (p.startsWith('/admin/proposal-questions')) return ok({ items: [{ questionId: 'q1', text: 'What is one practical change that would make pay fairer in your workplace?', weekNumber: 4, proposalCount: 5, groupCount: confirmed ? 1 : 0, ungroupedCount: confirmed ? 2 : 5 }, { questionId: 'q2', text: 'If a candidate knocked on your door, what would you ask first?', weekNumber: 3, proposalCount: 2, groupCount: 0, ungroupedCount: 2 }] }).then(() => true);
      if (p.startsWith('/admin/proposals?')) return ok({ question: { id: 'q1', text: 'What is one practical change that would make pay fairer in your workplace?' }, items: items(confirmed ? 'g1' : null).sort((a, b) => 0).map((x, i) => (confirmed ? x : x)), groups: confirmed ? [{ id: 'g1', title: 'Pay date in the offer letter', confirmed: true, proposalCount: 3 }] : [], suggestions: confirmed ? [] : [{ title: 'Put the salary date and a late-payment penalty in every offer letter', proposalIds: ['p1', 'p2', 'p3'] }] }).then(() => true);
      if (p === '/admin/proposal-groups' && m === 'POST') { confirmed = true; return ok({ id: 'g1', title: body.title, confirmed: true, proposalCount: 3, supportCount: 15, challengeCount: 1, topProposal: null }, 201).then(() => true); }
    });
    await page.goto(`${ORIGIN}/admin/ideas`);
    const sug = page.getByRole('region', { name: 'Suggested group 1' });
    await sug.waitFor();
    await page.screenshot({ path: `${SHOTS}/ideas-1-suggested-1440.png`, fullPage: true });
    await sug.getByLabel('Group name').fill('Pay date in the offer letter');
    await sug.getByRole('button', { name: 'Confirm this group' }).click();
    await page.getByText(/Group confirmed/).waitFor();
    await page.getByText('Confirmed', { exact: true }).waitFor();
    const post = calls.find((c) => c.method === 'POST')!;
    assert.deepEqual(post.body, { title: 'Pay date in the offer letter', proposalIds: ['p1', 'p2', 'p3'] });
    await page.screenshot({ path: `${SHOTS}/ideas-2-confirmed-1440.png`, fullPage: true });
    await ctx.close();
  });

  await t('people and roles: find by handle, grant, remove', async () => {
    const person = { profile: { id: 'u9', handle: 'ada.okafor', displayName: 'Ada Okafor' }, status: 'ACTIVE', roles: [] as string[], strikes: 0, createdAt: '2026-11-01T00:00:00Z' };
    const { page, calls, ctx } = await open(['ADMIN'], 1440, async (p, m, body, ok) => {
      if (p.startsWith('/admin/roles')) return ok({ items: [{ user: { id: 'u1', handle: 'ngozi.e', displayName: 'Ngozi Eze' }, roles: ['ADMIN'] }, ...(person.roles.length ? [{ user: person.profile, roles: person.roles }] : [])], nextCursor: null }).then(() => true);
      if (p.startsWith('/admin/users?')) return ok({ items: [person], nextCursor: null }).then(() => true);
      if (p.startsWith('/admin/users/u9/roles') && m === 'PUT') { person.roles = body.roles; return ok({ user: person.profile, roles: body.roles }).then(() => true); }
    });
    await page.goto(`${ORIGIN}/admin/people`);
    await page.getByLabel('Handle').fill('ada.okafor');
    await page.getByRole('button', { name: 'Find', exact: true }).click();
    await page.getByRole('list', { name: 'People found' }).getByRole('listitem').click();
    await page.getByRole('checkbox', { name: /^Editor/ }).check();
    await page.getByRole('checkbox', { name: /^Moderator/ }).check();
    await page.getByLabel('Why').fill('Joins the news desk');
    await page.screenshot({ path: `${SHOTS}/people-1-edit-1440.png`, fullPage: true });
    await page.getByRole('button', { name: 'Save roles' }).click();
    await page.getByText(/@ada\.okafor is now editor and moderator/).waitFor();
    assert.deepEqual(calls.find((c) => c.method === 'PUT')!.body, { roles: ['EDITOR', 'MODERATOR'], reason: 'Joins the news desk' });
    await page.screenshot({ path: `${SHOTS}/people-2-saved-1440.png`, fullPage: true });
    // remove one
    await page.getByRole('checkbox', { name: /^Moderator/ }).uncheck();
    await page.getByLabel('Why').fill('Back to editing only');
    await page.getByRole('button', { name: 'Save roles' }).click();
    await page.getByText(/@ada\.okafor is now editor\./).waitFor();
    assert.deepEqual(calls.filter((c) => c.method === 'PUT')[1].body, { roles: ['EDITOR'], reason: 'Back to editing only' });
    await ctx.close();
  });

  await t('people page: an editor is not let in', async () => {
    const { page, ctx } = await open(['EDITOR'], 1440, async () => false);
    await page.goto(`${ORIGIN}/admin/people`);
    await page.getByText('We could not find that').waitFor();
    await ctx.close();
  });

  await t('weekly admin: emotions drafted, edit form, regions', async () => {
    const report = { id: 'r1', topicId: 't1', weekNumber: 2, status: 'DRAFT', draftedAt: '2026-11-30T00:10:00Z', pollClosedAt: '2026-11-29T22:59:00Z', publishAt: null, headline: 'Angry about prices, still counting every naira.', mood: 'Angry about prices, still counting every naira.', summary: 'Most voices say prices rise faster than pay. People are split on what to fix first.', themes: [{ label: 'Prices rise faster than pay', count: 3200 }], sentiment: {}, pollSummary: { line: '41% A stable naira' }, quotes: [], basedOnVoices: 11872, basedOnVotes: 9406, languagesRead: ['English', 'Pidgin'], checks: [{ text: 'No names, handles or phone numbers', ok: true }], cardTitle: null, editorNote: null,
      emotions: [{ name: 'Angry', share: 44, change: 6 }, { name: 'Tired', share: 27, change: -3 }, { name: 'Hopeful', share: 17, change: 1 }, { name: 'Proud', share: 12, change: -4 }], regions: [{ state: 'Lagos', votes: 3100, leading: 'A stable naira', percent: 44 }, { state: 'Kano', votes: 1200, leading: 'Cheaper fuel and transport', percent: 38 }] };
    const { page, calls, ctx } = await open(['EDITOR'], 1440, async (p, m, body, ok) => {
      if (m === 'PATCH') return ok({ ...report, ...body }).then(() => true);
      if (p.startsWith('/admin/weekly-reports')) return ok({ items: [report], nextCursor: null }).then(() => true);
    });
    await page.goto(`${ORIGIN}/admin/weekly`);
    await page.getByText('The poll by state').waitFor();
    assert.ok((await page.locator('body').innerText()).includes('Angry'));
    assert.ok(await page.getByText('44% A stable naira (3,100 votes)').isVisible());
    await page.screenshot({ path: `${SHOTS}/weekly-admin-1-1440.png`, fullPage: true });
    await page.getByRole('button', { name: 'Edit draft' }).click();
    await page.getByRole('group', { name: 'Leading emotions' }).waitFor();
    await page.getByLabel('Share (%)').first().fill('46');
    await page.screenshot({ path: `${SHOTS}/weekly-admin-2-edit-1440.png`, fullPage: true });
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.getByText('Draft saved.').waitFor();
    const patch = calls.find((c) => c.method === 'PATCH')!;
    assert.equal(patch.body.emotions.length, 4); assert.equal(patch.body.emotions[0].share, 46);
    await ctx.close();
  });

  for (const width of [1440, 390]) {
    await t(`public weekly page at ${width}: mood bars and the poll by state`, async () => {
      const { page, ctx } = await open([], width, async (p, m, body, ok) => {
        if (p.startsWith('/weekly-reports/latest')) return ok({ id: 'r1', topicId: 't1', weekNumber: 2, title: 'What Nigerians said this week', range: '23 to 29 Nov 2026', mood: 'Angry about prices, still counting every naira.', summary: 'Most voices say prices rise faster than pay.', themes: [{ label: 'Prices rise faster than pay', count: 3200 }], sentiment: {}, pollSummary: { line: '41% A stable naira' }, quotes: [], basedOnVoices: 11872, basedOnVotes: 9406, label: 'AI-assisted and human-reviewed', publishedAt: '2026-11-30T17:00:00Z',
          emotions: [{ name: 'Angry', share: 44, change: 6 }, { name: 'Tired', share: 27, change: -3 }, { name: 'Hopeful', share: 17, change: 1 }, { name: 'Proud', share: 12, change: -4 }], regions: [{ state: 'Lagos', votes: 3100, leading: 'A stable naira', percent: 44 }, { state: 'Kano', votes: 1200, leading: 'Cheaper fuel and transport', percent: 38 }] }).then(() => true);
      });
      await page.goto(`${ORIGIN}/weekly`);
      await page.getByText('The poll by state').first().waitFor();
      const body = await page.locator('body').innerText();
      assert.ok(body.includes('Angry') && body.includes('44%'), 'mood row');
      assert.ok(body.includes('Lagos') && body.includes('44% A stable naira (3,100 votes)'));
      assert.ok(!body.includes('—'), 'em-dash');
      await page.screenshot({ path: `${SHOTS}/weekly-public-${width}.png`, fullPage: true });
      await ctx.close();
    });
  }
} finally {
  await browser.close();
}
if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all ok');
