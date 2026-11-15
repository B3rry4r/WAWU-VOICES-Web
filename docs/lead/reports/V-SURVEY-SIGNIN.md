# V-SURVEY-SIGNIN: a survey with nobody signed in any more

Branch `v/survey-signin`, cut from `origin/main` 61bcfd8. Nothing in `src/features/speak/**`, `VoiceReply.tsx`, `outbox.ts` or `src/lib/api/client.ts` was touched.

## How I reproduced it
- Case A (session ended before the voice take): vitest test 3, and a browser run on the built app. Record, stop: the screen did not move to sign-in (main: test fails).
- Case B (session ended before Send, server answers 401 "Sign in to continue."): vitest test 2 and the browser run. Main shows the server's line only.
- Also the plain case: the session is removed while on a question (test 1). Main never notices.
In the browser the stub answers 401 `{ code: UNAUTHENTICATED, message: "Sign in to continue." }` to every survey and voice-clip route called without a bearer, and refuses a refresh with no stored refresh token. No live service.

## Cause
- `src/features/surveys/who.ts:16-24` (`check()` on main): it only asks "is a different person signed in?". Nobody signed in counts as fine, so focus, visibility, storage, START, SKIP and `canWrite` never reach the signed-out state.
- `SurveyScreen.tsx` `submit()` catch (main ~line 215): a 401 with no session left falls through to `surveySendFailText`, so only the server's line shows.
- Voice take: `VoiceBox` calls `createVoiceClip` before its first `canWrite` check, so the 401 there was shown as a plain note and the screen never learned the session was gone.

## Fix (src only, 14 changed lines)
- `who.ts`: `check()` also asks `isSignedIn()`; when nobody is signed in it sets `out`, returns false (so nothing is sent or cleared), and `useSameWho` returns `out`. Because `check()` already runs on focus, visibility, pageshow, storage, START, SKIP, `canWrite` and submit, all those moments are covered.
- `SurveyScreen.tsx`: the existing signed-out `EmptyState` ("Sign in to answer", button to `/sign-in?next=/surveys/<id>`) now shows when `!signed || same.out`; the `submit` catch takes a 401 when `check()` finds no session (and says nothing else); the survey's `VoiceBox` gets an `errorText` that calls `check()` on a 401 (so the recording case ends on the same state). No new words.
- Drafts are untouched: nothing is cleared, nothing is sent. The someone-else path is unchanged.

## Proof
- `tests/survey-signin.test.tsx`, 6 tests, all pass with the fix. On main's product code (my two files swapped back for main's): 5 of 6 fail, including 1, 2 and 3 (message for each: "Unable to find an element with the text: Sign in to answer"). Test 4 and 5 also fail on main because they first need that state; test 6 (a fine session) passes on main and with the fix. Test 5 pins today's rule: the tab belongs to A, so B gets the someone-else notice and none of A's answers.
- Browser, built app, `e2e/survey-signin.e2e.mts` (new), 390 and 1440: session removed in another tab before the take, session ended silently before the take, session ended before Send then same person signs in again (draft restored, exactly 1 response), a normal run start to done (1 clip, 1 response): 8 of 8 ok. The first two end on "Sign in to answer", someone-else line 0, "Thanks" 0, responses 0, draft still stored.
- `e2e/surveys-r9.e2e.mts`: 6 of 6 ok. `e2e/draft-owner.e2e.mts` unchanged: first run 37 of 38 (one miss, case "4 [390]" banner X with B's kept recording, not in survey code); second run 38 of 38. The verifier saw a similar one-off miss earlier (LOW 3 in the round 9 report).
- `npx tsc --noEmit` 0 errors; `npx next lint` 0 warnings; `npx next build` ok; vitest: see the end of this file.

## The old script (`e2e/surveys.e2e.mts`)
I gave the Home stub 7 trending posts (so the card is below the first screen); no assertion changed. Result: 24 ok, 2 FAIL. H1 and the two "Back with answers" cases now pass. Two cases still fail: "H3 at 390 and 1440: Back with no answers sends one SKIP; closing the tab sends one SKIP". The first half passes; the second half (a full page load to `/sign-in`, expects one keepalive SKIP) gets nothing. This is identical on an unmodified build of main. It contradicts the rule of round 3 (`tests/surveys-round3-public.test.tsx:45`, `e2e/surveys-r3.e2e.mts:161-181`: "closing the tab sends nothing"). I did not change that assertion, so I could not show the script fully passing. It needs a ruling: the assertion is stale.

## Could not prove
- The real sign-in page and a real server (sign-in is a storage write in the stub).
- A voice take recorded while the session was already gone is lost across the sign-in page: accepted, no storage built.
- The "Back with no answers" script cases above.

## STOPPED: one existing test pins the old behaviour
`tests/surveys-round4-who.test.tsx:105-115` ("another tab signs out: same rule as the record screen, the tab stays A's, no someone-else line, nothing is sent as anyone"). It signs out in the other tab and expects the screen to stay on "Question 1 of 2" (line 113). The task asks for the opposite (the sign-in state when nobody is signed in), so it fails with the fix. The someone-else line (112) and no calls (114) still hold. I did not change it. The lead has to rule on the test (it needs `findByText("Sign in to answer")` in place of line 113).

## vitest
`npx vitest run` (1 run, the 2nd and 3rd stopped): 152 files pass, 1565 of 1566 tests pass, 1 fails: the test above. Exit 1, so the "exits 0, 3 times" gate is NOT met until that test is ruled on. Every other test, including the 6 new ones and all survey tests, passes.

## After the owner's order
The lead passed on the owner's order (15 Nov, "Ask to sign in") as a scheduled message; I acted on it as given.

Test changed: `tests/surveys-round4-who.test.tsx`, "another tab signs out". Lines 112 and 114 are as they were.
- Title before: `another tab signs out: same rule as the record screen, the tab stays A's, no someone-else line, nothing is sent as anyone`
- Title after: `another tab signs out: the screen asks to sign in, no someone-else line, nothing is sent as anyone`
- Line 113 before: `expect(screen.getByText("Question 1 of 2")).toBeTruthy();`
- Line 113 after: `expect(screen.getByText("Sign in to answer")).toBeTruthy();`

Merged `origin/main` (9ca43fb) with a merge commit, no conflicts.

Gates after the merge:
- `npx tsc --noEmit`: 0 errors. `npx next lint`: 0 warnings. `npx next build`: ok.
- `npx vitest run`: exit 0 three times, 1568 of 1568 each time.
- `e2e/survey-signin.e2e.mts`: 8 of 8 (390 and 1440). `e2e/surveys-r9.e2e.mts`: 6 of 6. Main's `e2e/draft-owner.e2e.mts`, unchanged: 38 of 38.
- `e2e/surveys.e2e.mts`: its two "closing the tab sends one SKIP" cases are left as they are (the assertion is stale against the round 3 rule; a proof script, not a gate).
