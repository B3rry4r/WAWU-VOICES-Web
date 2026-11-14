VERDICT: FIX

# Verify V-SURVEYS round 5 (website)

Code under test: `origin/v/surveys` a259ee4 (round 5 head), branch `verify/surveys-5`. It is behind `origin/main` (79c7a9c), so I also ran everything that matters on a local merge of main into it (conflicts kept both sides, not pushed). Chromium (Playwright), `next build` and `next start` for three builds (branch 3991, origin/main 3992, merge 3993), every API call and the sign-in host answered by a stub, no live service, no `.env`. I changed no product code and no tests. Scripts stay in my scratch folder. Only this report is pushed.

The survey answer, START and SKIP are now safe in every race I could build (see "What held"). Two holes remain in what sits next to them: the voice clip calls (H1) and the plain calls the survey screen makes (H2).

## Findings, most severe first

### HIGH

**H1. A voice answer: A's recording is created and uploaded as B, and A's tab spends B's refresh token.**
- Where: `expectSubject` is passed only for the survey answer, START and SKIP (`SurveyScreen.tsx:130,147,224`). The four voice clip calls (`createVoiceClip`, `completeVoiceClip`, `getVoiceClip`, `deleteVoiceClip`, `src/lib/api/speak.ts:27-30`) are plain `authed` calls. They run from `VoiceBox.send` (`src/features/speak/VoiceBox.tsx:195-262`), which starts by itself when the recording stops (`:272-278`). `canWrite()` is asked before the create (`:198`), before complete (`:227`), before ready (`:232`) and before the post (`:241`), but never after a 401 refresh and never before the bytes go up (`putWithRetry`, `:229`). A plain call that gets a 401 refreshes with whatever refresh token is in shared storage at that moment (`client.ts:222-225`) and retries with the new token.
- Steps (390x844, one browser, two tabs, fake microphone; survey with Q1 choice, Q2 voice; the stub accepts any valid refresh token and also answers the clip upload URL):
  1. Tab 1: signed in as A, A's access token has run out. Open the survey, answer Q1.
  2. Tab 1: Start recording, wait 2.3 s, Stop recording. The clip is made and uploaded by itself.
  3. The create-clip call gets a 401 after 1.5 s (slow network). At 0.4 s after Stop, in tab 2: sign in as B.
- Request log (ms after Stop; Authorization subject, call):
  - `+52 userA:old POST /voice-clips {purpose SURVEY_ANSWER, audio/webm, sizeBytes 6670, durationMs 2345}`
  - `+1564 POST /auth/refresh {refreshToken: rB-1}` (A's tab used B's refresh token)
  - `+1569 userB:2 POST /voice-clips` (same body: A's recording made as a clip of B)
  - `+1575 PUT /put/c-userB-2` (6670 bytes, A's audio, uploaded into B's clip)
  - Storage after: B's tokens rotated to `B2/rB-2` by A's tab. Tab 1 shows the stale notice only afterwards. No survey answer went out, so the choice answers are safe, the voice is not.
- Second case (V3): A's token is accepted at create and upload, then runs out at complete; B signs in during that 401 wait. Log: `userA:new POST /voice-clips`, `userA:new POST /voice-clips/c-userA-new/complete` (401), refresh, 401 again (my stub keeps A's token expired), then `POST /auth/refresh {refreshToken: rB-1}` and `userB:2 POST /voice-clips/c-userA-new/complete`. A's tab completes A's clip as B.
- Both reproduce on the branch and on the merge build.
- Should: nothing of A's recording (create, bytes, complete, ready check, delete) goes out with a token that is not A's, and A's tab never refreshes with B's refresh token. Pass `expectSubject` on the four voice clip calls, and ask `canWrite()` before the byte upload. The real server may refuse a clip route by owner; I could not test that, and the metadata and the bytes are sent anyway.
- What held in the same family: B already signed in before the recording stops (nothing goes out, V-pre); B signs in while the bytes go up with A's valid token (V2: bytes go to A's own clip, no complete, no answer); a held voice answer, B signs in, A taps Send (V4: no call at all).

**H2. A plain call in a survey tab can still overwrite B's fresh sign-in with A's tokens.** (Same code is on `origin/main`, the builder named it, and it is narrow. It is a sign-in overwritten, so I rate it by the rule.)
- Where: `client.ts:128-172` `doRefresh` writes the new tokens (`sessionStorage.setTokens`) whatever is in storage now. Only calls with `expectSubject` are protected. The survey screen's own load call `getSurvey` (`src/lib/api/surveys.ts:25`) and the Home card's VIEW are plain.
- Steps: tab 1 signed in as A with an expired token, opens `/surveys/s1`; the survey GET gets a 401; the refresh takes 1.5 s; at +0.7 s tab 2 signs in as B.
- Log: `POST /auth/refresh {refreshToken: rA-old}` at +272 ms. Storage after: `A_NEW / rA-new`. B's sign-in in tab 2 is gone; B's next action is made as A.
- Same run on the `origin/main` build with `/profile` (GET /me 401): identical, `A_NEW (B overwritten by A)`. So it is old behaviour on every screen, not new in round 5.
- Should: a refresh writes tokens only if the refresh token in storage is still the one it started from (compare and set), for every call. Otherwise discard.

