# V-ROUND4-FIX: the two release failures in tests/round4.test.tsx

## Short answer
The failures are not caused by #32 (8f7e287). The cause is a random number in the retry watch, and it is the same on c934e9b and 8f7e287. Product code is unchanged. Only the tests were changed, so the random number is fixed in them.

## Cause
`src/components/feed/useLoad.ts:108`, `const spread = Math.random() * SPREAD_MS;`. A waiting page asks the first time at the instant plus a random 0 to 5 s, then 5, 15, 30, 60 s after that ask.
When the draw is under about 0.1 s (about 2 runs in 100 per test):
- the 2nd ask lands at about 5.0 s, inside the tests' first 5.1 s step. Counts become 2 instead of 1 ("expected 2 to be 1": attempt 2 of the release, and `opening.test.tsx` "asks again after 5, 15, 30").
- in "the route's error boundary ...": the 2nd ask happens while `mode` is still "500", the 3rd ask is at 20 s, too late for the 10.1 s check, so the page still shows `share-waiting` (attempt 1 of the release).
It does not depend on load. Load only changes how often a run is hit by other timing, and nothing here is real-time dependent at a high draw.

## Proof of the cause (Math.random pinned, same tests, both commits)
Draw 0, 0.019: 3 of 3 tests fail on both c934e9b and 8f7e287 (the opening test also fails at 0.021).
Draw 0.1, 0.5, 0.9, 0.99, 0.999: 3 of 3 pass on both. (Error boundary test at 0.97 to 0.999 under 8 busy loops, 6 runs each: all pass.)
So #32 changes nothing here. I found no line in #32 that adds a request or moves a retry in the share page tree (the share page tree does not use the changed code).

## Reproduction numbers (3 tests, 4 busy loops, 4 parallel runs, unfixed tests)
- c934e9b: 4 failures in 30 runs.
- 8f7e287: 1 failure in 30 runs.
- First try on 8f7e287 under 8 busy loops: 1 failure in 10 (opening test, "expected 2 to be 1").
Small counts, same order of size; the pinned-draw table above is the stronger evidence. I did not get 2 of 2 failures like the release runner. Two bad runs in a row at about 7 % per run is possible (about 0.5 %), but I cannot prove it was only that.

## Fix
Tests only. Each `expect` is unchanged.
- `tests/round4.test.tsx`: in the first `describe` (share page), a `beforeEach` that does `vi.spyOn(Math, "random").mockReturnValue(0.5)` (spread 2.5 s), and an `afterEach` that restores it. 6 lines added. The second `describe` (409 test) is not touched.
- `tests/opening.test.tsx`: in `describe("every screen turns live ...")`, the same spy in the existing `beforeEach`, restore in the existing `afterEach`, plus one `let` line. 5 lines changed. This covers the flaky "asks again after 5, 15, 30 then every 60" test: same cause.
Why 0.5: all ticks then have at least 2.6 s of margin (asks at 2.5, 7.5, 22.5, 52.5, 112.5 s against ticks at 5.1, 10.1, 25.1, 55.1, 115.1 s).

## Proof after the fix
- The 3 tests, 200 runs (4 workers x 50) with 4 busy loops: 0 failures.
- Whole `npx vitest run`: 5 runs under pressure: exit 0 each, 1403 of 1403. 3 runs quiet: exit 0 each, 1403 of 1403.
- `npx tsc --noEmit`: clean. `npx next lint`: no warnings or errors. `npx next build`: ok.
- `e2e/draft-owner.e2e.mts` not re-run: no file the record flow uses was touched.

## What I could not prove
- Why the release runner failed 2 of 2 (only chance fits my numbers).
- I did not measure the high-draw, slow-machine case on the release runner. If another real-time-dependent failure shows up there with the fix, the draw is not its cause.
