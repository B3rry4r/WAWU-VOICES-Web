# Lead record: voice cards fit the screen on small phones

Found on the live site, 16 Nov 2026, about 01:05 UTC, at 360 wide on the first question's page: every voice card with a word chip ran from x 16 to x 360 (right border cut, no right gap); written cards ended at 344. At 390 every card ended at 374.

Cause: `src/features/talk/TalkCard.tsx:246`, the wrapper around the word chip and the card was a grid with one automatic column, which grew to the voice player's smallest width.

Fix (one class): the column may shrink (`grid-cols-[minmax(0,1fr)]`).

Lead's own run on a build of f902506 (`e2e/voice-card-edge.e2e.mts`, 320, 360, 390 and 1440, question page and thread page): PASS, every card ends at the written card's edge, nothing passes it, no sideways scroll. Builder's runs: tsc 0 errors, lint 0 warnings, vitest 156 files and 1591 tests, build ok. Nothing under `src/features/speak/` changed.

After release: measure the live page at 360 again (every card must end at 344).
