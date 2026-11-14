// Shared stub for the round 7 proofs: a stateful fake API and fake sign-in host, answered inside the browser. No live service.
import { chromium, type BrowserContext, type Page, type Route } from 'playwright-core';

export const ORIGIN = process.env.ORIGIN ?? 'http://127.0.0.1:3990';
export const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
export const jwt = (sub: string, tag: string) => 'h.' + Buffer.from(JSON.stringify({ sub, tag })).toString('base64url') + '.s';
const costs = { freeReactionsPerDay: 20, freeVotesPerDay: 3, baseKoboPerUnit: 100, textPostMilli: 5000, voicePostMilli: 78000, reactionAfterFreeMilli: 1000, voteAfterFreeMilli: 1000, minPackKobo: 10000, freeVoiceSeconds: 60, voiceTier1Seconds: 30, voiceMaxSeconds: 60, extraVoice30Kobo: 7800, extraVoice60Kobo: 10000, textMaxChars: 500, textPriceChars: 150, freePostTextChars: 500 };
const allowance = { freePostsRemaining: 50, balanceMilli: 0, maxVoiceSeconds: 60, messagesLeftToday: 20, freeReactionsLeftToday: 20, freeVotesLeftToday: 3, costs, extraVoiceTokens: [] };
const config = { currency: 'NGN', freePosts: 10, voiceFreeSeconds: 60, costs, tiers: [], extraVoice: [] };
const now = () => new Date().toISOString();
const question = { id: 'q1', kind: 'DAILY', status: 'LIVE', text: 'When salary arrives, how long before it is gone?', hint: null, moodOptions: ['ANGRY', 'TIRED', 'PROUD', 'HOPEFUL'], category: null, topicId: null, topicTitle: null, voiceCount: 1, answerCount: 1, proposalCount: 0, recentVoices: [], iSaved: false, pinned: false, sensitive: false, hasOpenPoll: false, startsAt: now(), endsAt: new Date(Date.now() + 36e5).toISOString() };
const topic = { questionCount: 5, id: 't1', weekNumber: 1, title: 'Salary and spending', blurb: null, countryCode: 'NG', startsOn: '2026-11-16', endsOn: '2026-11-22', status: 'LIVE', sensitive: false, voiceCount: 10, voicesCount: 10 };
const person = (id: string) => ({ id, handle: id.toLowerCase() + '.h', displayName: 'Person ' + id, state: null, avatarUrl: null });
const answerOf = (id: string, sub: string, over: object = {}) => ({ id, questionId: 'q1', author: person(sub), kind: 'TEXT', body: 'x', clip: null, createdAt: now(), editedAt: null, status: 'PUBLISHED', news: null, likeCount: 0, replyCount: 0, agreeCount: 0, disagreeCount: 0, reactionCount: 0, reactionBreakdown: [], myReaction: null, iLiked: false, iSaved: false, isMine: true, labels: [], mood: null, ...over });

export interface Post { path: string; sub: string; key: string | undefined; token: string }
/** One fake world: signed-in tokens per person, a log of everything the server saw, and switches to run a token out at a step. */
export function world() {
  const w = {
    valid: new Set<string>(),
    subOf: new Map<string, string>(),
    refresh: new Map<string, { access: string; refresh: string }>(),
    refreshLog: [] as string[],
    clips: [] as { sub: string }[],
    posts: [] as Post[],
    expireAt: null as null | string, // a path suffix: the first request there with a valid token runs that token out
    gate: Promise.resolve() as Promise<void>,
    onRefresh: null as null | (() => void),
    deleted: 0,
    offline: false,
  };
  const person_ = (sub: string, n = 1) => {
    const access = jwt(sub, 'a' + n), next = jwt(sub, 'a' + (n + 1));
    w.valid.add(access); w.subOf.set(access, sub);
    w.valid.add(next); w.subOf.set(next, sub);
    w.refresh.set('r' + sub + n, { access: next, refresh: 'r' + sub + (n + 1) });
    return { access, refresh: 'r' + sub + n };
  };
  return { w, person: person_ };
}

export async function launch() {
  return chromium.launch({ executablePath: exe, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox'] });
}

export const signIn = (page: Page, s: { access: string; refresh: string }) => page.evaluate(([k, v]) => localStorage.setItem(k, v), ['voices-web-session', JSON.stringify({ accessToken: s.access, refreshToken: s.refresh })] as const);
export const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('voices-web-session') ?? 'null'));

