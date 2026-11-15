# V-SURVEYS round 4, website (stale tab, per-person keeps, join with main)

Heads: started from local `v/surveys` cf5693f (behind); fast-forwarded to origin 174a63c (the head the check tested). Fix e3d510c (pushed). Join + key rule effdef0 (pushed). Final head: see `git log` (adds the live notice line, the browser script, this report).

## Rules as coded (tests in `tests/surveys-round4-who.test.tsx`, 12 tests)
1. Keys per person and survey: `src/features/surveys/logic.ts:50-55` (`wawu.survey.<person>.<survey>.<started|draft|skipped>`), every function takes the owner the screen was loaded for (`SurveyScreen.tsx:92`, never "whoever is signed in now"). Tests: B fills a draft, signs out, A signs in: A sees A's position and A's answers, B's draft stays B's; a guest has no key and no call. Rule followed: NOT the held post draft rule (`units/draft.ts` keeps one browser-wide draft per question, not per person). Surveys need sign-in, so a guest has no draft to hand on; ruling 1 was followed as written.
2. A tab knows who it belongs to: `src/features/surveys/who.ts:7-45` (`whoNow` reads the session in storage; `useSameWho` checks on the storage event, focus, pageshow and visible). `check()` runs before START (`SurveyScreen.tsx:127`), SKIP/leave/draft clear (`:141`), submit (`:207`), voice delete and each voice upload call (`:307`, `VoiceBox.tsx:148,175,180,189` via an optional `canWrite` prop; the record screen's behaviour is unchanged without it). Notice "You are signed in as someone else in another tab. Reload to carry on." with Reload: `SurveyScreen.tsx:62`; if the other tab only signed out the line says so (my addition, same button). Tests: storage event, Submit with no event, visible, focus path, no START/SKIP after, reload shows B's empty survey with B's own START, signed out then B.
3. Sign-out clears nothing: `clearSurveyKeeps` and its call in `src/lib/api/auth.ts` removed. Test: other people's keys remain, 0 survey requests.
4. Closed list re-run: see below.

## Two-tab run (Chromium, one context, `context.route`, `e2e/surveys-r4.e2e.mts`, built app, 390 wide, twice: once with the storage/focus events delivered, once with them swallowed so the press itself has to find out)
A signs in (tab 1), answers Q1, Q2, picks Q3. Tab 2: sign out, sign in B. Delivered: notice showed in tab 1 on its own (tab 1 never touched). Swallowed: pressing Send answer showed the notice. Requests from tab 1 after B signed in: 0 and 0 (count 0 as B). Reload: B sees "Question 1 of 3", nothing chosen, one `userB:START`. B answers Q1, tab 2 signs out and signs in A, tab 1 reload: "Question 3 of 3", A draft `q1=h2,q2=o2`, B draft `q1=h1`, both under their own keys. Responses sent in the whole run: 0. Events in the whole run: `userA:START`, `userB:START` only (no SKIP on any reload). Pictures: `docs/lead/surveys/shots-r4/` (6). The sign-in and sign-out in tab 2 are written to the session in local storage exactly as the app does it, not typed through the sign-in screen.

## Closed list re-run (round 3 checker's items)
No SKIP on reload/hide/pagehide, one START: `tests/surveys-round3-public.test.tsx` (11 of 11) and the browser run above. Storage keyed by person, voice kept when ready, Record again deletes, closed survey words, paged review, Release gate, null answered, missing breakdowns: the round 2/3 survey test files, all pass (108 of 108 in `tests/surveys*`).

## Test assertions changed (ruling 3)
`surveys-round3-public.test.tsx` "person B on the same tab..." : old `expect(keys()).toEqual([])` after sign out; new: keys equal A's `draft` and `started` (nothing cleared). Describe title reworded. No other existing assertion changed.

## Join with main (`git merge --no-ff origin/main`, 5c54f5d)
One conflict, `src/components/feed/HomeScreen.tsx` (imports; the `useLoad` call): kept both: main's import list and third argument (opening watch) plus the survey placement import and `survey` in the returned data. Cards, `TalkCard frame`, tick, legal pages, admin sign-in `admin` prop came in untouched. Key rule: the survey answer now sends an Idempotency-Key (`SurveyScreen.tsx:113,219-240`, `answerSurvey` takes it); kept after a failure, dropped after success or when `needsNewKey`. Tests: 500 then success sends the same key twice; IDEMPOTENCY_KEY_REUSED gives a different key. The voice upload already follows it in `VoiceBox` (main). START/SKIP are fire-and-forget, never retried, so no key.

## Contract
Cloned the API branch `v/surveys` (8e4e705, read only). Its survey part equals what this branch had; the rest of the file differs only because the API branch is older than main (e.g. 2 free posts, main says 5). I kept the merged `contract/openapi.yaml` (main + surveys), ran `npm run api:types`: `types.ts` unchanged. The reworked server half was not there yet.

## Commands
`npx tsc --noEmit` exit 0. `npx next lint` no warnings or errors. `npx vitest run` 110 files, 1222 tests, all pass (before the join: 97 files, 990). `npx next build` compiled. `npx tsx e2e/surveys-r4.e2e.mts` passed.

## Not done / unsure
No unit test for the voice upload guard (needs the recorder mock); the browser run covers choices only. A 401 refresh mid-write reads the token again from storage; not guarded. Sessions in `sessionStorage` are per tab, so A's draft is found again only in the tab it was made in. Not touched: N7 to N9, N11 of the round 3 check.
