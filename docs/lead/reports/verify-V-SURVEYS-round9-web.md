VERDICT: MERGE

# Verify V-SURVEYS round 9 (website)

Why MERGE: the one HIGH I found on d6ca4b6 (a person alone is shown the someone-else line when their session ends in another tab) was fixed in 09f6f48 and is closed on 0976361 in my own runs. What is left is MEDIUM 1 (a silent Send in the survey voice question) and LOW items. Merge is for 0976361 only; d6ca4b6 alone is FIX. What I did not re-run on 0976361 is listed under "Gates on 0976361" and "Could not prove".

Code under test: first `origin/v/surveys` d6ca4b6 (most of my runs), then 0976361 (see "The head moved" below). Main moved too: 53538d4 (#34), and it is inside 0976361. Built with `next build`, run with `next start`, Chromium (Playwright, fake microphone), 390x844 and 1440x900, several tabs in one browser context. API and sign-in are stubs in the browser; no live service, no `.env`. I changed no product code and no existing test. My attack scripts and one temporary vitest file are not committed (the vitest file was deleted before the gates ran).

## The head moved while I worked
Five commits arrived after d6ca4b6 (the builder saw my interim report): `8ef16e6` report (docs), `53538d4` main #34 "write box cleared once a held post goes out after payment" (main's), `09f6f48` "Sender check refuses only a different person" (**product code**: `client.ts` new `isOtherPerson`, `VoiceBox.tsx` reads the person when it is used), `242c403` browser script, `0976361` merge of main. They touch product code: `src/lib/api/client.ts`, `src/features/speak/VoiceBox.tsx` (branch), and `src/features/talk/lib.tsx`, `src/features/units/post-draft.ts` (these two are main's #34 and are now identical to main). New tests: `tests/sender-check-nobody.test.tsx`, `tests/paid-post-box.test.tsx` (the second is main's). Main's test files are still byte-identical in 0976361 (checked with `git diff` per file).
HIGH 1 below is **CLOSED on 0976361** by my own runs (see the table at the end of HIGH 1). I re-ran on a fresh build of 0976361: my one-person script 14 of 14 (both widths, includes the sign-out case), my two-tab / guest / network script 20 of 20, my survey probe. I did NOT re-run main's `draft-owner.e2e`, my 40-run loop, the surveys scripts, nor the 3 + 3 vitest runs on 0976361: what I have for 0976361 is in the "Gates on 0976361" section. Everything else in this report was measured on d6ca4b6; the diff d6ca4b6..0976361 on the guarded paths is the part listed above.

## Findings, most severe first

### HIGH 1 (CLOSED on 0976361, OPEN on d6ca4b6). A person who is ALONE is shown "You are signed in as someone else", and Send does nothing, when their session ends in another tab
`expectSubject` refuses the call when the stored token's subject differs from the tab's person: `src/lib/api/client.ts:215-216`. With no session in storage, `tokenSubject(null)` is `null`, which never equals "A", so it throws `WrongPersonError` although nobody else is signed in. Main's rule is "nobody signed in is not someone else" (`src/features/speak/draft.ts:94-97`). The wire check does not follow it. Every handler turns the error into the someone-else line: `SpeakScreen.tsx` catch (`OtherTabError || WrongPersonError` -> `sayOtherTab()`), `VoiceBox.tsx` catch, `VoiceReply.tsx`, `outbox.ts` (`message: OTHER_TAB_NOTE`).
Steps (one person, one browser context):
1. Tab 1: A signed in, `/speak`, record 1.3 s. Send is shown.
2. Tab 2: A's session is removed (A signs out, or the session ends).
3. Tab 1: tap Send.
Result, both widths: the line "You are signed in as someone else in another tab. Nothing was saved. Reload to carry on." is shown (count 1), clips 0, posts 0, no sign-in asked. The same script on a build of `origin/main` (557bcbe): line 0, clips 0, posts 0, and the take stays on screen. So this is a regression against main, in code that is only the branch's. Hard rule: a person who is alone sees the line = HIGH.
The same cause in the survey voice question (390, A alone, survey page on question 3):
- Session removed in tab 2 BEFORE A records: the recording stops, nothing is uploaded (clips 0), no message at all, "Send answer" is shown and does nothing (responses 0).
- Session removed AFTER the recording is ready: Send answer shows "Your answers may not have arrived. Nothing was sent, because the sign-in changed. Tap Send again." Tapping again does the same. Nobody is asked to sign in.
Nothing is lost (the take stays on screen); the person has no way forward except a reload.
Not affected (ran, alone): the same person signing out and in again in tab 2 before Send (1 clip, 1 post, line 0); a token that is expired and refreshed (see below); a token whose `sub` is a number or missing (the tab's person is then nobody, so no check, 1 clip, 1 post).
Should: `expectSubject` refuses only when a DIFFERENT person is signed in. No token in storage goes out as on main and ends in "sign in".
**On 0976361** (fresh build, 390 and 1440): the record screen case is fixed: line 0 and the call goes out as on main (my script X1: 2 of 2 ok, same numbers as the main build: clips 0, posts 0 because the stub answers 401 with no token, line 0); token runs out at create, complete, ready, post: 1 refresh, 1 clip, 1 post (8 of 8); B signed in: still refused (P7, and `isOtherPerson` needs a different subject). Survey voice question on 0976361, A alone, session removed in tab 2: AFTER the recording is ready, Send answer posts once (my stub answered 200 to the call with no sign-in; a real server would 401 and the page would ask to sign in); BEFORE the recording: still silent (see MEDIUM 1).

### MEDIUM 1 (open on 0976361). Survey voice question: session ended in another tab BEFORE the person records: recording shows Send answer, but nothing is uploaded and nothing is said
390, A alone, survey question 3, tab 2 removes the session, A records 2 s: the take is shown with "Send answer", clips 0, responses 0; tapping Send answer changes nothing on the screen. No line, no sign-in ask. The take stays on the page and a reload gives the sign-in. Not the record screen and nothing is lost, but the person has no message. Same on d6ca4b6 and on 0976361.

### LOW 1. `asPerson` loses the person when the wrapped call is not one plain `apiFetch` (latent, unused today)
`src/lib/api/client.ts:263-277`. My test (jsdom, 200 interleaved calls, half tied to A while storage held B, half plain): tied calls refused 96, sent 0; plain calls sent 104, all as B, none tied. A call that throws before `apiFetch` leaves nothing behind. The two real uses (`createVoiceReply`, `createVoiceAnswer` in `outbox.ts`) reach `apiFetch` in the same step, so they are safe. But a wrapped function with an `await` before `apiFetch` goes out unchecked (sent as B), and a wrapped function that makes two calls ties only the first. Nobody does either now.

### LOW 2. The builder's `e2e/surveys.e2e.mts` fails 5 cases and the report left it unexplained (answer: the script, not the app)
Same 5 cases fail on the round 8 build (0320dad) and on d6ca4b6: H1 "no VIEW below the fold" and four H3 cases. Cause: the script's Home stub has an empty trending list, so the survey card sits in the first screen and the VIEW fires at once. My own Home run with trending posts: card not in the first screen, VIEWs before scroll 0, after scroll 1 (round 8 and head, 390 and 1440, identical). The count is not inflated and no VIEW goes for a card nobody saw. The script still fails and should be fixed or the cases given a longer feed.

### LOW 3. One flaky case in main's `e2e/draft-owner.e2e.mts` (not reproduced afterwards)
First full run (RUNS=10, d6ca4b6, while I ran other scripts at the same time): 37 ok, 1 FAIL (`R2c [1440]`: "B's recording same: false"). Re-runs of R2c alone: one more FAIL at 390 in the first 3 re-runs, then 12 of 12 ok on d6ca4b6 and 12 of 12 on a build of main (quiet machine), then 8 of 8 on main and 8 of 8 on d6ca4b6 with 4 busy loops on 4 cores. I could not make it fail again and could not find the cause. The code is main's `draft.ts`, byte-identical on the branch, so it is not a branch fault, but in the two failing runs B's recording was reported changed or missing after A's tab acted.

## Round 8 findings, from my own runs

| Round 8 | Now | Basis |
|---|---|---|
| HIGH 1 A's open tab writes, shows, plays, sends, deletes B's recording | **CLOSED** | Main's `draft-owner.e2e` R2a, R2b (SHA-256 of B's recording before and after: equal, A's tab: no Send, no Play, no Delete, clips 0), R2c, R2d at both widths; my own: B signs in between clip create and complete: calls `POST /voice-clips as A`, `complete as A`, nothing as B, line shown (both widths). |
| MEDIUM 1 A signed out elsewhere, tab records as guest, next person takes it | **CLOSED** for the recording | Main's R1a, R1b, R1c at both widths ok. (HIGH 1 above is the same trigger and a different bug.) |
| MEDIUM 2 vitest exit 1 | **CLOSED** | 3 quiet and 3 loaded runs exit 0, no unhandled error. |
| LOW 1 lint warning | **CLOSED** | `next lint`: 0 warnings. |

## 1. The record code equals main plus the sender check
`git diff origin/main -- <the listed paths>`: only 4 files differ, 109 lines.
- `SpeakScreen.tsx` (+17 -...): import `WrongPersonError`; `openedFor() ?? undefined` passed as `expectSubject` to `deleteVoiceClip` (2), `getVoiceClip`, and `const subject = openedFor() ?? undefined` to `createVoiceClip`, `completeVoiceClip`, `createVoiceAnswer`, the catch's `deleteVoiceClip`; the catch takes `WrongPersonError` like `OtherTabError`. All three are the pass-through or the `WrongPersonError` handling.
- `outbox.ts`: `subject = d.owner ?? undefined` to create, complete, `waitReady`, delete; `asPerson` on the two final posts; `WrongPersonError` returns `failed` with `OTHER_TAB_NOTE`; import of `OTHER_TAB_NOTE`. Pass-through and handling only.
- `VoiceReply.tsx`: `clip.subject` as the last argument; `WrongPersonError` -> `OTHER_TAB_NOTE`. Pass-through and handling.
- `VoiceBox.tsx`: `SURVEY_ANSWER` in `Purpose`; `subject` on `ReadyClip`; `const subject = openedFor() ?? undefined` at render (line 77: read on every render, not at Send; harmless); pass-through on create, complete, `getVoiceClip`, delete (3); `WrongPersonError` handling; the optional props `previewHint`, `postingText`, `onReady`, `canWrite`, `send(holdOnly = false)` and the effect that calls `send(true)` only when `onReady` is set.
No change at all in `WriteScreen`, `ReplyComposer`, `lib.tsx`, `units/`, `session-storage.ts`, `auth.ts`. Nothing else in the diff.
Other callers with the optional props absent: `onReady` unset -> the effect returns at once (`!onReady`), `holdOnly` false, `canWrite` unset -> every `canWrite &&` is skipped, `previewHint`/`postingText` fall back to main's strings, `WrongPersonError` branch is the only new path and it is HIGH 1 above. So the other boxes are main's, except for HIGH 1 (a reply box or explain-my-vote with the session gone shows the line). `opened-for.ts` is gone; `grep -rn opened-for src tests e2e` finds nothing.
Main's `e2e/draft-owner.e2e.mts` unchanged, RUNS=10: **37 ok of 38** (the one miss is LOW 3).

## 2. One person, everything (my runs; guest and token cases at 390 and 1440)
- Main's script: voice 10 and typed 10 at each width (1 clip and 1 post per Send, line never shown), token refresh in the middle (own tab and another tab of the same person), kept offline survives a reload and is sent once, two tabs of the same person with one kept recording, a guest records, is asked to sign in, signs in, comes back and sends once: all ok at both widths.
- Mine, token runs out at create, complete, ready, post: 1 refresh, 1 clip, 1 post, line 0 (8 of 8).
- Mine, network aborted once at create, complete, ready, post: 1 post each, line 0 (8 of 8).
- Mine, a guest records, A signs in in tab 2, tab 1 Send: 1 clip, 1 post, all as A, line 0. A token with a non-string subject and with no subject: 1 clip, 1 post, line 0. Three tabs of A, each records and sends: 3 clips, 3 posts, line 0. Tab 2 rotates A's token while the create call is in flight: 1 clip, 1 post, line 0.
- 40 runs (20 at each width), 8 kinds in turn (plain, expiry at create, complete, ready, post, token rotated by tab 2, device clock +3 days, clock -2 days): **40 of 40: 1 clip, 1 post per Send, the someone-else line seen 0 times**, 20 refreshes (one per expiry run).
- A voice reply (builder's `surveys-r9` case b, 390): 1 clip REPLY, 1 reply as A, line 0.
- NOT ok: the signed-out-in-tab-2 case (HIGH 1).

## 3. Two people (main's script plus mine)
Main's R2a/R2b/R2c/R2d, R3 (typed words), 1, 2, 3, 4 (the outbox X): ok at both widths. B signs in exactly between clip create and complete: nothing sent as B, A's calls were as A, line shown on A's tab.

## 4. Surveys in a browser
- Builder's `surveys-r9.e2e` **6 of 6** (390 and 1440): Home card, choice, written, voice (1 clip with purpose SURVEY_ANSWER, 1 answer as A), done; two people on the voice question (clips 0, answers 0, line shown, B's kept recording unchanged); a guest opens a survey, is asked to sign in, signs in, comes back, answers once.
- Builder's `surveys.e2e` at head: 21 ok, 5 FAIL (LOW 2). Admin Surveys list, new survey form, results with the floor text, CSV and Brands passed there.
- Home: with 7 trending posts in my stub it shows 5 (6 Share buttons: 1 daily question + 5), no request to `/dm/` (0), `DMS_LIVE` false (`src/features/dm/live.ts:7`). Survey card is the last block; VIEW goes only when half the card is seen.
- I did NOT re-run in a browser: survey closed or filled while open, brand page, AD_MANAGER and brand roles, the CSV against the page, target under the floor refused, A's typed survey words shown to B. Only the builder's runs and vitest cover them.

## 5. Gates
- `npm ci` ok. `npx tsc --noEmit` 0 errors. `npx next lint` 0 warnings (exit 0). `npx next build` ok.
- `npx vitest run`: 150 files, **1543 of 1543, exit 0, no unhandled rejection** in 3 quiet runs (101 to 106 s) and in 3 runs with 4 busy loops on 4 cores (169 to 174 s). No test failed in any run.
- `contract/openapi.yaml`: the branch's (13 `/surveys` mentions). `DMS_LIVE` false.
- Tests: for every test file that exists on main, `git diff origin/main HEAD -- <file>` is empty (main's tests are byte-identical). `git diff 0320dad..HEAD -- tests` for the four survey files: `leaveTab()` added in setup and at "page load" points, `OTHER_TAB_NOTE` as the wording, `clearDraft` calls added to `voice-clip-subject` `beforeEach`, and the two "signed out in another tab" tests changed as ruled (tab stays A's, no line, nothing sent; B signing in shows the line). Nothing else. The two deleted files are the ruled ones.

## 6. The builder's two flags
(a) `asPerson`: see LOW 1. Safe for the two uses, 200 interleaved calls: no leak, none lost.
(b) VIEW: see LOW 2. The script's stub, not the app.

## Gates on 0976361
- `npx tsc --noEmit` 0 errors; `npx next lint` 0 warnings; `npx next build` ok.
- `npx vitest run`: 152 files, **1560 of 1560, exit 0, no unhandled rejection**, 2 quiet runs (101 s each). I did NOT run the 3 quiet + 3 loaded set again on 0976361 (it was done on d6ca4b6: 3 + 3 of 1543, all exit 0).
- Main's `e2e/draft-owner.e2e.mts` unchanged, RUNS=3, both widths: **38 of 38 ok** (includes R1, R2a-d, R3, 5a-5f).
- My scripts on a fresh build: one person 14 of 14; two tabs, guest, rotation, network drops, B between create and complete, 3 tabs: 20 of 20; survey probe: see MEDIUM 1.
- Main's tests: still byte-identical (per-file `git diff origin/main origin/v/surveys` empty for every test file on main 53538d4). Main (53538d4) is an ancestor of 0976361.
- Not re-run on 0976361: my 40-run loop, the builder's `surveys*.e2e` scripts, admin pages, `asPerson` test (client.ts `asPerson` unchanged in the diff), the payment path with held typed words (main's #34, `forgetPostedWords`; I read it and ran only the repo's vitest for it).

## 7. Join
`git merge-base --is-ancestor origin/main HEAD`: yes. `git merge --no-commit origin/main`: "Already up to date".

## Could not prove
Real sign-in and sign-up pages (stubbed by writing storage); a browser restart; Safari and real phones; the survey cases listed at the end of section 4; the reply box and explain-my-vote with two people in a browser (only the shared code path and the builder's vitest); a cause for LOW 3.
