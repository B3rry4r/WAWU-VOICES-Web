# V-VOICE-CARD-360: voice cards ran to the right edge on a 360 phone

## Cause (confirmed)
`src/features/talk/TalkCard.tsx` wraps a card that has a mood word in `<div className="grid gap-[6px]">` (word chip above the card). That grid had one automatic column. An automatic column will not shrink below the card's smallest width, so on a 328 px column the voice card (smallest width 344 px) pushed the column to 344 px. A card with no word is not wrapped, so it fitted. The same happened to a written card whose text was wide (the admin card was 374.5 at 390).

## What changed
- `src/features/talk/TalkCard.tsx:246`: the wrapper is now `grid grid-cols-[minmax(0,1fr)] gap-[6px]`. The word chip keeps `justify-self-start`. Nothing else changed. Nothing under `src/features/speak/` was touched.
- `e2e/voice-card-edge.e2e.mts`: the proof script (stub API in the browser, no live service).
- Screenshots: `docs/lead/reports/voice-card-360/before-360.png` (origin/main) and `after-360.png` (this branch), question page at 360 wide, full page.

## Edges (card right edge, x), question page, six cards in the order: written, voice+word, voice+word+Most Relatable, voice 1:00 (no word), anonymous voice+word, admin written+word
| Width | origin/main | this branch | page scrolls sideways (main / branch) |
|---|---|---|---|
| 320 | 304, 360, 360, 304, 360, 374.5 | 304 on all six | 55 px / 0 |
| 360 | 344, 360, 360, 344, 360, 374.5 | 344 on all six | 15 px / 0 |
| 390 | 374, 374, 374, 374, 374, 374.5 | 374 on all six | 0 / 0 |
| 1440 | 994 on all six | 994 on all six | 0 / 0 |

Left edge is 16 (354 at 1440) everywhere. The farthest edge of anything inside a card equals the card's right edge on the branch at every width.

Thread page (voice answer with a word, then a voice reply and a written reply): main at 320 had the answer card at 328 (column is 304) and the page scrolled 16 px sideways; branch 304, 304, 304 and no scroll. At 360, 390 and 1440 the three cards match on main and branch (344, 374, 994; replies are indented 30 px at 1440 on both).

## Changed at 390 and wider?
Layout is the same as main at 390 and 1440 for every card except one: the admin written card with a word was 374.5 on main at 390 (same bug, a long line widening the column) and is now 374, like the others. No other number moved. I compared edges by measurement, not by an image diff, so "pixel for pixel" is shown for edges only.

## Places checked
- Question page and thread page: measured above (stub with all six card types plus replies).
- Home, category, search: they draw `Answers` in `src/components/feed/parts.tsx:65`, which already uses `grid-cols-[minmax(0,1fr)]`, and each card goes through the same `TalkCard`, so the fixed wrapper is the only one. Not measured in a browser.
- Question page list wrapper (`QuestionScreen.tsx:205`, `:207`) already `minmax(0,1fr)`.
- Posted screen, Profile, Saved, share page, survey voice question: not measured (they need many more stub routes); the profile and posted screen draw their cards with `TalkCard`/`ClipPlayer` and I found no card inside an automatic grid column by reading. Treat as not proven.
- Voice player at 320: it fits. In a 288 px column the card is 288 wide and nothing inside passes its edge, so the player's smallest width is not a problem once the column can shrink.

## Left alone, on purpose
On the thread page the answer card's Share/More button box (`vx-act--end`) ends 8 px past the card edge at 320, 360 and 390 on main and on this branch. It is a transparent button box (its icon is inside); it is not part of this fault and changing it would change 390. The script prints it as a NOTE, not a miss.

## Runs
- `npx tsc --noEmit`: 0 errors.
- `npx next lint`: no warnings or errors.
- `npx next build`: ok.
- `npx vitest run`: exit 0, 156 files passed, 1591 tests passed.
- Proof script on main build: 13 misses (exit 1). On branch build: exit 0, no misses.

## Could not prove
Home, Profile, Saved, share page, survey voice question in a browser; a pixel diff at 390 and 1440 (edges only); real clips (the stub never plays audio).