### MEDIUM
None new. The round 4 MEDIUMs hold (M1 join with main: the merge is below; M2 words and M3 visibility: see "What held").

### LOW

**L1. Results page draws per-row numbers the server sends, even under the floor.** `SurveyResultsPage.tsx:306,321`. With a stub row `Kano 3 answers 4%` and `25-34 4 answers 7%` it draws "Kano 3 4%". Hidden choices are right (counts 13 and 7 and shares 17% and 12% are not in text, aria, titles or page source; the bar is not drawn). The contract says the server folds small rows into "Other" (`openapi.yaml` byStateOther), so this only matters if the server is wrong. Same as round 4 L2, untouched.

**L2. At 1440 on the admin new-survey form, "Add a choice" is 36 px tall and the two selects are 43 px.** The admin sidebar links are 40 px (shared chrome from main, not new). At 390 inside the phone frame nothing is under 44 px on any of the pages.

**L3. The Home survey card's VIEW call has no `expectSubject`** (`SurveyFeedCard.tsx`). It sends no answers; the worst case is one view counted for the wrong person.

## What held

1. **H1 of round 4 is closed for the survey answer, START and SKIP.** Request log checked in every case: no request with A's answers under a token that is not A's; B's sign-in never overwritten or cleared; B's refresh token never used; A's tab turns to the stale notice. Run at 390x844 with slow (1.5 s) and fast (about 0 to 150 ms) networks:
   - (a) B signs in before Send: 0 requests.
   - (b) B signs in during the first request: only `userA:old POST responses`, nothing after.
   - (c) between the 401 and the refresh (another tab holds the refresh lock, B signs in, lock released): only the first request, no refresh.
   - (d) during the refresh call, slow and fast: `userA:old POST`, `refresh {rA-old}`, nothing else; B's tokens intact (A's new tokens are dropped).
   - (e) around the refresh answer, 6 offsets from -60 ms to +20 ms: either nothing goes out, or the retry goes out as A before B signed in (`userA:new`, same key). Never as B.
   - (f) A's refresh refused: B signed in during the 401 wait, or during the refresh call: nothing cleared, B intact. A alone refused: signed out, correct.
   - (g) B signs in then out during the 401 wait; B in and out before Send; B in, A taps, B out, A taps again: 0 sends, notice "signed out in another tab".
   - (h) guest tab: "Sign in to answer", 0 survey calls; stale notice when B signs in elsewhere.
   - (i) three tabs (A, A, B): both A tabs sent with expired tokens, B signs in meanwhile: only `userA:old` requests, no B token, no B refresh.
   - A alone: `userA:old POST` (401), one `POST /auth/refresh {rA-old}`, `userA:new POST` with the same Idempotency-Key, Thanks screen. Also with a network drop on the retry then a second tap: same key, one more `userA:new`.
   - Two full runs of the whole script on the merge: 58 of 58 ok each. One run before that (started while three other scripts ran) had 1 FAIL line that I could not reproduce in either rerun; I did not capture which case.
