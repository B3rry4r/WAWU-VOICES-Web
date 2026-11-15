# V-R2C-FLAKE: the lead's own runs before release (15 Nov 2026)

Head under test: c069880 (branch `v/r2c-flake`, main 61bcfd8 merged in). This branch (`v/r2c-fix`) is that head plus this file.

## What the fix is
`src/features/speak/draft.ts`, `loadDraft`: the loop that removes recordings other people left behind now re-reads who is
signed in right before each delete and stops when it is no longer the person the pass began for. One line changed. Nothing
else in `src/` differs from main. `e2e/draft-owner.e2e.mts` is main's exact text.

## Why
A page load that began for A read "who is signed in" once and removed other people's recordings several awaits later. If B
signed in and kept a recording inside that window (about one second on a slow device), A's pass removed B's recording. The
builder caught it in 2 of about 120 stressed runs of case R2c (4x CPU throttle, 40 ms IndexedDB open delay); two other
sessions had each seen one miss in the same script.

## Runs by the lead (local build, `next start`, Chromium, 390x844 and 1440x900)
- `e2e/draft-owner.e2e.mts` unchanged, RUNS=5: 38 of 38 ok, exit 0.
- The two-people cases again (`ONLY=R2`, RUNS=5): 8 of 8 ok.
- `e2e/surveys-r9.e2e.mts`: 6 of 6 ok. `e2e/paid-post-box.e2e.mts`: 6 of 6 ok.
- vitest `tests/draft-owner-stale-pass.test.tsx`, `tests/draft-owner.test.tsx`, `tests/draft-owner-2.test.tsx`: 20 passed.
- The builder: `tsc`, `next lint`, `vitest run` green on this head. Its 300 stressed runs and 5 full runs were still going
  when this was released; its final numbers land on `v/r2c-flake` in `docs/lead/reports/V-R2C-FLAKE.md`.

## Accepted
On the diff read (one line) and the runs above, under the lead's rule for fixes of 30 source lines or fewer.
