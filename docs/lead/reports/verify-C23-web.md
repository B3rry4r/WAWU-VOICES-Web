VERDICT: MERGE

Head checked: origin/v/batch-1114c2 = fde1253 (as expected). Branch `verify/c23-web` made from it. No HIGH, no MEDIUM. Three LOW notes. Real Chromium (Playwright 1.63, `chromium.launch()`), `next start` on the build of fde1253 (port 4201), of 5ce7edb (4202) and of 19c7a7a (4203, second and third folder by `git worktree add`, removed after). API stubbed with `page.route`, and a small local node server for the share page's own server calls. Nothing live was called. My scripts are in the scratchpad, not in this commit.

## Findings (most severe first)

### 1. LOW: with a slow device clock the ask can come up to 5.8 s after the real instant, not "5 s + 100 ms"
- Steps: Home `/`, 390 wide, device clock 3 h slow (and 10 min slow), `Date` header right, page loaded 5 s before the instant. 14 cells per clock, 2 reps x 4 leads + 6 re-runs at lead 5.
- Happened: first ask after the instant at 5.74 s (Home, 3 h slow, lead 5; open at 5.80 s), 5.23 s (3 h slow), 5.12 s (10 min slow). The same kind on the share page with a 10 min fast clock: 5.52 s. All other 140 cells: ask at 0.19 to 5.0 s. Every page was open within 5.8 s of the real instant, never early.
- Should: ask within 0 to 5 s (+100 ms) (C1).
- Why: on a slow clock the server-corrected guess is the early one. It is built from the `Date` header (whole seconds, floored, so it is up to 1 s behind) and, on the share page, from the server's drawing time taken when the page wakes (a few hundred ms later than the drawing). The spread of 0 to 5 s is added on top. That keeps the clock never ahead of the server by design (`src/lib/api/server-clock.ts` `noteServerDate`/`take`, header comment). Not worth a change before tonight; the question opens far inside 10 s.
- Way round: none needed.

### 2. LOW: a double click on a word in a card opens the question
- Steps: Home and Search, 1440, mouse: double click on a word in a text answer.
- Happened: the first click of the double click opens `/q/q9` (selection is empty at that click), so the word is never selected. A drag that selects text does not open it (T1 passes).
- Should: nothing in the brief asks for this; a person who double-clicks to pick a word loses the page they are on. File: `src/components/feed/parts.tsx` `OpenOnTap` onClick (about line 46).

### 3. LOW (test-only note): the added start-watch tests can't see the case behind finding 1
- Not a fault. I list it because `tests/c23-start-watch.test.tsx` uses an exact whole-second header; the 0.7 s over comes from the real floor. READ only, the test run itself is green (below).

## What the product must do: results

| Rule | Result | How |
|---|---|---|
| C1 | Pass except finding 1 (bound exceeded by up to 0.75 s) | RAN, 80 cells + 48 re-run cells |
| C2 | Pass | RAN, 16 cells + 4 cells at 12.5 min lead |
| C3 | Pass | RAN, 48 cells |
| C4 | Pass | RAN |
| M1 | Pass | RAN, pictures and rects, 3 lists x 2 widths x 2 themes |
| M2 | Pass | RAN, conversation page and thread page, 2 x 2 x 2 |
| T1 | Pass (finding 2 on double click; phone long-press not reproducible) | RAN |
| D1 | Pass | RAN through `/units/done?paymentId=<uuid>` |
| Keyboard link name | Pass | RAN (accessibility tree) |
| Regression | Pass | RAN |

### C1, C2: Home and share page, 390, loaded 180 / 100 / 20 / 5 s before the instant, each cell twice
Seconds after the REAL instant. "Before" = asks before the instant, most over the reps, per lead 180 / 100 / 20 / 5 (the page load itself is not counted).

| clock | page | first ask after | open | asks before (180/100/20/5) |
|---|---|---|---|---|
| right | Home | 0.47 to 3.00 | 0.50 to 3.02 | 0/0/0/0 |
| right | share | 0.29 to 4.75 | 0.30 to 4.77 | 0/0/0/0 |
| 10 min slow | Home | 0.60 to 4.46 | 0.62 to 4.48 | 0/0/0/0 |
| 10 min slow | share | 1.11 to 4.07 | 1.13 to 4.09 | 0/0/0/0 |
| 3 h slow | Home | 0.38 to 5.74 | 0.40 to 5.80 | 0/0/0/0 |
| 3 h slow | share | 0.69 to 4.56 | 0.71 to 4.58 | 0/0/0/0 |
| 10 min fast | Home | 1.25 to 3.68 | 1.27 to 3.71 | 2/1/0/0 |
| 10 min fast | share | 0.45 to 5.52 | 0.47 to 5.54 | 2/1/0/0 |
| 3 h fast | Home | 0.47 to 4.93 | 0.49 to 4.95 | 2/1/0/0 |
| 3 h fast | share | 1.35 to 4.84 | 1.37 to 4.86 | 2/1/0/0 |
| C2: device right, header 10 min fast | Home | 1.07 to 4.42 | 1.10 to 4.45 | 2/1/0/0 |
| C2: same | share | 0.19 to 4.28 | 0.21 to 4.30 | 2/1/0/0 |

