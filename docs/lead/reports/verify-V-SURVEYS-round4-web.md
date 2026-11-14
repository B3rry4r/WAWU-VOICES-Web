VERDICT: FIX

# Verify V-SURVEYS round 4 (website)

Code under test: `origin/v/surveys` 1487f90 (round 4 head). It is 19 commits ahead and **17 commits behind `origin/main`**, and a merge of `origin/main` into it has 4 conflicts (see M1). So I ran everything on a local merge of `origin/main` into 1487f90 (conflicts resolved by keeping both sides; not pushed). One `next build`, `next start` on port 3991, Chromium (Playwright), every API and sign-in call answered by a stub (`context.route`; the sign-in host too), no live service, no `.env`. Every request's Authorization subject, Idempotency-Key and body was logged. Scripts are in my scratch folder only; nothing but this report is pushed.

Round 4 closes most of round 3's HIGH (N6): a stale tab now stops before it sends. One way around it is left, and it is the same harm: A's answers can still go out under B's token (H1).

## Findings, most severe first

### HIGH

**H1. A's answers can be sent with B's token when A's sign-in has run out and B signs in during the send.**
- Where: `src/lib/api/client.ts:167` (token read as the request goes out), `:151-152` and `:190` (on a 401 the client refreshes with whatever refresh token is in shared storage now, then `raw(path, opts, true)` sends the same body again and reads the token from storage again), `SurveyScreen.tsx:207` (`check()` runs once, before the call, never before the retry). The builder's report names this gap ("A 401 refresh mid-write ... not guarded").
- Steps (390x844, one browser, two tabs; stub accepts any valid refresh token):
  1. Tab 1: sign in as A, open the survey, answer Q1 and Q2, pick a choice on Q3. A's access token has run out (a tab left open for a while).
  2. Tab 1: tap Send answer. The server answers 401 after 1.5 s (a slow connection).
  3. Tab 2, during that wait: sign in as B.
