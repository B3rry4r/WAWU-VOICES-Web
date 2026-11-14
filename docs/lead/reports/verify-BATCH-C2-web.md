VERDICT: FIX

(First version, written as soon as a verdict-changing finding was proved. The full report replaces this file in a later commit.)

Code under test: `verify/batch-c2` = `v/batch-1114c2` at 4abba15 (nothing new on origin/v/batch-1114c2 to merge). One `next build`, served with `next start`; origin/main 59a44d6 built and served the same way against the same stub (contract-driven, own clock, switches). Nothing live called.

## HIGH. A waiting share page is still replaced by the error page when the server render that follows the probe fails twice or more
Run: `/s/<code>` loaded before the instant (390 and 1440), the API answering the browser's probe correctly from the instant, but the page's own server render (server to API) failing with 500: 1 time, 2 times, 5 times.
- 1 failure: recovered, live 4.6 to 5.2 s after the instant (Next falls back to a full page load on the failed refresh, and that load succeeds).
- 2 failures at 390 and 5 failures at 390 and 1440: the page turned into "We could not open that link. Something is not reachable right now. Wait a moment and open the link again. Go to VOICES" 1.6 to 3.8 s after the instant and stayed so to the end of the run (100 s). Picture `docs/lead/batch-c2/shots/h1-c-s5-390-end.png` (looked at). Nothing retries; only a manual reload helps. (2 failures at 1440 happened to recover at 3.8 s: depends on which request meets the failures.)
- The builder wrote this down as "a window of one request; not closed". One 500 in a burst of share-link opens at 23:00 is all it takes; the share link is the page people send each other tonight.
Should be: the coming-up page stays and the watch retries (for example, ask the server page with a plain `fetch` of the page first, or keep the watcher mounted in the error page).
Everything else on the share page held: 500, 502, 503 busy and a hang of 14 s and of 40 s from the instant, and offline then online: "Coming up" at every sample (0 non-coming-up samples of 120 to 360), never the error page, live 0.2 to 17 s after recovery.

## MEDIUM. A 409 CONFLICT "Start again with a new key" is never answered with a new key
Run: signed in, `/q/q9/write`, the server answering 409 `CONFLICT` "Start again with a new key" to every post. Three taps on Post with the same words: same Idempotency-Key all three times (`071bdec8`). Changing one character: a new key (`2b292cb7`), which then repeats. A reload keeps the written words and the held draft's key, so the same key goes out again after a reload. A reply (`?reply=a1`, "I agree"): the same, key `ce751c31` three times, a new key only after editing. What the person sees: nothing in the first screen of a 390x844 phone (the message "This did not post. Something went wrong on our side. Try again in a moment." is drawn at y=893, below the fold; `docs/lead/batch-c2/shots/post409-answer-msg-full-390.png` looked at). The server's own words are not shown. Code: `src/features/talk/WriteScreen.tsx:85` (key kept while the text is the same), `src/features/units/draft.ts:85` (draft keeps the key for the same text).
