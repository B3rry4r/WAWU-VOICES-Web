VERDICT: FIX
INTERIM

# Verify V-SURVEYS round 8 (website), interim

Code under test: `origin/v/surveys` 0320dad, `next build` + `next start`, Chromium (Playwright, fake microphone), 390x844. API and sign-in are a stub inside the browser (the builder's `e2e/round7-stub.mts`; the probe scripts are mine and are not committed). No live service, no `.env`. No product code or existing test changed. This is the verdict so far; the full report replaces it.

## Round 7 findings, from my own runs so far

| Round 7 | Now | Basis |
|---|---|---|
| HIGH 1 A's recording kept under B and sent as B | **CLOSED** | Builder's `e2e/round8.e2e.mts` run by me: A records, B signs in in tab 2, A offline taps Send, network back: clips 0, posts 0, slots none, stale line shown on A's tab, recording still on A's screen. |
| HIGH 2 stale tab writes into B's slot, and the mirror | **OPEN** (both halves) | Below. |
| MEDIUM 1 X and a finished send clear the wrong slot | **CLOSED** | Same script: B signs in at the post: 1 post as A, A's slot kept while B is in; A signs in later: nothing sent again (posts 1, clips 1), slot cleared. Builder's vitest also covers the X. |
| MEDIUM 2 sign-out removes the kept recording | Left as built (`auth.ts:125` unchanged). Not a fault. | |
| LOW 1 old slots never removed | **CLOSED** | Same script: 20 slots 30 days old removed at start, 6 days old stays. Not yet run: exactly 7 days vs 7 days + 1 ms in the browser. |
| LOW 2 reload mid-send makes a second clip | Left. Not re-run. | |

## Findings, most severe first

### HIGH 1. A's open tab saves A's recording under B, and shows B's recording to A (round 7 HIGH 2, still open)
Steps (390x844, one browser, two tabs, my probe `probe2`):
1. Tab 1 signed in as A, `/q/q1/speak`, pick PROUD, wait 2.5 s.
2. Tab 2: B signs in (writes the shared session in storage).
3. Tab 1: tap "Say it in 60 seconds". The screen quietly remounts: tab 1 asks again for `/me`, `/questions/q1`, `/config/public`, `/me/allowance` (a button I marked in the page before is gone). The new screen is opened for B.
4. Tab 1: Start, Stop recording.
Result: slots `[u:B]`, no "signed in as someone else" line (count 0), Send is offered. **A's voice is stored in B's slot.** B opens the record screen in tab 2 and is offered it (the builder's own script shows the same: `HIGH 2 FAIL ... slots [u:B]`). The outbox would send it as B.
Mirror: B has a kept recording (hash/key `kept-B`), A's open tab taps "Say it in 60 seconds": A's tab shows **B's recording** (Send 1, Play 2). The builder's script fails on this too.
Cause: `openedFor()` (`src/features/speak/opened-for.ts:5-23`) holds the first person only for 20 ms. The remount in the browser is slower, so `owner.current` becomes B (`SpeakScreen.tsx:83`), and every guard (`ownerOk`, `sameOwner`) then passes. The builder's report says the same ("Open"). I did not find what remounts it; the page is `OpenGate` (`src/features/talk/OpenGate.tsx`) around `SpeakScreen`. The mark survives the sign-in event itself and is lost at the first tap after it, so the remount is triggered by the tap/focus, not by the storage event.
Should: the person a screen was opened for must survive the remount (hold it for the life of the tab or page, not for 20 ms), or the screen must refuse and show the line when the signed-in person differs from the one the tab first showed.

### LOW 1. New lint warning
`npx next lint`: `SpeakScreen.tsx:174` useEffect missing dependency `ownerOk` (exit 0, 1 warning).

## What held so far
- Builder's script, 9 of 11 pass: HIGH 1, MEDIUM 1, LOW 1 above; network drops once at each of create, complete, ready, post: ends posted after one more tap, 1 post, 1 clip each; reload with an offline-kept recording: sent once (1 clip, 1 post, slot cleared); 30 reloads and a clock change forward 3 days for one person: stale line never shown (0), 1 clip, 1 post.
- `npx tsc --noEmit` 0 errors. `npx next build` ok.

## Not yet run (full report follows)
Voice and typed 10 runs at 390 and 1440; token running out at each step; browser restart; three tabs; guest to sign-in and back; sign-out while recording and the guest claim; old-data slots from main, round 6 and round 7; IndexedDB unavailable, quota, corrupted slot; outbox subject on reply; vitest totals; test diff; join check.
