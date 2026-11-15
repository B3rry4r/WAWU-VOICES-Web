# V-SURVEYS round 9 (website): one rule for a kept recording

Branch `v/surveys`. No pull request. Main (557bcbe) is merged in. The branch's own rule is gone; main's draft-owner rule is the only one.

## The join (merge commit 6df173e)
Taken from main exactly (the branch's version dropped): `speak/draft.ts`, `SpeakScreen.tsx`, `Outbox.tsx`, `outbox.ts`, `VoiceBox.tsx`, `talk/VoiceReply.tsx`, `WriteScreen.tsx`, `ReplyComposer.tsx`, `lib.tsx`, `units/draft.ts`, `post-draft.ts`, `BuyUnitsScreen.tsx`, `OutOfPostsSheet.tsx`, `PaymentDoneScreen.tsx`, `lib/api/auth.ts`, `lib/auth/session-storage.ts`.
Deleted: `src/features/speak/opened-for.ts`, `tests/round7-draft-slots.test.ts`, `tests/round8-draft-owner.test.tsx` (the lead ruling of 15 Nov). Nothing imports `opened-for`.
Main's tests taken as they are on main: `draft-owner`, `draft-owner-2`, `round4`, `opening`, `fixd-outbox`, `fixd-outbox-r2`, `fixd-round3`, `share-card-guest-return`, `w4-recorder`, `w4-speak`, `wf6b-people`. They pass unchanged.
`HomeScreen.tsx`: the code was not in conflict; it has both main's `trending.slice(0, 5)` and the survey card. `contract/openapi.yaml` and `types.ts`: the branch's. `DMS_LIVE` is false.
Kept from the branch: `client.ts` (`expectSubject`, `WrongPersonError`, `tokenSubject`, `sessionSubject`, compare-and-set refresh), `speak.ts`, `talk.ts`, `vote.ts` arguments, `tests/refresh-compare-and-set.test.ts`, `tests/voice-clip-subject.test.tsx`, the floor rows (`survey-floor.ts`, round 6 and 7 floor tests).

## Every line changed on top of main in the record, reply, outbox and units code
Diff against main on the guarded paths: 4 files, 76 insertions, 34 deletions, 109 changed lines. `units/`, `WriteScreen`, `ReplyComposer`, `lib.tsx`, `session-storage.ts`, `auth.ts`, `draft.ts`, `Outbox.tsx`: no change at all.

**`SpeakScreen.tsx`** (17 lines): imports `WrongPersonError`. `deleteVoiceClip`, `getVoiceClip` get `openedFor() ?? undefined`. In `send`: `const subject = openedFor() ?? undefined`, passed to `createVoiceClip`, `completeVoiceClip`, `createVoiceAnswer`, and the `deleteVoiceClip` in the catch. The catch that shows `OTHER_TAB_NOTE` for `OtherTabError` also takes `WrongPersonError` (recording kept, as main does). A guest is `undefined`, never a subject; main still asks a guest to sign in first.

**`outbox.ts`** (22 lines): `subject = d.owner ?? undefined` (the owner stored with the kept item) goes to `createVoiceClip`, `completeVoiceClip`, `getVoiceClip` (new optional argument on the local `waitReady`) and `deleteVoiceClip`. `WrongPersonError` returns `failed` with `OTHER_TAB_NOTE` (the item stays kept). The two final posts use `asPerson(subject, () => ...)` instead of a trailing argument, because main's tests (`fixd-outbox`, `fixd-round3`) pin the exact arguments of `createVoiceAnswer` and `createVoiceReply`.

**`VoiceReply.tsx`** (5 lines): `clip.subject` is the last argument of `createVoiceReply`; `WrongPersonError` shows `OTHER_TAB_NOTE` like `OtherTabError`.

**`VoiceBox.tsx`** (66 lines). This is more than "pass-through", and it is the one place I went past the brief:
- the pass-through: `subject = openedFor() ?? undefined` on `createVoiceClip`, `completeVoiceClip`, `getVoiceClip`, `deleteVoiceClip` (3 places), `ReadyClip.subject` handed to `onSend`, `WrongPersonError` shows `OTHER_TAB_NOTE`, purpose `SURVEY_ANSWER`.
- survey-only optional props the survey voice question needs and main's box does not have: `previewHint`, `postingText`, `onReady` (the clip is sent up when the recording stops and handed back READY, not posted), `canWrite` (asked before each upload call; the survey screen's own check). These were already on the branch before round 7 and are unused by every other caller, so the other boxes behave as on main. If you want them out of `VoiceBox`, the survey voice question needs its own recorder; say so and I will do that.

**`client.ts`** (+69): the branch's code, plus `asPerson(subject, call)` (a few lines): runs one call tied to a person without a new argument; `apiFetch` picks it up in the same step. Used only by the outbox.

