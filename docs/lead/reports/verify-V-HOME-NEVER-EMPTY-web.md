VERDICT: MERGE

# Round 2: re-check at a058b8b

Head checked: `origin/v/home-never-empty` at a058b8b. I built it and `origin/main` (8851c92) in clean scratch copies and ran them on my own ports against my own stub. No live service called. Both of the builder's answers hold. No new finding.

## 1. The diff (`git diff d3a737d origin/v/home-never-empty`)
- Product: one line, `src/components/feed/parts.tsx:76`, the "On:" wrapper `grid gap-[6px]` becomes `grid grid-cols-[minmax(0,1fr)] gap-[6px]`. Nothing else under `src/` changed (so `src/features/speak/` is still untouched).
- Tests: only the builder's own two files changed (`tests/home-never-empty.test.tsx`, `tests/fixtures/home-trending-today.html`). No existing test edited. The rest is the builder's report and two pictures under `docs/`.

## 2. MEDIUM 1 (red test): fixed
- `npx vitest run`, twice: 157 files passed, 1595 tests passed, 0 failed, exit 0 both times.
- The test now finds the block by its heading text (`trendingBlock()`) and checks the html holds "Trending answers", "Body of voice1" and "Body of voice2". The fixture is now the real block (1 mention of "Trending answers").
- The fixture is what main writes: in a clean copy of `origin/main` I ran the new test file with `WRITE_FIXTURE=1` and the file came out byte for byte the same as the fixture on the branch (`cmp` says identical).
- It goes red on one character: fixture "Body of voice2" changed to "voice3" gives 1 failed, 3 passed; put back, 4 passed. In the product, `gap-3` changed to `gap-4` at `parts.tsx:65` (the list inside the block) gives 1 failed, 3 passed; put back, 4 passed. (Both changes were in my scratch copy only.)
- No longer depends on the day: with the machine date moved 0, +1 and +30 days (a preload that shifts `Date`; I proved it reaches the test by printing 2026-12-16 inside vitest at +30), the file passes 4 of 4 each time. For contrast the old test from d3a737d failed 1 of 4 at +0 and at +30.

## 3. MEDIUM 2 (card to the screen edge): fixed
Measured with Chromium, light, my stub. Reference = `origin/main` build, written card and voice card from today's question. New build: written and voice card from another question, from today's question, and with a 200-character question (written and voice). Left edge, right edge and farthest edge inside the card:

| width | main written / voice | new: all 5 kinds of card |
|---|---|---|
| 360 | 16 to 344, farthest 336 | 16 to 344, farthest 336 (5 of 5 equal) |
| 390 | 16 to 374, farthest 366 | 16 to 374, farthest 366 (5 of 5 equal) |
| 1440 | 354 to 994, farthest 986 | 354 to 994, farthest 986 (5 of 5 equal) |

- 15 of 15 cards equal main's edges; 0 failing. (Before the fix the voice card was 16 to 360 at 360.)
- No sideways scroll at 360, 390, 1440 (page width equals window width).
- The "On:" line with a 200-character question: one line (height 18 px), cut with an ellipsis, right edge 344, 374, 994 = the column's edge, so it widens nothing.
- No console errors in the new build. Picture: `docs/lead/reports/verify-home-never-empty/r2-edge-360-new.png` (compare with `edge-360-branch.png` and `edge-360-main.png` from round 1).

## Same as today again (16 cells)
2 cards, and 3 admin cards + 2; signed in and guest; 390 and 1440; light and dark, new head against main: block outerHTML identical 16 of 16; full-page screenshots byte-identical 16 of 16; whole page identical 16 of 16 once script tags (build hashes only) are set aside.

## 4. Gates
`npx tsc --noEmit`: 0 errors. `npx next lint`: no warnings or errors. `npx next build`: passed. `npx vitest run`: 1595 of 1595, twice.

## Not re-run
The rest of round 1 (controls on the right card, record screen, 422 case, e2e) was not repeated: the product change is one class. The round 1 text below is for the earlier head d3a737d.

---

# Round 1: check of d3a737d (superseded by Round 2 for the two MEDIUMs)

Branch checked: `v/home-never-empty` at d3a737d. Built (`npx next build`) and run (`npx next start`) on my own ports, next to a build of `origin/main` (8851c92). API always my own stub in the browser; no live service called, nothing sent to usevoices.com.

The record screen held in every run. No HIGH found. Two things to fix before this is called clean: a red test, and a card that runs to the screen edge on a 360 phone.

## Findings, worst first

