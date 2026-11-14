# V-PRELAUNCH web round 2

Branch v/prelaunch. Checks at the end: `tsc --noEmit` clean, `next lint` clean, vitest 88 files / 870 tests passed, one `next build` ok (50 pages), Playwright `e2e/opening.e2e.mts` all ok against that build (`next start`, stub API, servers stopped). Pictures: `docs/lead/prelaunch/shots-r2/` (40, 390x844 and 1440x900, dpr 2, before and after). I opened: Home guest 390 before, Speak 390 before, landing 1440 before, /join 390 slide 2 before, share sheet refused 390. The rest are asserted by text in the e2e.

## Items
1. **Turns live by itself.** `src/components/feed/useLoad.ts`: `useLoad(fn, deps, pending?)` and `useStartWatch` (exported). Timer at instant + random 0 to 5 s, retries 5/15/30 then every 60 s while visible, wake at most every 15 s and read the real clock, refetch on visibilitychange/focus/online/pageshow if past the instant or data older than 30 s, silent refetch (card stays until the API says open). Nothing pending means one load and no more requests. Used by Home (`HomeScreen.tsx`, question and topic), `Landing.tsx`, `Go.tsx`, `Onboarding.tsx`, `QuestionScreen.tsx` (also reloads voices when it opens), the door (`OpenGate`) and the share page (`ShareOpening`, `router.refresh()`). Coming-up is now decided only by the API's status SCHEDULED, never by the device clock (`feed-format.ts`: `notOpenYet`, `comingUp`, `topicNotStarted`, `questionStart`, `topicStart`, `soonest`), so no live buttons before the API agrees.
   Measured on the build, running clock, nobody touching the page, instant to live: go 444 ms, home 1406, welcome 2646, join 3269, question 3993 (limit 10 s). Zero requests from load to 2 s before the instant. Page asleep (clock jumped 8 h, visibility and focus fired): go 54 ms, welcome 57, home 59, join 63, question 113 (limit 2 s).
   Tests: `tests/opening.test.tsx` (14, fake clock: each of five screens live within 10 s, asleep live within 2 s, request count, retry steps, background, open question never polled, no live card before API agrees).
2. **Action addresses.** `src/features/talk/OpenGate.tsx` wraps `/speak` (via `SpeakGate`), `/q/<id>/write|speak|mood|propose|vote|results|posted` and `/q/<id>/next`: coming-up page (`ComingUp.tsx`, same markup the question page used) until the API says open; "This question has closed" is untouched and now only for a question that is not scheduled. The shell Speak button and sidebar land on `/speak`, so they land there too. A question it cannot read passes through to the screen's own error.
3. **Calls.** Landing and /go: no "Listen as a guest", no "Add your voice" before opening (and none while loading); "Join VOICES" (existing words, `/join`) and "Sign in" stay; the landing page also hides the voice card under the question. Home: no "Listening is free" banner; "Weekly report" row only when `GET /weekly-reports/latest` returns a report (`LinkCards.tsx`).
4. **Headings.** Home "New conversations" not drawn when empty (always, also when open). /join: no player, waveform, 0:06, chips or Open poll while coming up; slide 2 shows the coming-up card.
5. **Share.** Share on the coming-up card and question page was already pushed by the first builder; kept. Share page: server page also hides voices, poll, lean and proposal sections for a coming-up question, and redraws itself at the opening. Sheet: if the API refuses the link for a coming-up question, "We cannot make a share link for this question yet. You can copy the address of this page and send that." plus a "Copy this page's address" button (`ShareSheet.tsx` prop `notOpen`).
6. **Year.** `format/date.ts` `longDay`: "Monday 27 September 2027" when not the current Lagos year. Lagos time kept.

## Existing tests changed (rule change: only the API's word decides)
`tests/prelaunch.test.tsx`: "a scheduled question is not open before startsAt and is again at it": old `comingUp(SCHEDULED, at) === undefined`, `comingUp(..., BEFORE)` with a clock argument; new: no clock argument, SCHEDULED stays coming-up whatever the clock says. "a topic that has not begun...": old `topicNotStarted(SCHEDULED, 16 Nov, 15 Nov 23:00Z) === false`; new: SCHEDULED is not started, LIVE is. Nothing else edited. The merged builder test for the share page needed `comingUp(page.question)` (no `now`).

## Choices
- Weekly report row: if the lookup errors it is drawn only when the question is open (keeps main's picture for a stub without the endpoint).
- Topic week watched only within 3 days of its Lagos midnight.
- /go for a signed-in person before opening: no bottom bar, header shows only Home.

## Not done
- Discover and category empty headings (M1 beyond Home), bell count mismatch (M3, API), L2 to L4. Topic cards on Discover, category and search do not turn live by themselves on Monday (they change on the next load).
- Real devices, real API, real nginx cache not tried. The e2e logs two 404 "Failed to load resource" from stub endpoints I did not stub.