Fast clocks and C2: the asks before the instant are one a minute (e.g. at -117.7 and -57.7 s for a 180 s lead, -39.5 s for 100 s, none for 20 s and 5 s). The screen turned open 0.02 to 0.06 s after each opening ask.
Re-run of lead 5 (right, 10 min slow, 3 h slow, 3 h fast; Home and share; 6 reps each): max first ask 3.78 / 5.12 / 5.23 / 4.42 on Home, 4.25 / 3.50 / 3.72 / 4.52 on share.

### C2 long: R2 and R3 with the guess arriving while the page waits (lead 750 s = 12.5 min, one run each)
- Device right, header 10 min fast, Home: load -749.6; asks at -594.7 (the server-corrected guess arrives), -589.7 (the single 5 s retry), then -529.7, -469.7 ... -49.7 (one a minute), then +4.98; open at 5.01. Share: -595.9, -590.9, then one a minute to -50.9, then +3.92, open 3.94.
- Device 10 min fast, header right (no 5 s retry expected): Home asks at -597.2 (arrival), -537.2, -477.2 ... -57.2, then +2.83; share -598.6, -538.6 ... -58.6, +1.42. No 5 s retry, one a minute.

### C3: stub keeps saying SCHEDULED for 3 s after the instant (right, 10 min slow, 3 h slow; Home and share; 4 leads x 2 reps = 48 cells)
Every cell opened. In the 21 cells where the first ask came before +3 s (answer "not open") the next ask came exactly 5.00 to 5.01 s later and the page opened from it (examples: [2.15, 7.16], [0.69, 5.69], [0.01, 5.01]). When the first ask came at +3 s or later it opened at once. Never more than 2 asks after the instant. Latest open 7.97 s.

### C4: busy loop
Home, 12.5 min lead, header 10 min fast: 13 requests to the watched endpoint in 12.5 min (the 2 at load, the arrival ask, the retry, then one a minute), 116 timer calls in all (all causes) in about 775 s, 0 under 1 s. 180 s leads: 45 to 53 timer calls per cell, at most 1 under 1 s (page timers, not the watch). Share: 80 to 83 timer calls in 12.5 min.

### Tab hidden at the instant, shown 10 s later (right, 10 min slow, 3 h slow; Home and share; 2 reps; lead 30; 12 cells)
0 asks while hidden. The ask comes at +10.00 to +10.02 s (the moment the tab is shown, nothing before); the screen is open at +10.04 to +10.13 s.

### M1, M2: mood chip (signed in, stub answers HOPEFUL / TIRED / PROUD, 390 and 1440, light and dark)
Chip widths (`getBoundingClientRect`, same at every width and theme): HOPEFUL 83.5, TIRED 60.7, PROUD 67.9, height 26.
- Lists (Home 2 cards, Category 1 at 390 / 2 at 1440, Search 3 cards): fde1253 chip = word width, equal to 19c7a7a; at 5ce7edb the chip was the card width (358 at 390, 640 at 1440). `.vx-answer` boxes at fde1253 equal 5ce7edb in all 12 pictures (e.g. Home 390 `[16,703,358,226] [16,973,358,190]`, Search 1440 `[354,392,640,199] [354,635,640,163] [354,842,640,163]`), and page heights equal. 19c7a7a cards are 30 px taller (the old card; M1 only asks the chip to match 19c7a7a and the boxes to match 5ce7edb).
- Conversation page `/q/q9` (3 answers HOPEFUL, TIRED, PROUD) and thread page `/q/q9/a/a1` (the thread holds one answer, so one chip; the page has no way to show three): 5ce7edb chips 358 / 640 wide, fde1253 83.5 / 60.7 / 67.9; `.vx-answer` boxes identical at both widths and both themes; page heights identical.
- Pixel diff fde1253 against 5ce7edb, all 20 pictures (5 pages x 2 widths x 2 themes): 0 pixels differ outside the chip rows (max difference 0); inside the chip rows 7,176 to 44,524 pixels differ (the chip got narrower). No sideways scroll (scrollWidth equals width in all 20).

