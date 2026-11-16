VERDICT: FIX
INTERIM

# Check of V-HOME-NEVER-EMPTY (web), interim

Branch checked: `v/home-never-empty` at d3a737d. Built and run on my own ports against a stub API of my own. No live service called.

## Findings so far, worst first

### MEDIUM 1. `npx vitest run` fails today (exit 1) and the new test does not test the block
- Steps: `npm ci`, `npx vitest run` (twice). Both runs: 157 files, 156 passed, 1 failed; 1595 tests, 1594 passed, 1 failed. Exit 1.
- The failing test is `tests/home-never-empty.test.tsx` "every card from today's question: the block is the one drawn before this change" (line 56).
- Why: `block()` (line 28) takes the first `<section>` that has an `<h2>`. That is the top question card, not the Trending block. The fixture `tests/fixtures/home-trending-today.html` has 0 mentions of "Trending answers" and contains "Closes in 14 days". The test clock now says 13 days, so it fails, and it will fail again as every day passes.
- So the report's "same as today" proof (V-HOME-NEVER-EMPTY-web.md, "Proof for same as today") proves nothing about the block, and the gate is red. The code itself is fine on this point: my own comparison below shows the block is identical to main.
- Fix: pick the section by its heading text, and stop the clock (or leave out the "Closes in" line). Test only, no product change.

## What held so far
- Diff: 11 files. `git diff origin/main -- src/features/speak` is empty. In `tests/` only two new files (the test and its fixture); no existing test edited.
- Same as today (check 2): 2 cards and 3 admin cards + 2, all from today's question; signed in and guest; 390 and 1440; light and dark = 16 cells, both builds. Block outerHTML identical in 16 of 16. Full-page screenshots byte-identical in 16 of 16. The whole page HTML is identical once the script tags are left out (those only carry build hashes).
- Mixed, zero-voices, empty, 5-6 cards, 200-character question, `<b>`/quotes/`<img onerror>` question, and "no question today": 8 cases x 360, 390, 1440 x light, dark = 48 cells. 0 problems: no sideways scroll, no console error or hydration warning, no link in a link or button in a button, heading right ("Trending answers" unless every card is today's), "See all" only when today has voices, "On:" lines are one line with an ellipsis, HTML in a question shows as text, an empty list draws no block and no heading.
- Cards from other questions (admin post of q2, today's voice, voice of q3), at 390 light, 360 dark, 1440 light, 1440 dark: 116 of 116 checks passed. "On:" line text and link; "On:" opens that question; tap on the card opens that card's question; Like sends `PUT /answers/<that id>/like` only; React sends `PUT /answers/<that id>/reaction` only; reply count opens `/q/<its question>/a/<its id>`; three-dot Report goes to `/report/ANSWER/<its id>`; Share creates the link for `ANSWER` + that id and the sheet links carry it; Listen asks for `/voice-clips/clip-<that id>/play` and `POST /answers/<that id>/listen`. Discuss and Vote are buttons on today's question card only (not on answer cards); both open `/q/q1`.
- Record screen from Home (question with ANGRY, TIRED, PROUD, HOPEFUL, and with no words), 390 and 1440, recording + Send (1 clip, 1 post) and typing + Send (1 post): 20 of 20 pass. Same 20 of 20 on main.
- Gates so far: `tsc --noEmit` 0 errors; `next lint` 0 warnings; `next build` passed.

## Still to do (full report follows)
Keyboard order and focus ring; Answers on category, search and landing against main; `e2e/draft-owner.e2e.mts`; the empty-words 422 case; screenshots.
