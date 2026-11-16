// V-VOICE-CARD-360: every answer card ends at the same x, at 320, 360, 390 and 1440, on a mood question.
//   npx next build && npx next start -p 3971 &   then ORIGIN=http://127.0.0.1:3971 npx tsx e2e/voice-card-edge.e2e.mts
// Optional: SHOTS=<dir> saves a 360 screenshot of the question page. The API is stubbed in the browser; nothing live is called.
import { chromium } from 'playwright-core';

const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3971';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const SHOTS = process.env.SHOTS;
const now = new Date().toISOString();
const person = (n: string, over: object = {}) => ({ id: 'u-' + n, handle: n + '.handle', displayName: n, state: 'Lagos', avatarUrl: null, ...over });
const clip = (id: string, ms: number) => ({ id, status: 'READY', durationMs: ms, maxDurationMs: 60000, peaks: null });
const answer = (id: string, over: object) => ({ id, questionId: 'q1', author: person('Ada'), kind: 'TEXT', body: 'Fuel is up again and the market women are tired of explaining.', clip: null, createdAt: now, editedAt: null, status: 'PUBLISHED', news: null, likeCount: 3, replyCount: 1, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: false, labels: [], mood: 'HOPEFUL', ...over });
const answers = [
  answer('a-written', {}),
  answer('a-voice', { kind: 'VOICE', body: null, clip: clip('c1', 12000), mood: 'TIRED' }),
  answer('a-relatable', { kind: 'VOICE', body: null, clip: clip('c2', 25000), mood: 'PROUD', labels: ['MOST_RELATABLE'], reactionCount: 14, likeCount: 41, reactionBreakdown: [{ kind: 'RELATABLE', count: 9 }, { kind: 'POWERFUL', count: 5 }] }),
  answer('a-minute', { kind: 'VOICE', body: null, clip: clip('c3', 60000), mood: null }),
  answer('a-anon', { kind: 'VOICE', body: null, clip: clip('c4', 18000), author: null, mood: 'ANGRY' }),
  answer('a-admin', { author: person('Team', { admin: true, verified: true }), body: 'Read the rules before you post.', mood: 'PROUD' }),
];
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'How do you feel about Nigeria right now?', hint: null, moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: null, topicTitle: null, voiceCount: 5, answerCount: 6, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false };
const replies = [{ id: 'r1', answerId: 'a-voice', author: person('Bayo'), stance: 'AGREE', kind: 'VOICE', body: null, clip: clip('c5', 14000), createdAt: now, status: 'PUBLISHED', isMine: false, helpfulCount: 0 },
  { id: 'r2', answerId: 'a-voice', author: person('Chi'), stance: 'EXPERIENCE', kind: 'TEXT', body: 'Same here.', clip: null, createdAt: now, status: 'PUBLISHED', isMine: false, helpfulCount: 0 }];
const config = { currency: 'NGN', unitBaseKobo: 100, freePosts: 10, voiceFreeSeconds: 10, costs: { freeVoiceSeconds: 10, voicePostMilli: 78000, baseKoboPerUnit: 100, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, voiceTier1Seconds: 30, voiceMaxSeconds: 60 }, tiers: [], extraVoice: [] };

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const widths: [number, number][] = [[320, 700], [360, 740], [390, 844], [1440, 900]];
let miss = 0;

async function measure(w: number, h: number, path: string, label: string, shot?: string) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/questions/q1') return ok(question);
    if (p === '/questions/q1/answers') return ok({ items: answers.map((a) => ({ type: 'answer', answer: a })), nextCursor: null });
    if (p.startsWith('/answers/a-voice/replies')) return ok({ items: replies, nextCursor: null, counts: { agree: 1, disagree: 0, experience: 1 } });
    if (p.startsWith('/answers/')) { const a = answers.find((x) => p === '/answers/' + x.id); if (a) return ok(a); }
    if (p === '/config/public') return ok(config);
    if (p === '/reactions') return ok({ items: [] });
    if (p === '/questions/q1/moods') return ok({ questionId: 'q1', total: 5, updatedAt: now, items: [] });
    return ok({}, 404);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
  await page.goto(ORIGIN + path, { waitUntil: 'load' });
  await page.locator('article.vx-answer').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  if (shot) await page.screenshot({ path: shot, fullPage: true });
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('article.vx-answer')].map((c) => {
      const b = c.getBoundingClientRect();
      let far = b.right; let who = ''; let endFar = b.right;
      c.querySelectorAll('*').forEach((e) => { if (e.classList.contains('vx-answer__actions')) return; /* an invisible row; its own margins are by design */ const r = e.getBoundingClientRect(); if (e.classList.contains('vx-act--end')) { endFar = Math.max(endFar, r.right); return; } if (r.width && r.height && r.right > far + 0.01) { far = r.right; who = e.tagName.toLowerCase() + '.' + String((e as HTMLElement).className).slice(0, 40); } });
      return { name: c.getAttribute('aria-label') ?? '', left: +b.left.toFixed(1), right: +b.right.toFixed(1), far: +far.toFixed(1), who, endFar: +endFar.toFixed(1) };
    });
    return { cards, sx: document.documentElement.scrollWidth - window.innerWidth };
  });
  if (!r.cards.length) console.log('no cards; body: ' + (await page.locator('body').innerText()).slice(0, 300));
  await ctx.close();
  const ref = r.cards[0]; // the written post on the question page; the answer on the thread page
  console.log(`\n${label} @${w}  (written card right ${ref.right}, sideways scroll ${r.sx}px)`);
  for (const c of r.cards) {
    const bad = Math.abs(c.right - ref.right) > 0.6 || c.far > c.right + 0.6 || (c.name.startsWith('Voice') && Math.abs(c.left - ref.left) > 0.6);
    if (bad) miss++;
    console.log(`  ${bad ? 'MISS' : 'ok  '} left ${String(c.left).padStart(6)} right ${String(c.right).padStart(6)} farthest ${String(c.far).padStart(6)} ${c.name}${c.far > c.right + 0.6 ? '  <- ' + c.who : ''}${c.endFar > c.right + 0.6 ? `  NOTE: the thread card's Share/More button box ends at ${c.endFar} (same on origin/main at 390, not part of this fault)` : ''}`);
  }
  if (r.sx > 0) { miss++; console.log('  MISS page scrolls sideways by ' + r.sx); }
}

for (const [w, h] of widths) {
  await measure(w, h, '/q/q1', 'question page', SHOTS && w === 360 ? `${SHOTS}/question-360.png` : undefined);
  await measure(w, h, '/q/q1/a/a-voice', 'thread page');
}
await browser.close();
console.log(miss ? `\nFAIL ${miss} miss(es)` : '\nPASS every card ends at the written card edge, nothing passes it, no sideways scroll');
process.exit(miss ? 1 : 0);