### MEDIUM 1. `npx vitest run` fails today, and the new test does not test the Trending block
- Steps: `npm ci`, then `npx vitest run`, twice. Both: 157 files (156 passed, 1 failed), 1595 tests (1594 passed, 1 failed), exit 1.
- Failing: `tests/home-never-empty.test.tsx`, "every card from today's question: the block is the one drawn before this change", line 56.
- Cause: `block()` (line 28) takes the first `<section>` with an `<h2>`. That is the top question card. The fixture `tests/fixtures/home-trending-today.html` has 0 mentions of "Trending answers" and holds "Closes in 14 days". Today it says 13 days, so it fails, and it will fail again every day the date moves.
- So the report's "same as today" proof does not cover the block, and the check is red. The code is fine here: my own comparison (below) shows the block is the same as main.
- Fix is in the test only: find the section by its heading text and stop the clock (or leave the "Closes in" line out).

### MEDIUM 2. At 360 wide, every voice card from another question runs to the right screen edge
- Steps: 360x740, light. Stub: today's question q1; cards = admin text post of q2, then a voice of q3. Open Home.
- Numbers: column is x 16 to 344. The text card is 16 to 344. The voice card is 16 to 360 (16 px too wide, no right gutter, its right border is cut). Same on 4311 with a 200-character question and a short one. On main, a voice card in the same place is 16 to 344. At 390 and 1440 it is fine.
- Not a sideways scroll (page width 360 = window width 360), so not HIGH. Pictures: `edge-360-branch.png` (new) and `edge-360-main.png` (main).
- Cause (my reading): the new wrapper `grid gap-[6px]` at `src/components/feed/parts.tsx:~73` has one automatic column. The voice player's smallest width (344) is bigger than the column (328), so the column grows. The mood-word wrapper in `TalkCard.tsx` is the same kind of grid, so a voice with a word chip may show it on main too; I did not test that.
- A likely fix is to let the column shrink (`grid-cols-[minmax(0,1fr)]` or `min-w-0` on the card). I did not change code.

### LOW 3. After a refused Send, the same Idempotency-Key is reused with a changed body
- Found while doing check 6. First Send (no word) got 422; after reload and picking HOPEFUL, the second Send carries the same key (`d290b86a...` on `/answers`, both times) with a body that now has `mood`. My stub does not care. A real server that stores a key with a refused request could answer with a "key reused" error. The code handles that (`needsNewKey`), so the person would see "That did not post. Tap Send to try again." and a new key; I could not prove which the real server does.
- Also the voice clip is uploaded again on the second Send (2 clips for 1 post; the first was left over). `POST /voice-clips` has no key. Not from this change.

## What I ran and what held

