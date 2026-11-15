# V-SURVEYS round 7 (website)

Branch `v/surveys`, from ba16240. Joined main c934e9b first.

## The join
Normal merge, no conflicts. `contract/openapi.yaml` is this branch's file (untouched by the merge). `HomeScreen.tsx` keeps `h.trending.slice(0, 5)`. `DMS_LIVE` is still `false`.

## H1: offline outbox
`src/features/speak/outbox.ts` `sendHere`: both post calls now get the subject the send started with (`createVoiceReply(..., subject)`, `createVoiceAnswer(..., null, subject)`). A 401 on the post is no longer retried as someone else; nothing more goes out and the recording stays kept for A.
Tests changed by the ruling (new argument only): `tests/fixd-outbox.test.tsx:55` (answer) and `tests/fixd-round3.test.tsx:244` (reply, subject "u1").
Proof: built app, two tabs. A's token runs out at the post, B signs in during the wait, for a saved voice answer and a saved voice reply: 0 posts as B, B's tokens untouched, A's recording kept. A alone: sent once. Logs below.

## M1: rows under the floor
`src/features/admin/survey-floor.ts`: new `rowShown`, `choiceShown`, `otherShown`; `underFloor` uses `rowShown` (0 is kept, 1 to floor-1 is dropped). `SurveyResultsPage.tsx` (choice rows, "Other") and `survey-csv.ts` use them. A choice under the floor shows its name with "Fewer than N answers, not shown" (the same line the server-hidden rows had) and is written as `hidden` in the CSV; "Other" under the floor is not drawn or exported. "Not sure 0" is drawn as 0.
New tests: `tests/surveys-round7-floor.test.tsx` (floor 20: Maybe 3, Other 5, Not sure 0, Other 20).

## M2: A's recording kept when B opens a page
`src/features/speak/draft.ts`: each signed-in person has their own slot (`u:<id>`); the guest slot and the old shared slot stay as `current`. `loadDraft` never removes another person's recording; it only removes an old shared copy that is past 7 days. A guest's recording moves to the first person who signs in. `clearDraft(owner)` removes only that person's. `src/lib/api/auth.ts` `signOut` passes the person who signed out, so signing out still removes your own kept recording and no one else's.
New tests: `tests/round7-draft-slots.test.ts`. Browser proof below: B opens Home and the record screen, sends their own (1 clip, 1 post as B); A signs in again and A's recording is there and sends once with its own key.

## Needs your eye (existing tests touched beyond the two ruled)
- `tests/w4-recorder.test.ts` "another account never sees...": it pinned "removed when they sign in", which is the opposite of the M2 ruling. Last assertion now expects A's recording back, test name says so. I could not keep both.
- `tests/voice-clip-subject.test.tsx:72`: cleanup now also clears A's and B's slots (test isolation only; A's kept recording used to be wiped by B opening a page).

## Record screen proof (built app: `next build`, `next start`, Chromium, fake microphone, stubbed API; `e2e/round7.e2e.mts`, `e2e/round7-stub.mts`)
Every run first checks the screen shows: Pick one word, ANGRY TIRED PROUD HOPEFUL, Say it in 60 seconds, Type it instead, Share my word.
```
     run 1: clips 1, posts 1, refresh 0
     run 10: clips 1, posts 1, refresh 0
ok   390: voice, 10 plain runs: 1 clip, 1 post, no refresh, no stale line
     run 1: clips 0, posts 1, refresh 0
     run 10: clips 0, posts 1, refresh 0
ok   390: typed, 10 plain runs: 1 post each
     run 1: clips 1, posts 1, refresh 0
     run 10: clips 1, posts 1, refresh 0
ok   1440: voice, 10 plain runs: 1 clip, 1 post, no refresh, no stale line
     run 1: clips 0, posts 1, refresh 0
     run 10: clips 0, posts 1, refresh 0
ok   1440: typed, 10 plain runs: 1 post each
     clips 1, posts 1, refresh 1, post keys 17fd36df
ok   voice: token runs out at /voice-clips: one refresh, 1 clip, 1 post, no stale line
     clips 1, posts 1, refresh 1, post keys f8650377
ok   voice: token runs out at /complete: one refresh, 1 clip, 1 post, no stale line
     clips 1, posts 1, refresh 1, post keys b66ba87c
ok   voice: token runs out at /voice-clips/c1: one refresh, 1 clip, 1 post, no stale line
     clips 1, posts 1, refresh 1, post keys 268a1ec5
ok   voice: token runs out at /questions/q1/answers: one refresh, 1 clip, 1 post, no stale line
     clips 0, posts 1, refresh 1
ok   typed: token runs out at the post: one refresh, 1 post
     posts as A 0, as B 0; B refresh tokens spent 0; stored "rA1"; kept [{"slot":"u:A","key":"kept-answer"}]
     clips 0, posts 0, refresh 0, posts , kept [{"slot":"u:A","key":"kept-answer"}]
     posts as A 0, as B 0; B refresh tokens spent 0; stored "rB1"; kept [{"slot":"u:A","key":"kept-reply"}]
     clips 1, posts 1, refresh 1, posts A:kept-reply, kept []
     after B: [{"slot":"u:A","key":"kept-A"}]
     A is back: Send visible 1
     A posts 1, key kept-A
ok   M2: B opens Home and the record screen, sends their own; A signs in again and A's recording is there and sends once
--- rerun after fixing my test seed (mood) and tab order ---
     clips 1, posts 1, refresh 0, kept after: []
ok   offline then back, two tabs of A open: 1 clip, 1 post
ALL PASSED 1
     posts as A 0, as B 0; B refresh tokens spent 0; stored "rB1"; kept [{"slot":"u:A","key":"kept-answer"}]
ok   H1 outbox answer: A's token runs out at the post, B signs in during the wait: no post as B, B's tokens untouched, A's recording kept
     clips 1, posts 1, refresh 1, posts A:kept-answer, kept []
ok   H1 outbox answer: A alone, token runs out at the post: sent once
     posts as A 0, as B 0; B refresh tokens spent 0; stored "rB1"; kept [{"slot":"u:A","key":"kept-reply"}]
ok   H1 outbox reply: A's token runs out at the post, B signs in during the wait: no post as B, B's tokens untouched, A's recording kept
     clips 1, posts 1, refresh 1, posts A:kept-reply, kept []
ok   H1 outbox reply: A alone, token runs out at the post: sent once
ALL PASSED 4
```
Voice 10 of 10 and typed 10 of 10 at 390x844 and at 1440x900: 1 clip and 1 post each (typed 0 clips), no refresh, no "signed in as someone else" line, no sideways scroll. Token running out at create, complete, ready and post (voice) and the post (typed): 1 refresh, 1 clip, 1 post each. Offline then back with two tabs: 1 clip, 1 post.

## Could not prove
- I did not run the H1 browser test against the old code to watch it fail; the check's own log showed that, and the unit tests pin the new argument.
- The first full run had 3 failures that were my own test setup (a saved answer without a word waits for a word, and I opened a tab while offline); fixed and rerun as shown. The offline test's second tab and the H1 runs were rerun alone, not in one pass.
- Voice reply and "explain my vote" in a browser through the record screen; the DM, sign-in, admin and survey screens (vitest only). Real server, real phone.

## Totals
`npx tsc --noEmit` 0 errors; `npx next lint` clean; `npx vitest run` 149 files, 1530 tests pass (before the report); `npx next build` ok. One full run had a single failure that passed on the next run (1530 of 1530); I did not see which test, so I cannot say it was the known opening one.