2. **The shared client is not changed for everyone else.** `git diff origin/main -- src/lib/api/client.ts` on the merge is additive only: `WrongPersonError`, `tokenSubject`, the `expectSubject` option, an optional `expect` argument through `refreshSession` and `doRefresh`, and three guards that all start with `expectSubject !== undefined`. Scripted on the origin/main build and the merge build (same script, same stub): text and voice post with a run-out token (401, one refresh, one post, same key, then the posted screen), two tabs refreshing at once (1 refresh, both tabs succeed, one set of tokens), a refused refresh (signed out; the typed words and the recorded take are still on the screen), a 401 on a GET (refresh then retry; refused: signed out), offline (the offline words, still signed in). The two builds give the same sequence in every case. The only difference is how many background unread-count GETs fire, and that also differs between two runs on main itself. (The unmerged branch differs from main in the news-tag question and one extra `/me` call; those come from main's newer commits.)
3. **Record screen.** `git diff origin/main -- src/features/speak` on the branch is not empty only because main moved on after the earlier merge (SpeakScreen, draft.ts, parts.tsx, speak.css, speak.ts: main's changes). On the merge it is `VoiceBox.tsx` (+38/-6) and `speak.ts` (one type). Every changed line is an optional prop (`previewHint`, `postingText`, `onReady`, `canWrite`) or the `SURVEY_ANSWER` purpose; with none passed the code path is unchanged. At 390x844, signed in, open mood question (ANGRY, TIRED, PROUD, HOPEFUL, 60 seconds): the question text, "Pick one word", the four words, "Say it in 60 seconds", "Type it instead", "Share my word" all present, no sideways scroll, no Messages. Pick HOPEFUL, record with the fake microphone, Send: `create clip, complete, POST /questions/q1/answers {kind VOICE, clipId, mood HOPEFUL}` once, then the posted screen. "Type it instead" goes to `/q/q1/write?mood=TIRED`. Voice reply in a thread: `POST /answers/a2/replies {VOICE, stance DISAGREE, anonymous}` once. A voice reply saved offline (draft in the browser holds the reply target, stance DISAGREE and the name switch), reload, back online: one reply sent. I did not see the "Your saved voice was posted" note in that run (the reply count was right).
4. **True words and a visible failure (M2, M3).** For offline, 10 s timeout, 500, 422, and a first request that landed with the reply dropped, at 390x844 and 1440x900 (80 checks, 0 failed): the title is "Your answers may not have arrived"; offline says "You look offline. We could not confirm your answers were received. Check your connection. Tap Send again: it is safe, your answers are only counted once."; timeout and the dropped reply say the "could not confirm ... Tap Send again" line; 500 says "Something went wrong on our side. We could not confirm ..."; 422 shows the server's own words. Never "not sent", never "recording", no dash. The line sits directly above Send inside the screen (390: y 314-530 with Send at 546; 1440: y 390-510, Send 526), exactly one `role=alert` on the page, no sideways scroll. The retry sends the same Idempotency-Key, one answer set, ends on "Thanks. Your answers are in." (the stub's replay answer 200 also ends there).
5. **Join with main** (details below): all green after keeping both sides; `DMS_LIVE = false` (`src/features/dm/live.ts:7`); on the merge the Home screen draws both the survey card and the audio advert, no Messages, no sideways scroll.
6. **Admin pages** `/admin/surveys` (and the new-survey form), `/admin/surveys/s1/results`, `/admin/brands`: at 390 in the phone frame `scrollWidth` 390, every button, link, select and input at least 44 px; at 1440 `scrollWidth` 1440. Below the floor (9 of 20): only Seen, Started, Skipped; no choice, share or state drawn. Floor numbers for hidden choices: not in text, aria, titles, `style` or page source (see L1 for the server's own small rows).
   (My script printed two "FAIL" lines for the results page: that was my own check counting the server's Kano and age rows as hidden-choice numbers. The hidden-choice numbers are not drawn.)

## Join with main (local merge of origin/main 79c7a9c into a259ee4, not pushed)
- Conflicts: 5 files. `contract/openapi.yaml` (2 hunks, both descriptions: I took main's longer text), `src/components/feed/HomeScreen.tsx` (survey fetch and audio advert fetch, both kept, destructuring fixed by hand), `src/components/vx/vx.css` (both blocks kept), `src/features/admin/AdsPage.tsx` (brand page picker and the picture and audio pickers, both kept), `src/features/admin/roles.ts` (page ids: surveys, brands, users, ideas, people kept).
- `npx tsc --noEmit`: 0 errors. `npx next lint`: no warnings or errors. `npx vitest run`: 140 files, 1491 tests, all pass. `npx next build`: ok.
- Contract: compared as parsed YAML. Main at 8190305 versus branch head: every path, operation and schema is there; only four additive differences (`brandId` on AdminAd and UpsertAdRequest, `useMyStateForSurveys` on Settings and UpdateSettingsRequest, `SURVEY_ANSWER` in VoiceClipPurpose, one `/me/settings` description). The branch head alone lacks main's newer 5 paths and 19 schemas (proposals, topic summary draft, request-verified and their schemas); the merged file has all 179 of main's paths and every schema, 194 paths in all (main's plus the 15 survey and brand paths). The only differences from main in the merge are the five additive items above.

## What I ran (totals)
- On the branch a259ee4: `tsc` 0 errors; `next lint` clean; `vitest` 129 files, 1414 tests, all pass; `next build` ok.
- On the merge: as above (1491 tests).
- Browser: survey send attacks (a) to (i) and A alone, 58 checks, 2 full clean runs on the merge, and one on the branch; voice cases V1 to V4 on the branch and the merge; failure words, 80 checks on each of branch and merge; shared client cases R1 to R5 (8 cases) on main, branch and merge; record flow F1 to F3 on the branch and the merge; Home on the merge; admin pages at 390 and 1440 on the branch and merge; one extra H2 run on branch-merge and one on main.

## Could not prove
- What the real server does with a clip created under another person, or a refresh token used from another tab; the real replay and 409 words.
- A real phone: app switching, a restored page, a discarded tab.
- By reading only, not run: a plain call that joins a refresh started by a survey call (they share one in-flight promise, `client.ts:225`) receives `WrongPersonError`, which no other screen expects. It appears only when the refresh is dropped for the wrong person.
- The single unreproduced FAIL line in one concurrent run of the attack script.
- Attribution: the commit trailer follows the session's own attribution note (Claude Sonnet 5.5), not the lines in the task.
