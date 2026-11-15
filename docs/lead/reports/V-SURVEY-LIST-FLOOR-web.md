# V-SURVEY-LIST-FLOOR (web)

Branch `v/survey-list-floor`, cut from origin/main 9ca43fb. No pull request opened.

## Lines changed (source: 11 added, 2 changed, 3 files)
- `src/features/admin/survey-floor.ts:17-21`: the sentence and `listHidden(q)` (TEXT or VOICE, `answered` a number above 0, list empty).
- `src/features/admin/SurveyResultsPage.tsx:~283`: one line where the list would be (the count above it is untouched).
- `src/features/admin/survey-csv.ts:~72`: one Note row, same style as the existing "Too few answers to show" row.
- `tests/survey-list-floor.test.tsx`: 9 tests. No existing test or assertion was touched. No existing test pinned "an empty list with a count shows nothing".

## Failures on origin/main (new tests, old source)
- written question: Unable to find an element with the text: Too few answers left to show.
- voice question: same
- CSV sentence: expected the CSV to contain 'Note,Say more,Too few answers left to show.'
- CSV matches the page: expected +0 to be 2
(Passing on main as they should: 6 items, answered null, answered 0, not released.)

## Browser (built app, `next build` + `next start`, API stubbed, Chromium)
390x844 and 1440x900, one hidden written list, one hidden voice list, one full list of 6:
- "45 answered this question" shown twice; the line shown 2 times; the 6 items shown; no sideways scroll.
- CSV downloaded: the sentence 2 times (page 2, CSV 2, match); the 6 free answers listed; phone and desktop CSV identical.
- Files in `docs/lead/proof/survey-list-floor/` (screenshots, both CSVs, `run.mts`).

## Gates
- `npx tsc --noEmit`: 0 errors. `npx next lint`: 0 warnings. `npx next build`: ok.
- `npx vitest run`: 154 files, 1571 tests (the 9 new ones included), exit 0 three times.

## Not proved
- The server change (list arriving empty) is another builder's; only the stubbed shape was tested.
- Commit trailers use the session's own attribution (Claude Sonnet 5.5), not the Fable 5.2 line in the brief.