export async function newWorld(browser: Awaited<ReturnType<typeof launch>>, width: number, w: ReturnType<typeof world>['w'], start?: { access: string; refresh: string }) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], viewport: { width, height: width < 600 ? 844 : 900 } });
  if (start) await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch { /* */ } }, ['voices-web-session', JSON.stringify({ accessToken: start.access, refreshToken: start.refresh })] as const);
  await ctx.route('**/auth/refresh', async (route: Route) => {
    const rt = JSON.parse(route.request().postData() ?? '{}').refreshToken as string;
    w.refreshLog.push(rt); w.onRefresh?.();
    await w.gate;
    const r = w.refresh.get(rt);
    if (!r) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { accessToken: r.access, refreshToken: r.refresh } }) });
  });
  await ctx.route('**/__put', (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route('**/api/v1/**', async (route: Route) => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace('/api/v1', ''); const m = req.method();
    const ok = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (w.offline) return route.abort('internetdisconnected');
    const token = (req.headers()['authorization'] ?? '').replace('Bearer ', '');
    const authed = w.valid.has(token);
    const sub = w.subOf.get(token) ?? '';
    const gated = !['/config/public', '/questions/q1', '/questions/today', '/topics/current'].includes(p) && !p.startsWith('/share/');
    if (gated && token && !authed) return ok({ error: { code: 'UNAUTHORIZED', message: 'expired' } }, 401);
    if (gated && authed && w.expireAt && p.endsWith(w.expireAt)) { w.expireAt = null; w.valid.delete(token); return ok({ error: { code: 'UNAUTHORIZED', message: 'expired' } }, 401); }
    if (gated && !token && m !== 'GET') return ok({ error: { code: 'UNAUTHORIZED', message: 'sign in' } }, 401);
    const body = req.postData() ? JSON.parse(req.postData()!) : null;
    if (m === 'POST' && p === '/voice-clips') { w.clips.push({ sub }); return ok({ clip: { id: 'c' + w.clips.length, status: 'UPLOADING' }, putUrl: ORIGIN + '/__put' }, 201); }
    if (m === 'POST' && /^\/voice-clips\/c\d+\/complete$/.test(p)) return ok({ id: 'c1', status: 'PROCESSING' });
    if (m === 'DELETE' && /^\/voice-clips\//.test(p)) { w.deleted++; return route.fulfill({ status: 204 }); }
    if (/^\/voice-clips\/c\d+$/.test(p)) return ok({ id: 'c1', status: 'READY' });
    if (m === 'POST' && (p === '/questions/q1/answers' || /^\/answers\/a\d+\/replies$/.test(p))) {
      w.posts.push({ path: p, sub, key: req.headers()['idempotency-key'], token });
      const rec = { costMilli: 0, freeLeft: 4, balanceMilli: 0 };
      return /replies$/.test(p) ? ok({ reply: { id: 'rn', answerId: 'a1', author: person(sub), stance: body?.stance ?? 'AGREE', kind: body?.kind ?? 'VOICE', body: null, clip: null, createdAt: now(), status: 'PUBLISHED', isMine: true, helpfulCount: 0 }, charge: rec, allowances: allowance }, 201)
        : ok({ answer: answerOf('new' + w.posts.length, sub), charge: rec, allowances: allowance }, 201);
    }
    if (p === '/questions/q1' || p === '/questions/today') return ok(question);
    if (p === '/questions/q1/answers') return ok({ items: [], nextCursor: null });
    if (p === '/answers/a1') return ok(answerOf('a1', 'X', { isMine: false }));
    if (p === '/config/public') return ok(config);
    if (p === '/me/allowance') return ok(allowance);
    if (p === '/me') return ok({ id: sub, wawuId: 'w', handle: sub.toLowerCase() + '.h', profileComplete: true, savedCount: 0, replyCount: 0, reactionsReceived: 0, roles: [], profile: { id: sub, handle: sub.toLowerCase() + '.h', displayName: 'Person ' + sub, bio: null, avatarUrl: null, voiceCard: null, countryCode: 'NG', state: 'Enugu', city: null, languages: ['en'], joinedAt: '2026-11-02T10:00:00Z', voiceCount: 0, replyCount: 0, reactionsReceived: 0 }, allowances: allowance, unreadNotifications: 0, referralCode: 'X', status: 'ACTIVE', settings: { language: 'en', dataSaver: false, theme: 'system', timezone: 'Africa/Lagos', quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480, shareMyWord: true } });
    if (p === '/home') return ok({ topicOfWeek: topic, dailyQuestion: question, flashPoll: null, trending: [], newConversations: [], greetingName: 'Me' });
    if (p === '/topics/current') return ok(topic);
    if (m === 'POST' && p === '/share/links') return ok({ code: 'abc1234', url: 'https://usevoices.com/s/abc1234', cardStatus: 'PENDING' }, 201);
    return ok({ items: [] });
  });
  return ctx;
}

export const seedDraft = (page: Page, o: { slot: string; owner: string; key: string; queued: boolean; reply?: { answerId: string; stance: string } }) => page.evaluate(async (d) => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise<void>((res, rej) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ owner: d.owner, questionId: 'q1', blob: new Blob(['abc'], { type: 'audio/webm' }), mime: 'audio/webm', seconds: 4, peaks: [], key: d.key, savedAt: Date.now(), queued: d.queued, mood: 'PROUD', ...(d.reply ? { reply: d.reply } : {}) }, d.slot); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  db.close();
}, o);
export const draftKeys = (page: Page) => page.evaluate(async () => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open('voices-speak', 1); r.onupgradeneeded = () => r.result.createObjectStore('drafts'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const out = await new Promise<{ slot: string; key: string }[]>((res) => { const o: { slot: string; key: string }[] = []; const rq = db.transaction('drafts').objectStore('drafts').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { o.push({ slot: String(c.key), key: (c.value as { key: string }).key }); c.continue(); } else res(o); }; });
  db.close();
  return out;
});
