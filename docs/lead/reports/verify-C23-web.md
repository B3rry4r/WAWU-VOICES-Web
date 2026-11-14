VERDICT: FIX
INTERIM

Provisional, written at the 25 minute mark. Head checked: origin/v/batch-1114c2 = fde1253 (as expected). No HIGH found so far. The mood chip, tap/selection, keyboard link name, held draft, regression and gate runs (tsc, lint, vitest, 20x loops) are NOT done yet; the verdict stays FIX until they are. The final replaces this file.

## Done so far (RAN)
Real Chromium (Playwright) on `next start` of fde1253, API stubbed with `page.route` plus a small local stub server for the share page's own calls. Device clock shifted by an init script (`Date` only, `performance.now` left alone), stub `Date` header = real time unless stated. 390 wide. Home `/` and share page `/s/<code>`. Loaded 180, 100, 20, 5 s before the real instant; each cell twice. 144 cells + 12 hidden-tab cells; 0 failed to run.

- C1 (right, 10 min slow, 3 h slow, 10 min fast, 3 h fast; 80 cells): first ask after the instant 0.29 to 5.52 s, screen open 0.02 s after that ask. One cell over the 5.1 s bound: Home, 3 h slow, loaded 5 s before: ask and open at 5.74 / 5.80 s (the other run of the same cell 0.38 s). To be re-run. Before the instant: 0 asks for right and slow clocks; fast clocks 1 ask per minute at most (-117.7 and -57.7 s for 180 s lead, -39.5 s for 100 s lead, none at 20 s and 5 s).
- C2 (device right, header 10 min fast; 16 cells): ask after the instant 0.19 to 4.42 s, open right after; before it one ask a minute at most (same pattern as a fast clock).
- C3 (stub says SCHEDULED for 3 s after the instant; right, 10 min slow, 3 h slow; 48 cells): every time the first ask got "not open", the next ask came 5.00 s later and the page opened from it (e.g. [2.15, 7.16], [0.69, 5.69]). When the first ask came after 3 s it opened at once.
- Hidden tab at the instant, shown 10 s later (right, 10 min slow, 3 h slow, Home and share, 12 cells): 0 asks while hidden; the ask is at +10.00 to 10.02 s (the moment it is shown); open 10.04 to 10.13 s.
