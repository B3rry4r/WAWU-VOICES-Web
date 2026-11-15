VERDICT: FIX
INTERIM

# Verify V-SURVEYS round 9 (website), interim

Code under test: `origin/v/surveys` d6ca4b6 (no newer head at 05:56 UTC, 15 Nov). `next build` + `next start`, Chromium (Playwright, fake microphone), 390x844 and 1440x900, API and sign-in stubbed in the browser context. My scripts are not committed. No product code or existing test changed. No live service, no `.env`.

## Finding so far

### HIGH 1. A person who is ALONE sees "You are signed in as someone else" when their session was signed out in another tab, and nothing is sent
`expectSubject` compares the stored token's subject with the tab's person: `src/lib/api/client.ts:215-216` (`tokenSubject(t) !== expectSubject` throws `WrongPersonError`). With no session in storage `tokenSubject(null)` is `null`, which never equals "A", so the call is refused even though nobody else is signed in. Main's rule is "nobody signed in is not someone else" (`draft.ts:94-97`, `signedInAsSomeoneElse`); the branch's wire check does not follow it. The handlers turn the error into the someone-else line (`SpeakScreen.tsx` catch: `OtherTabError || WrongPersonError` -> `sayOtherTab()`; same in `VoiceBox.tsx`, `VoiceReply.tsx`, `outbox.ts`).
Steps (one browser context, one person):
1. Tab 1: A signed in, `/speak`, record 1.3 s. Send is shown.
2. Tab 2: A signs out (session removed from storage).
3. Tab 1: tap Send.
Result, both widths (390 and 1440): the line "You are signed in as someone else in another tab. Nothing was saved. Reload to carry on." is shown (count 1), clips 0, posts 0, no sign-in is asked. On main the call goes out, gets a 401, the refresh is refused and the person is asked to sign in (to be confirmed against a main build in the full report). The hard rule: a person who is alone sees the line = HIGH.
Same person signing in again in tab 2 before Send: 1 clip, 1 post, line 0 (ok).
Should: `expectSubject` must refuse only when a DIFFERENT person is signed in (stored subject is a string and differs). No token in storage must go out as on main (and end in the sign-in ask).

## What I ran so far
- `npm ci` ok. `npx tsc --noEmit` 0 errors. `npx next lint` 0 warnings. `npx next build` ok. (vitest: running, numbers in the full report.)
- Join: `git merge-base --is-ancestor origin/main HEAD` yes; `git merge origin/main` says "Already up to date".
- Tests: for every test file that exists on main, `git diff origin/main HEAD -- <file>` is empty (main's tests are byte-identical). `git diff 0320dad..HEAD -- tests` for the four survey files: only `leaveTab()` added, `OTHER_TAB_NOTE` as the wording constant, the two "signed out in another tab" tests changed as ruled, and `clearDraft` calls added in `voice-clip-subject` `beforeEach`. Nothing else.
- `opened-for.ts` is gone; `grep opened-for src tests e2e` finds nothing. `DMS_LIVE` is `false` (`src/features/dm/live.ts:7`).
- Code diff against main on the record paths: only the `expectSubject` pass-through, `WrongPersonError` handling, `SURVEY_ANSWER`, the optional survey props (`previewHint`, `postingText`, `onReady`, `canWrite`, `send(holdOnly)`) and `asPerson` in the outbox. One more difference: `VoiceBox.tsx` computes `subject = openedFor() ?? undefined` on each render (not at Send). Full line list in the full report.
- One person, token runs out at create, complete, ready, post (refresh works), 390 and 1440: 1 refresh, 1 clip, 1 post, line 0, 8 of 8. Refresh refused at create: line 0.

## Not yet done (full report follows)
Main's `e2e/draft-owner.e2e.mts` totals, two and three people, surveys in a browser, admin, vitest 3 quiet and 3 under load, `asPerson` interleave, the extra VIEW event (round 8 build vs this head).
