# V-SURVEYS round 5 (website)

Head: see the last commit on `origin/v/surveys` (the one without `[skip ci]`). Based on 1487f90, joined with `origin/main` (8190305).

## H1: a survey send never carries another person's sign-in
Design (opt-in per call, nothing else changes):
- `src/lib/api/client.ts`: new option `expectSubject` (the token subject the screen loaded with), new `WrongPersonError`, new `tokenSubject()`.
  - `raw()` (about line 195): the token that goes out is read once and its subject is compared in the same step. Mismatch: nothing is sent, `WrongPersonError`.
  - On a 401 (about line 220): before any refresh, the stored sign-in must still be that person's, else `WrongPersonError` and the refresh token in storage is not touched.
  - `doRefresh()` (about line 135): a refresh started by a survey call does not write tokens if the stored sign-in, or the new token, is not that person's. `WrongPersonError` instead.
  - A refused refresh clears the shared session only if the stored sign-in is still that person's (old behaviour otherwise).
  - The retry goes through `raw()` again, so it is checked again before it is sent.
- `src/lib/api/surveys.ts`: `answerSurvey(..., expectSubject)` and `recordSurveyEvent(..., { expectSubject })`.
- `src/features/surveys/SurveyScreen.tsx` (submit, START, SKIP): pass `owner`; on `WrongPersonError` the screen re-checks who is signed in, which turns the tab to the stale notice.
- Not changed: every other call (record screen, posts, votes) behaves exactly as on main. On main a refused refresh still clears the shared session and a refresh still writes its tokens; that wider behaviour is left as it is.

## Per finding
- H1: done, as above. Tests: `tests/surveys-round5-send.test.tsx` (A alone refreshes and sends once as A; B signs in during the 401 wait; B signs in during the refresh call; refresh refused while B signed in; B already in when A presses Send; other calls unchanged; mismatch sends nothing).
- M1: joined `origin/main`. `contract/openapi.yaml`: the server repo's `v/surveys` copy is older than main (it drops main's newer parts), so I did a three-way merge of both sides instead (additive on both sides) and ran `npm run api:types`. The file is reformatted by that merge, so its diff is large; nothing from main was dropped (tsc, 1414 tests pass). `roles.ts` has surveys, brands and users. Settings has the survey switch and the DM switch (behind `DMS_LIVE`, which is `false`). `VoiceBox.tsx` also conflicted (main added the offline keep and the anonymous switch); both sides kept. `git diff origin/main -- src/features/speak` is not empty: it is `VoiceBox.tsx` and `src/lib/api/speak.ts` only, needed for voice answers in surveys. The Home record screen does not use `VoiceBox`.
  Admin pages on a phone at 390 px: `/admin/surveys` was 35 px too wide (the two-column review, and a table); now stacked below 1024 px and the table scrolls inside its card. Results page: five stat boxes now two columns on a phone (L3). The "Back to Sponsored Surveys" link is now 44 px tall. No control under 44 px on the three admin pages or the new-survey form; no sideways scroll.
- M2: `surveySendFailText` in `src/features/surveys/logic.ts`. Offline: "You look offline. We could not confirm your answers were received. Check your connection. Tap Send again: it is safe, your answers are only counted once." No answer in time: "We could not confirm your answers were received. Tap Send again: it is safe, your answers are only counted once." Server fault: "Something went wrong on our side. We could not confirm ..." plus the same last line. Refused: the server's own words. The title is "Your answers may not have arrived". Never "not sent", never "recording".
- M3: the failure line is now inside the survey card, directly above the Send button, role alert, scrolled into view when it appears.
- L1: a ref flag set in the same tick as the tap, so quick repeated taps are one request.
- L3: done. L2 (per-row numbers from the server) and L4 not touched.

## Totals
`tsc` clean, `next lint` clean, `vitest` 129 files, 1414 tests, all pass, `next build` ok. Test edits: two existing branch tests (not on main) looked for the old title "Your answers were not sent"; they now look for the failure line by test id.

## Browser run (Chromium, `next start`, every API call and the sign-in host stubbed), `e2e/surveys-r5.e2e.mts`, 390x844 and 1440x900: 58 checks, all ok
H1 request log (identical at both sizes). A's token run out, Send, 401 after 1.5 s, B signs in in tab 2 at 0.4 s:
`userA:old POST /surveys/s1/responses {q1=h2,q2=o2,q3=f1}` and nothing else. No refresh call, no request as userB, tab 1 shows "You are signed in as someone else in another tab. Reload to carry on.", storage still holds B's tokens.
A alone: `userA:old POST responses` (401), `POST /auth/refresh {refreshToken: A's}`, `userA:new POST responses` (201), Thanks screen.
M2/M3 for offline, no answer (10 s timeout), 500 and 422: right words, line fully in view above Send, one alert, no sideways scroll, no dash. Admin survey, results and brand pages in the phone frame at 390: no sideways scroll, nothing under 44 px. Home record flow (question, Pick one word, Say it in 60 seconds, record, one post; Type it instead; no Messages) passes with `e2e/fixd-round3.e2e.mts`.

## Could not prove
- A real voice answer (recording and upload) across two people: the screen stops the upload steps with `canWrite` as before; the upload calls themselves do not carry `expectSubject`.
- A real phone, and the real server's replay and 409 words.
- Whether main's wider refresh behaviour should change (noted, not changed).