### T1: tap and selection (Home and Search)
- Mouse, 1440: plain click on the card text opens `/q/q9`; a drag over the text stays on the list and keeps the selection ("Hopeful, but tired of waiting for things"). Both on Home and Search.
- Text selected somewhere else (the text of card 1, selected by script), then ONE click on card 2's body: it opens `/q/q9`. The press collapses the old selection first; the selection is empty at the click event (read by a capture listener: `""`). So the rule "a selection blocks the open" only applies to a selection made by that same press and drag.
- Touch emulation (Pixel 7, 390): plain tap opens `/q/q9`; with card 1's text selected, one tap on card 2 opens `/q/q9` (selection empty at the click event again).
- Long-press selection: NOT reproduced. Chromium's emulated touch (CDP `touchStart`, 1 s, `touchEnd`) makes no selection and fires a click on release (it opened `/q/q9` on Search), so that run says nothing about a real phone.
- Double click on a word: opens (finding 2).

### Keyboard link
Accessibility tree: with a question text the link is named "Open the conversation: How do you feel about Nigeria right now?" (`aria-label`), visible text "Open the conversation"; reached by Tab, 176 px wide when focused. With `questionText` undefined, empty or null: no `aria-label`, name is "Open the conversation". `getByRole('link', {name})` found both.

### D1: held draft after a purchase (signed in, 390, `/units/done?paymentId=<uuid>`, payment SUCCEEDED, draft held, mood chosen)
Keys of each send to `POST /questions/q9/answers`:

| first answer | return page says | key of send 1 | key of send 2 | result |
|---|---|---|---|---|
| 409 "Start again with a new key" | "Your draft is still saved / That did not post. Tap Post to try again." (no "Start again with a new key") | `held-key-1` | write screen, FIRST Post tap: `b124bf88-5a9c-...` (new; draft key was renewed) | 201, 1 post |
| 500 | "We could not post it just now" + Post it now | `held-key-1` | write screen first tap `held-key-1`, or the button `held-key-1` | 201, 1 post |
| 429 | same | `held-key-1` | same key | 201, 1 post |
| network failure | same | `held-key-1` | same key | 201, 1 post |

409 repeated with the button path off: `held-key-1` then `0bfdb4c4-...` / `e542e21f-...` (new each run). The page after the post (`/q/q9/posted`) showed an application error with my stub, because my stub answers `/answers/a-new` and its `where-you-sit` with an empty list; the same page does the same at 5ce7edb, so it is my fixture, not this change.

### Regression (Home 390, guest)
Three dots: "This voice" sheet opens, URL stays `/`. Share: share sheet opens (one dialog), URL stays `/`. Body tap: `/q/q9`. `document.querySelectorAll('a button, button a, a a, button button').length` = 0 on Home, Category and Search at 390 and 1440 (signed in).

## What I ran

| Item | Result |
|---|---|
| `npm ci` | RAN, ok |
| `npx tsc --noEmit` | RAN, exit 0 |
| `npx next lint` | RAN, "No ESLint warnings or errors" |
| `npx vitest run` (whole) | RAN, 101 files, 1108 tests, all pass, 60 s |
| `tests/round3.test.tsx` + `tests/c23-start-watch.test.tsx` x 20 | RAN, 20 of 20 pass, 113 tests each run |
| `npx next build` of fde1253, 5ce7edb, 19c7a7a | RAN, all exit 0 |
| `npx next start` x 3 (4201, 4202, 4203) | RAN |
| Clock matrix (C1 80, C2 16, C3 48 cells) | RAN, 144 cells, 0 failed to run, 0 page errors |
| Lead-5 re-run | RAN, 48 cells |
| Hidden tab | RAN, 12 cells |
| C2 long (12.5 min lead) | RAN, 4 cells |
| Mood chip pictures and rects | RAN, 20 pictures at fde1253 and 5ce7edb, 12 at 19c7a7a |
| T1 mouse and touch, keyboard name, regression | RAN |
| D1 | RAN, 4 first answers x (write screen, button) |
| The diff `5ce7edb..HEAD -- src` (40 lines) and `useStartWatch`, `server-clock.ts`, `OpenOnTap`, `post-draft.ts`, `draft.ts`, `WriteScreen.tsx` send/renew paths | READ |
| Earlier reports `verify-C22-web.md`, `verify-BATCH-C2-web-2.md` | READ |

## Not proved
- A real phone: long-press selection, a real `Date` header floor from a CDN, real clock steps (clock shifted by an init script on `Date` only).
- Fixtures are mine, from the contract shapes. The payment page's balance line first read "NaN" with my first payment fixture and was right after I gave it its fields; not a product fault.
- Guest and signed-in were not crossed on every check: the clock runs and T1 were guest, the chip pictures and nested-button query signed in.