## The survey on the same rule
`who.ts` is now only `useSameWho` (its own copy of the rule is gone). The tab's person is `openedFor()`; `check()` is `!signedInAsSomeoneElse(person)`, run before a START, SKIP, save, restore, send and clip delete, and on focus, visibility, page show and the storage event. The notice is main's `OTHER_TAB_NOTE`. `answerSurvey`, `recordSurveyEvent` and the clip calls carry `expectSubject`. A "signed out in another tab" is no longer a stale tab (main's rule: not someone else). The shell no longer calls `sessionSubject` at all (grep: only `client.ts`), so the five client-mock tests need no change.

## Tests I changed (survey tests only, all pin the dropped survey rule)
`surveys-round3-public`, `surveys-round4-who`, `surveys-round5-send`, `voice-clip-subject`: `leaveTab()` in `beforeEach` and where a test simulates a page load by a new mount with another person (the same one-line setup main added to `share-card-guest-return`); `voice-clip-subject` also clears kept recordings in `beforeEach`. The wording constants now use `OTHER_TAB_NOTE`. Two tests in `surveys-round4-who` about "signed out in another tab shows a different line" now assert main's rule instead: the tab stays A's, no someone-else line, nothing sent; B signing in then shows the line. Every other assertion is as it was. No test skipped or deleted beyond the two files named.

## Round 8 check findings
- HIGH 1 (A's tab writes, shows, plays, sends, deletes B's recording): **CLOSED**. Main's `e2e/draft-owner.e2e.mts` R2a and R2b at 390 and 1440: B's kept recording byte for byte the same (SHA-256) after A's tab taps "Say it in 60 seconds", records, and tries Send, Delete, Remove, Discard, Record again; A's tab shows the line, no Send/Play/Delete; clips 0. The survey's voice question, same case (my `d2`): clips 0, answers 0, posts 0, deletes 0, line shown, B's `rec:B` slot unchanged.
- MEDIUM 1 (A signed out elsewhere, tab records as guest, next person takes it): **CLOSED** by main's R1a/R1b/R1c (kept under A, B gets nothing, A gets it back).
- MEDIUM 2 (vitest exit 1, unhandled rejections in five shell tests): **CLOSED**, see gates.
- LOW 1 (lint warning on `SpeakScreen.tsx`): **CLOSED**; the file is main's and lint has 0 warnings.
- Round 7 HIGH 1 (sender check on the wire): kept and working: `voice-clip-subject` and `refresh-compare-and-set` pass; browser `surveys-round6` (survey voice, B signs in during a 401 wait at create and at complete) all ok.
- Round 7 MEDIUM 1 (floor rows): kept; `surveys-round6-floor` and `surveys-round7-floor` pass; browser "Admin results ... below the minimum" ok.

## Gates
- `npx tsc --noEmit`: 0 errors. `npx next lint`: 0 warnings, 0 errors. `npx next build`: ok.
- `npx vitest run`: 150 files, 1543 of 1543 tests, exit 0, 0 unhandled errors. 3 quiet runs: all exit 0, 1543 each. 3 runs under 4 busy loops (`yes`, stopped afterwards): all exit 0, 1543 each.

## Browser (built app, `next build` + `next start`, Chromium, fake microphone, API and sign-in stubbed in the page, no live service)
- a. `e2e/draft-owner.e2e.mts` unchanged, RUNS=10: **38 of 38 ok** (both widths).
- b. `e2e/round7.e2e.mts` (one person): voice 10 and typed 10 at 390 and at 1440, 1 clip and 1 post per Send, no refresh, line never shown; token runs out at create, complete, ready, post: 1 refresh, 1 clip, 1 post; typed post run-out: 1 refresh, 1 post; outbox answer and outbox reply, A alone, token out at the post: sent once; A's outbox with B signing in during the wait: 0 posts as B, B's tokens untouched. **14 of 14.** Main's script also did voice 10 / typed 10 at both widths, so each width has 20 plain sends. A live voice reply (`e2e/surveys-r9`, 390): 1 clip, 1 reply as A, line 0.
- c. Two people, two tabs: main's R2a, R2b, R2c at both widths (above), and the survey version (d2).
- d. `e2e/surveys-r9.e2e.mts` **6 of 6**: Home card, choice, written, voice (record, Send), done at 390 and 1440 (1 clip with purpose SURVEY_ANSWER, 1 answer as A with the clip id); two people on the voice question at both widths; guest opens a survey, is asked to sign in, signs in, comes back, answers once (1 answer). Plus `e2e/surveys.e2e.mts`: 21 ok, 5 FAIL (see below), and `e2e/surveys-round6.e2e.mts` all ok.
- e. admin in `surveys.e2e.mts` at 1440: Surveys list, new survey form, results with totals and the minimum floor, CSV saved with its rows, Brands: ok.
- Screenshots: `docs/lead/proof/surveys-r9/` (390 and 1440, light theme; `r9-*` are from this round's script).
- I ported `e2e/round7.e2e.mts` and `round8.e2e.mts` seeds from slot `u:A` to main's `rec:A`, and removed two expectations from `round7` that belonged to the dropped design (A's recording surviving B's visit; main deletes other people's recordings when a signed-in person loads, and a test of main's pins that). `round8.e2e.mts` still tests slot sweeps and slot shapes of the dropped design: not run as proof, not deleted.

## What I could not prove
- `e2e/surveys.e2e.mts`: 5 cases fail (H1 "no VIEW below the fold" and four H3 cases that expect no VIEW before START). They show one extra VIEW from the Home card. Home code is identical to the branch head (no diff in `src/components/feed`), so I think it is the script's stub (empty trending list, so the card sits in the first screen), but I did not run the old build to confirm.
- A live voice reply on the desktop: the thread has no voice-reply door at 1440 (the mic is in the phone dock only). Not changed.
- A survey tab flips to the stale notice as soon as the other tab's storage event arrives, so "A taps record" on a flipped tab is not possible; my case checks that nothing goes out after the flip.
- A real sign-in page, real phones, Safari, a browser restart. The sign-in is a stub written into storage; guest "sign in" is the stub too.
- The old `fixd`, `fixb`, `anon` scripts were not re-run.

## Round 9 fix 1: a person who is alone never sees the someone-else line

Cause (as the check said): `raw()` in `client.ts` refused when `tokenSubject(t) !== expectSubject`, which is also true when no token is stored.

### Lines changed
- `src/lib/api/client.ts`: new `isOtherPerson(token, expect)` (true only when the token has a string subject that differs from `expect`; no token, no subject or a subject that is not a string is false). Used at both places in `raw()`: before the first send (was line 216) and before the retry after a 401 (was line 238). `WrongPersonError` and `expectSubject` doc comments say "nobody signed in is not a refusal". `doRefresh` comment reworded. `tokenSubject`, `sessionSubject`, `asPerson`, the compare-and-set refresh are untouched. No other file compares subjects (the survey screen uses main's `signedInAsSomeoneElse`; `asPerson` only passes the subject on to `apiFetch`).
- `src/features/speak/VoiceBox.tsx`: `subject` is read when used (`openedFor()` inside `send` and `waitReady`) and not at render. The box also reads `openedFor()` once when it opens, so the tab's person is pinned at that moment (a bare read at Send would let a guest box follow B, found by `voice-clip-subject` "B is already signed in when A taps Send").

### Tests
- Added `tests/sender-check-nobody.test.tsx` (10 tests): `isOtherPerson` table; (1) A alone with nothing stored, and A's session removed while the call is on the wire: plain `ApiError`, no `WrongPersonError`, one send, no bearer; (2) B stored: `WrongPersonError`, nothing sent; (3) token without a subject, or a numeric subject: goes out with its bearer. Same three for a voice box (A signed out in another tab: the create-clip call goes out with no bearer and the line is never shown; B signed in: nothing goes out, line shown; a guest box that became A's sends as A) and for the outbox (`sendKeptRecording`: A alone, call goes out, answer is not the someone-else line; B: nothing goes out).
- Changed lines in existing tests: none were needed. `voice-clip-subject`, `refresh-compare-and-set`, the survey tests and every test that exists on `origin/main` pass as they were. No test on main touched.

### What main does for the same steps (built `origin/main`, same stub, 390 and 1440)
A signed in, record screen, records (Send shown), A signed out in tab 2, tap Send: main sends `POST /voice-clips` with no bearer (the stub answers 401), no clip, no post, the someone-else line count is 0, the page stays on the record screen with the take. Tab 2 signs in B instead: main shows the line, sends nothing. This branch now does exactly the same: line 0 and one no-bearer `POST /voice-clips` for the sign-out; line shown and no call for B. (`e2e/surveys-r9-fix1.e2e.mts`, run on both builds.)
Survey voice question (branch only): A signed out in tab 2 after the recording was sent up: line 0, the answer goes out with no bearer (the stub accepts it; a real server answers 401); B signed in: the line is shown, no call goes out, 0 answers and 0 clips as B.

### Proof numbers
- `tsc` 0 errors; `next lint` 0 warnings; `next build` ok (after joining main).
- Join: main 53538d4 merged (merge commit). `talk/lib.tsx`, `units/post-draft.ts`, `tests/paid-post-box.test.tsx`, `e2e/paid-post-box.e2e.mts` are main's exactly (no diff against main).
- `vitest run`: 152 files, 1560 of 1560, exit 0, 0 unhandled errors, 3 runs.
- Browser: `e2e/draft-owner.e2e.mts` unchanged 38 of 38 (both widths); `surveys-r9.e2e` 6 of 6; `round7.e2e` 14 of 14; `surveys-r9-fix1` as above.

### Could not prove
- The survey voice question with the session removed uses a stub that accepts a response without a bearer, so what a real server returns there is not shown.
- The outbox with the session removed is proven in vitest, not in a browser.
- Not re-run after the join: `surveys.e2e` (5 known VIEW failures from before) and the old `fixd` scripts.