1. **Diff.** 11 files. `git diff origin/main -- src/features/speak` is empty. In `tests/`, only the two new files (`home-never-empty.test.tsx`, `fixtures/home-trending-today.html`); no existing test edited. Source changes read line by line: `HomeScreen.tsx` (heading, See all, `shown`), `parts.tsx` (prop `questionId`, "On:" link).
2. **Same as today.** 2 cards, and 3 admin cards + 2, all from today's question; signed in and guest; 390 and 1440; light and dark = 16 cells on both builds. Block outerHTML identical 16 of 16. Full-page screenshots byte-identical 16 of 16. Whole page HTML identical 16 of 16 once script tags are set aside (they only differ in build hashes). Desktop heading "Top voices on today’s question" and See all unchanged.
3. **New cases.** mixed, today with 0 voices, empty list, 5 and 6 cards, 200-character question, `<b>`, quotes and `<img onerror>` in the question, no question today = 8 cases x 360, 390, 1440 x light, dark = 48 cells. 0 problems: no sideways scroll (page width), no console error, no hydration message, no link in a link or button in a button, headings right ("Trending answers" unless every card is today's; 0 voices gives "Trending answers" on desktop too), See all only when today has voices, empty list draws no block and no heading, "On:" is one line with `nowrap` and ellipsis (a 200-character text is 204 characters in the page, one line), HTML shows as text and no `<img>` was created. (MEDIUM 2 is about the card inside, which that check did not measure.)
4. **Each control acts on its own card.** Cards: admin post of q2, today's voice (q1), voice of q3. At 390 light, 360 dark, 1440 light, 1440 dark: 116 of 116 checks. "On:" text and link; "On:" opens `/q/<that question>`; a tap on the card opens its own question; Like = `PUT /answers/<id>/like` only; React = `PUT /answers/<id>/reaction` only; the reply count opens `/q/<its question>/a/<id>`; the three-dot Report link is `/report/ANSWER/<id>`; Share posts `{ANSWER, <id>}` and the sheet links carry that id; Listen asks `GET /voice-clips/clip-<id>/play` and `POST /answers/<id>/listen`, and stays on Home. Discuss and Vote are buttons on today's question card only, not on answer cards; both open `/q/q1`.
5. **Keyboard.** Tab order (390 light, 1440 dark): See all, hidden "Open the conversation" link, "On:" link, then the card's More, Like, React, Reply, Share (voice: Play, Position, Speed first), then the next card. The hidden link shows when focused. "On:" shows the site's focus ring (2 px gap plus 2 px coloured ring) in light and dark (`focus-on-390-light.png`).
6. **Other users of `Answers`** (category `/c/money`, search `/search?q=fuel`, landing `/welcome`): 12 cells (3 pages x 390, 1440 x light, dark), main against branch: HTML and screenshots identical 12 of 12; 0 "On:" lines.
7. **Record screen from Home** (question with ANGRY TIRED PROUD HOPEFUL, and with no words), 390 and 1440, fake microphone: pick-one-word screen shows the question, "Pick one word", the four words, "Say it in 60 seconds", "Type it instead"; with no words it opens on the recorder ("Tap to record", "Start recording", "Prefer to type? Write instead"). Record + Send = 1 clip and 1 post; type + Send = 0 clips and 1 post. 20 of 20; the same 20 of 20 on main.
8. **`e2e/draft-owner.e2e.mts`**, unchanged, against the branch build: 38 ok, 0 failed (cases 4 and 5e also passed this time).
9. **Gates.** `npm ci` ok. `npx tsc --noEmit`: 0 errors. `npx next lint`: no warnings or errors. `npx next build`: passed. `npx vitest run`: exit 1, twice (see MEDIUM 1; 1594 of 1595 passed).

## Check 6: the question had no words when the page loaded, then Send is refused with 422
Stub: `/questions/q1` sends `moodOptions: []`. Send answers 422 `{ code: "VALIDATION_FAILED", field: "mood", details: [{ field: "mood" ... }], message: "Pick one word before you post." }`. 390 wide. Nothing lost in any run.

**Voice**
- The person records 1.4 seconds and taps Send. They stay on the recorder. At the top is the line "Pick one word before you post." The recording is still there ("Listen back", Re-record, Delete, Send). It is also kept on the phone (one stored take, 1.45 s). There is no way to pick a word on that screen; Send again would get the same 422.
- After a reload (question now has the four words) they land on the "Pick one word" screen. They pick HOPEFUL and tap "Say it in 60 seconds". The kept recording comes back ("Your word HOPEFUL", Listen back, Send). Send = 1 clip and 1 post, body `{kind: VOICE, clipId, mood: HOPEFUL}`, and the Posted screen shows ("You’re live", "Your word: HOPEFUL").
- Totals over the whole round: 2 clips, 2 post requests (the first was the refused one).

**Typed**
- They write "My own typed words about today." and tap Post. The page opens `/q/q1/write`, the words are still in the box (31 / 500), and Post is still there. (The line itself was not captured in the text I read; the stored refusal did show a 422.) 
- After a reload the same words are kept (the typed draft survives). They pick HOPEFUL, tap "Type it instead", the words are in the box, Post = 1 post, body `{kind: TEXT, body, mood: HOPEFUL}`, Posted screen shows.
- Totals: 0 clips, 2 post requests.

Pictures: `mood-voice-after422.png`, `mood-typed-after422.png`, `mood-voice-reload.png`.

Not HIGH: no lost recording and no lost typed words.

## What I could not prove
- Behaviour against the real new server; only against my stub with the described shape.
- What a real server does with a reused Idempotency-Key after a refused request (LOW 3).
- That a mood-word card (chip) overflows at 360 on main (MEDIUM 2).
- Real microphone and real audio; the fake device gives a short tone, and audio files are stubbed.
- Widths other than 360, 390, 1440; browsers other than Chromium.
- My stub's own gaps showed up twice (the Posted screen needs `/answers/<id>` and `/where-you-sit`); I filled them in and the same gap crashed main's page the same way before I did, so it is mine, not this change.

## Pictures (under `docs/lead/reports/verify-home-never-empty/`)
`edge-360-branch.png`, `edge-360-main.png`, `blk-long-360.png` (200-character question), `blk-mixed-390-dark.png`, `blk-zero-1440.png`, `focus-on-390-light.png`, `mood-voice-after422.png`, `mood-typed-after422.png`, `mood-voice-reload.png`.
