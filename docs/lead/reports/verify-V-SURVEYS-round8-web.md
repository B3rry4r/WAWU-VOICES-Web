VERDICT: FIX

# Verify V-SURVEYS round 8 (website)

Code under test: `origin/v/surveys` 0320dad, `next build` + `next start`, Chromium (Playwright, fake microphone), 390x844 (1440x900 for the one-person runs). API and sign-in are a stub inside the browser (the builder's `e2e/round7-stub.mts`; my probe scripts are not committed). No live service, no `.env`. I changed no product code and no existing test.

## Round 7 findings, from my own runs

| Round 7 | Now | Basis |
|---|---|---|
| HIGH 1 A's recording kept under B and sent as B | **CLOSED** | A records, B signs in in tab 2, A offline taps Send, network back: clips 0, posts 0, slots none, stale line on A's tab, recording still on A's screen. |
| HIGH 2 stale tab writes into B's slot; mirror | **OPEN**, both halves | HIGH 1 below. |
| MEDIUM 1 X and a finished send clear the wrong slot | **CLOSED** for the send; **OPEN** for a remounted screen | Send: B signs in at the post: 1 post as A, A's slot kept while B is in, A signs in later: posts 1, clips 1, slot cleared. But a stale record screen can still clear B's slot (HIGH 1). |
| MEDIUM 2 sign-out removes the kept recording | Left as built (`auth.ts:125`). Not a fault. | |
| LOW 1 old slots never removed | **CLOSED** | 20 slots 30 days old removed at start; the 6 day one stays. (7 days vs 7 days + 1 ms: only the builder's vitest.) |
| LOW 2 reload mid-send makes a second clip | Left. Not re-run. | |

## Findings, most severe first

### HIGH 1. A's open tab writes, shows, plays, sends and deletes B's recording (round 7 HIGH 2, not fixed)
`src/features/speak/opened-for.ts:5-23` keeps the person a screen was opened for only for 20 ms across a remount. In the browser the screen is mounted again later than that, so `owner.current` (`SpeakScreen.tsx:83`) becomes B, and every guard (`ownerOk`, `sameOwner`, `keepDraft`) then passes for B. Steps (390x844, one browser context, tab 1 and tab 2):
1. Tab 1: A, `/q/q1/speak`, pick PROUD, wait 2.5 s.
2. Tab 2: B signs in. Tab 1 still looks the same (a marked button is still the same node).
3. Tab 1: tap "Say it in 60 seconds". Tab 1 asks again for `/me`, `/questions/q1`, `/config/public`, `/me/allowance`; the marked button is gone: the screen was mounted again and is now B's.
Then, each run by me:
- **Write**: tab 1 records 1 second, stops: slots `[u:B]` holding A's recording, no stale line (count 0), Send shown. B opens the record screen and is offered A's voice. Same result in the builder's `HIGH 2` test (fails in the builder's own script).
- **Show, play, send**: B has a kept recording (`kept-B`). Tab 1 taps "Say it in 60 seconds": tab 1 shows B's recording with Send 1, Play 2. Tapping Send there sends B's recording.
- **Delete**: same, tab 1 taps Delete: slots `[]`. **B's kept recording is gone**; B's tab (reload) shows no recording.
The stale line is not shown on any of these paths. The builder's report says HIGH 2 is open in the browser; this confirms it and adds the delete.
Should: hold the person for the life of the page (not 20 ms), or refuse and show the line whenever the signed-in person differs from the one the tab first showed, including after a remount.

### MEDIUM 1. A signed out in another tab: the tab records as a guest and the next person to sign in takes the recording
1. Tab 1: A on the record screen. Tab 2: remove the session (A signs out). 
2. Tab 1: record. Slots: `[current]` (guest slot), no stale line, Send shown.
3. Tab 2: B signs in, opens Home: slot becomes `u:B`; B's record screen shows the take (Send 1, Play 2). Nothing was sent (clips 0, posts 0).
So A's voice, recorded in a tab that was opened for A, goes to B through the guest claim. It is a plain guest recording by the rule as written, but it comes from the same remount defect and no line warned A. If A signs out *while* tab 1 is recording: nothing is written, line shown, B gets nothing (good).

### MEDIUM 2. `npx vitest run` exits 1
1536 of 1536 tests pass, but 8 unhandled rejections: `No "sessionSubject" export is defined on the "@/lib/api/client" mock`, from `tests/shell-bar`, `dm-off`, `dm-on`, `hydration`, `shell-guest` (the app's Outbox now calls `sessionSubject`). Same 5 files on 7540b72: 0 errors. A CI run on this tree fails. No test was edited by the builder for these.

### LOW 1. New lint warning
`npx next lint` exit 0, 1 warning: `SpeakScreen.tsx:174` `useEffect` missing dependency `ownerOk`.

## What held
- **One person, one tab** (builder's `e2e/round7.e2e.mts`, run by me, 15 of 15): voice 10 and typed 10 at 390 and at 1440 (1 clip and 1 post per Send, no refresh, no stale line); token runs out at create, complete, ready, post and the typed post (1 refresh, 1 clip, 1 post); two tabs of A; outbox as another person, answer and reply: no post as B, B's tokens untouched, A alone sends once; B's own recording and A's again.
- **Round 8 script** (builder's, run by me, 9 of 11, the two failures are HIGH 1): network dropped once at create, complete, ready, post: 1 post each; reload keeps an offline recording and sends it once; 30 reloads and a clock change of 3 days for one person: stale line seen 0.
- Three tabs of A, offline recording, back online: 1 clip, 1 post, slots empty, stale lines 0, 0, 0. Token expired at create with the refresh held 2.5 s: posted, 1 clip, 1 post, 1 refresh, no stale line.
- Real guest: records (slot `current`), signs in as A, record screen shows Send, slot moves to `u:A`, still there after reload.
- **Old data** (slots written by hand in the stored shape; I did not build the old commits): main and round 6 shared slot `current` with owner A, round 7 `u:A`: B sees nothing (Send 0, Play 0) and the slot is left in place; A signs in and gets it (Send 1, Play 2).
- **Storage errors**: IndexedDB undefined, `put` throws quota, `open` throws, and corrupted slots (a string instead of a Blob, a number): record and Send online posted in all 4 (1 clip, 1 post, 0 page errors). With IndexedDB gone and the network off, the screen says "We could not keep your recording on this device. Stay on this page until you are back online, then tap Send."
- **Gates**: `npm ci` ok; `npx tsc --noEmit` 0 errors; `npx next build` ok; vitest 150 files, 1536 of 1536, exit 1 (MEDIUM 2).
- **Test diff** `git diff 7540b72..HEAD -- tests` with the person argument stripped: only the added `currentOwner` import in 8 files; nothing else changed in them, no assertion weakened. New file `tests/round8-draft-owner.test.tsx` (6 tests). Note: the old tests now call with `currentOwner()`, so they do not pin the new rule.
- **Join**: main c934e9b is inside the branch. `contract/openapi.yaml` unchanged from 7540b72 (the branch's).
- DMs off.

## Could not prove
- A browser restart (new context, same storage); I only proved reload. The survey voice question, a thread reply box and "explain my vote by voice" in a browser with two people; the typed draft and reply draft in two-person runs; "A's stale tab" for the outbox X in a browser (only the builder's vitest).
- A guest who goes through real sign-in and sign-up pages (the stub signs in by writing storage, so the sign-in pages were not driven); the person's id arriving late or changing shape; three people in a browser.
- Section 6 in a browser: sign-in, sign-up, Home with 5 trending cards, vote, like, text reply, Profile edit and delete, share buttons, admin on a phone, small survey rows (they pass in the repo's vitest only).
- Byte-for-byte hash of B's blob before and after was not taken; I compared slot keys, and the Delete run removed the slot.
- Sweep of exactly 7 days in a browser; the old commits built from source.