- What happened: `userA POST /surveys/s1/responses idem=06c9ba {q1=h2,q2=o2,q3=f1}`, then `POST /auth/refresh {refreshToken: B's}` (A's tab used B's refresh token), then `userB POST /surveys/s1/responses idem=06c9ba` with A's exact answers and A's key. Tab 1 afterwards showed the stale notice, but the request had gone.
- Should: a survey send never carries a token that is not the one the tab loaded for. Check the person again before the retry (or send with the tab's own token and refuse the retry if the stored subject changed).
- Related, same cause: when the refresh is refused, `client.ts:191` clears the shared session, so A's old tab can sign B out. When the refresh gives A tokens while B has just signed in, A's tokens overwrite B's sign-in in storage (run 1c2: refresh sent with A's token, B signed in during it, B's tab 2 session is replaced). This part is old client behaviour on main too.
- Likelihood is low (two people, one device, B signs in inside the 401 window), but it is exactly "one person's answers sent as another".

### MEDIUM

**M1. The branch does not merge into the current `origin/main`.** 17 commits behind; conflicts in `contract/openapi.yaml` (4 hunks), `src/lib/api/types.ts` (3), `src/features/admin/roles.ts` (page id union: surveys, brands vs users), `src/features/profile/SettingsPage.tsx` (the survey switch vs the DM switch). All four are "keep both" and my merge built, type-checked and passed lint. After it, `src/features/dm/live.ts` says `export const DMS_LIVE = false;` (the file is not on the branch; it comes from main). Someone must do this merge before release.

**M2. Wrong words when a send fails to reach the server.** `SurveyScreen.tsx:243` uses `refusalText` from the record screen. After a dropped connection, a timeout (10 s) or an aborted reply the banner says "You are offline. Your recording is kept. Check your connection and try again." A survey has no recording (choices only), and a timeout is not always offline. Worse, when the first request had landed (I made the server record it and then drop the reply, and again with a 12 s reply), the banner says "Your answers were not sent" although they were. The retry is safe (same key, one answer; see "One answer set"), and ends on "Thanks. Your answers are in.", but the first message is untrue.

**M3. A failed send is still invisible (round 3 N7, not fixed).** `SurveyScreen.tsx:349`: the red "Your answers were not sent" box is drawn under the "What the brand can see" card. After a 500 on the last question: at 1440x900 it sits at y=929 on a 900 high screen; at 390x844 it sits at y=797, behind the tab bar. The page does not scroll to it. The Send button looks dead. (Pictures: my scratch `s-q3-fail-390.png`, `s-q3-fail-1440.png`.)

### LOW

**L1. Three presses inside one tick send three requests.** Three `click()` calls in one script task send the answer three times, all with the same Idempotency-Key, so the server counts one. A real double tap (`dblclick`) sent exactly one. The `busy` flag is only set after render.

**L2. The results page trusts per-row numbers from the server.** `SurveyResultsPage.tsx` draws every `byState` and `byAgeBand` row and the "Other" line as sent (no floor check per row). With a stub row `Kano 2 answers` it drew "Kano 2 8%". The floor is applied for whole report (`showsPeople`) and for hidden choices, so this only matters if the server sends a small row. Hidden choices are drawn as "Fewer than 20 answers, not shown", bar width 0, no number in text, aria, titles or page source (the count and share do sit in the JSON the page keeps in memory and in the response).

**L3. Results page is 5 px too wide on a phone.** At 390 the released report has `scrollWidth` 395 (five stat boxes in `grid-cols-5`, `SurveyResultsPage.tsx`), so the admin page scrolls sideways a little.

**L4. Round 3 LOW items N8 to N11 were not touched** (builder's list); I did not re-test them.

## What held

1. **Nothing crosses between people on one device.** 14 runs in `p1`, 3 in `p1b`. A answers Q1 and Q2 (and picks Q3), then:
   - B signs in and reloads: Question 1, nothing ticked, none of A's answers on Q2; requests with B's token: GET, START only. Storage holds `wawu.survey.userA.s1.draft` (A's two answers) and `wawu.survey.userB.s1.*` separately; B never reads A's key. A's draft is kept for A only.
   - B signs in in tab 2 while tab 1 is open: tab 1 shows "You are signed in as someone else in another tab. Reload to carry on. Nothing was sent." before any tap; Send, Skip and Leave have gone (0 survey requests after B signed in, three runs).
   - Same instant (B's sign-in and A's Send in one `Promise.all`): 0 sends.
   - A's token expired, B signed in first, then A presses Send: 0 writes.
   - Guest: "Sign in to answer", 0 survey calls; after A signed out: no A answers on screen, no call with A's token.
   - Back and forward after B signed in: B sees Question 1, no A answers; 0 requests with A's answers under B.
   - Connection dropped (aborted reply), B signs in, back to A's tab, Send: notice, 0 writes.
   - Only the expired-token case in H1 failed.
2. **Stale tab**: notice appears on the storage event without a tap; with the press made in the same instant nothing is sent (above). If the other tab only signed out the line says "You are signed out in another tab."
3. **One answer set**: double tap, 500 then retry (same key, two requests, ends on Thanks), lost reply then retry (same key; the server's replay or a 409 both end on "Thanks. Your answers are in."), real 10 s timeout whose first request landed (2 requests, one answer), second tab finishing first (tab 2: one 201; tab 1's different answers got 409 and say "Thanks. Your answers are in.", no second set). The only false words are in M2.
4. **Results**: below the floor (9 of 20) the page draws only Seen, Started, Skipped, no choices, no state table, no percentages, also when the server's `belowMinimum` is wrongly false (the page counts the responses itself). Hidden choice never drawn (see L2). A member sees "This account is not an admin"; a guest sees the admin sign-in; EDITOR and MODERATOR see "We could not find that" and the report is never requested; AD_MANAGER and ADMIN see the results. There is no brand-user screen on the website at all: brands do not sign in, they get the released report by email and the CSV from staff, so "a brand user sees only their own surveys" cannot be tested here. The public brand page (`/brands/<slug>`) sends no Authorization header, shows only that brand's surveys, and an unknown slug says "We could not find that brand".
5. **DMs off**: after the merge `DMS_LIVE = false`; across Home, survey Q1/Q3/Done, brand page: no Messages control, 0 requests to `/dm` or `/messages`; `/messages` shows the not-found page (390 and 1440). The survey code has no `/dm/` or Messages reference.
6. **Record screen**: `git diff origin/main...origin/v/surveys -- src/features/speak` is `VoiceBox.tsx` (+38/-6: optional `previewHint`, `postingText`, `onReady`, `canWrite`, purpose `SURVEY_ANSWER`) and `src/lib/api/speak.ts` (one type). The Home record screen does not use `VoiceBox` (only replies, vote explanation and surveys do). Run at 390x844, signed in, live question: Home, Speak, "Pick one word", HOPEFUL, "Say it in 60 seconds" reaches `/q/q9/speak?mood=HOPEFUL`, a 2 s take recorded (Send shown); "Type it instead" reaches `/q/q9/write?mood=HOPEFUL`; no sideways scroll.
7. **Screens** 390x844 and 1440x900 (Q1, Q3, failure, Done, brand page, Home): `scrollWidth` equals the width on all of them; Send answer reachable without scrolling; no en or em dash in any text a person reads (scripted on the rendered text).

## What I ran (on the merge of main into 1487f90)
- `npx tsc --noEmit`: exit 0.
- `npx next lint`: no warnings or errors.
- `npx vitest run`: 119 files, 1299 tests, 1298 passed, 1 failed: `tests/round4.test.tsx` "the route's error boundary shows the waiting state" (a share page timer test, not surveys). It failed while the production build ran next to it and passes alone (8 of 8). Treated as a load flake, not a defect of this branch.
- `npx next build`: compiled, 61 static pages, exit 0.
- Browser: 14 + 3 privacy runs, 12 one-answer runs, 14 results and access runs, 8 record-flow runs, 10 screen runs (the failed ones are the ones named above; two of my own checks were wrong and I corrected them: a same-tab script sign-out gives no storage event, and offline mode does not stop routed requests, so I used aborted replies).

## Could not prove
- A real voice answer (recording, upload, held clip) across two people: I did not run it through the stub; the code guards it with `canWrite` (`VoiceBox.tsx`), unproved by me.
- A token with no `sub`: all such people share the owner name "unknown" in storage keys. My tokens have a `sub`.
- A real phone (app switch, page restore from the browser's cache, tab discard); real server rules (idempotency replay, 409 text, whether the real server sends counts for hidden choices).
- Whether the Home survey card and the Settings survey switch still work after the merge: only seen as present, not exercised.
