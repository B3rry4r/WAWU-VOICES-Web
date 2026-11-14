VERDICT: FIX
INTERIM

# Verify V-SURVEYS round 6 (website), interim

Code under test: `origin/v/surveys` ba16240, branch `verify/surveys-6`. Built with `next build`, run with `next start`, Chromium (Playwright, fake microphone), the API and sign-in host answered by my own stub in the browser. No live service, no `.env`. I changed no product code and no test; my scripts are not committed.

## So far

### HIGH
**H1 (new). The offline outbox sends A's saved voice answer as B.** `src/features/speak/outbox.ts:93` `createVoiceAnswer(...)` and `:90` `createVoiceReply(...)` are plain calls with no `expectSubject` (the builder said so: "post calls keep their old arguments"). The check at `:87` runs before the post, but a 401 on the post is refreshed and retried with whatever sign-in is in storage.
- Steps (390x844, two tabs, one browser): tab 1 signed in as A. Record, make the network drop, tap Send: the recording is kept as `queued`. Network back, open Home in tab 1. The outbox sends by itself (a free post covers it): create clip, upload, complete, ready check all as A. A's token runs out at the post; during the 401 wait, tab 2 signs in as B.
- Request log: `userA:1 POST /questions/q1/answers key=b37598 ->401`, `POST /auth/refresh {ruserB-1}` (B's refresh token spent by A's tab), `userB:2 POST /questions/q1/answers key=b37598` (A's voice clip posted as B). Storage afterwards holds B's rotated pair written by A's tab. When the token runs out at create, complete or the ready check instead, nothing goes out as B (those four calls do carry the subject).
- Should: pass the subject to the two post calls in `sendHere`, as the record screen does (`SpeakScreen.tsx:455`).

### What held so far
- Record screen, one person, one tab, good token: voice 10 runs at 390 and 10 at 1440, typed 10 at 390 and 10 at 1440: each exactly one clip (voice), one post, no refresh.
- Token runs out at clip create, upload-not-applicable, complete, ready check, post: one refresh, one post, same Idempotency-Key, ends on the posted screen. Network dropped, reply lost or a 500 at create, upload, complete, ready, post, typed post: ends posted after one more tap, one post, same key on the retried post. One case makes a second clip: the create-clip reply is lost after the server made the clip, so the retry makes another (orphan clip, one post).
- Record screen, B signs in when each step arrives, A's token valid or run out (9 cases): nothing sent as B, B's refresh token never used, B's tokens untouched.
- `npm ci`, `tsc` 0 errors, `next lint` clean, `vitest` 143 files 1508 tests pass, `next build` ok.

## Still to run
Sections 2, 3 (voice reply, explain my vote, survey voice), 4, 5, 6 (join with main 1db90d5), 7 and the opening test. Full report to follow.
