# V-SURVEYS round 8 (website): kept recordings belong to the person the screen was opened for

Branch `v/surveys`, from 7540b72. No pull request. Not touched: `src/lib/api/client.ts`, `DMS_LIVE` (false), `contract/openapi.yaml`, sign-out (`src/lib/api/auth.ts:125`), round 6 H1 and M1.

## Status in one line
Unit side is done and proven. In the browser, HIGH 1, MEDIUM 1, LOW 1 and the one-person runs pass. **HIGH 2 does NOT pass in my browser run** (see "Open" below). Say so before you rely on it.

## The rule as built
- `draft.ts`: `saveDraft(owner, d)`, `loadDraft(owner)`, `clearDraft(owner)`, `saveDraftKeepingReply(owner, d)` take the person as a required argument. No function in `draft.ts` looks up who is signed in to pick a slot any more (`currentOwner()` is still exported as a plain helper for other code and tests).
- Before any write, read or clear, the caller checks the signed-in person is still the person the screen or banner was opened for. If not: nothing is written, read or cleared in any slot, the recording stays in memory on the screen, and the existing line is shown ("You are signed in as someone else in another tab. Nothing was sent. Reload to carry on."). Send, the keep-offline path and the restore stop there.
- `Outbox.tsx`: the banner remembers the person it was opened for (`forWho`). X (`remove`) and `onPosted` clear that person's slot only while they are still signed in. When a post goes out as A while B is signed in, A's key is noted as posted (`notePostedKey`, only the random key, in local storage). The next time A is signed in the outbox sees the key, clears the slot, and sends nothing. If the server answers a repeated key with the first post, that is treated as sent and cleared.
- `outbox.ts`: `sendKeptRecording(..., forOwner)` and `sendHere`: nothing is created if the signed-in person differs; the new-key re-save only runs for the same person.
- LOW 1: `sweepStaleDrafts()` removes every slot older than 7 days, any person, reading only the saved date (never the audio bytes). It runs at app start and each time the outbox looks. The signed-in person's own old slot is left to the banner or screen, which still say the plain "removed" note (existing test).
- `opened-for.ts` (new): a screen that is mounted again straight away keeps the person the first copy was opened for.

## Every call site (file:line)
- `SpeakScreen.tsx:95` `keepDraft` (guarded save, used by the lines below); `:159` `loadDraft(owner.current)` after `ownerOk()`; `:163` `clearDraft` (old note); `:187` tag autosave; `:226` after recording; `:348` `dropTake` clear; `:359` `close` clear; `:401` `loadDraft` in keepForLater (after `ownerOk()` at `:398`); `:406` `saveDraft` keep-offline; `:427` `saveDraft` guest to sign-in (after `ownerOk()`); `:477` clear after post, or `notePostedKey` at `:478` if another person is signed in; `:508` new key; `:519` 402 save; `:525` token expired save.
- `Outbox.tsx:49` `sessionSubject()` check before send; `:53` `loadDraft(me)`; `:54` onPosted clear or `notePostedKey`; `:72` sweep; `:78` `loadDraft(me)`; `:80-81` posted-key clear; `:85` stale-note clear; `:93` closed-question clear; `:121` X.
- `outbox.ts:103` re-save with a new key (same person only).
- `VoiceBox.tsx` `tryKeep`: checks `mayWrite()` first, passes its owner to `keep`. `talk/VoiceReply.tsx:68,70`: `loadDraft(forWho)` and `saveDraft(forWho, ...)`, refuses if the signed-in person differs.
- Typed draft (`features/units/draft.ts`, used by `WriteScreen`): a separate store of text, keyed by question, not by the record screen's slots. I did not change it. Survey drafts (`surveys/logic.ts`) already take the person.
- `auth.ts:125`: unchanged (`clearDraft(ownerOfToken(accessToken))`).

## Existing tests changed (person argument only, no assertion edited)
`fixd-outbox`, `fixd-outbox-r2`, `fixd-round3`, `share-card-guest-return`, `voice-clip-subject`, `w4-recorder`, `w4-speak`, `wf6b-people`, `round7-draft-slots`: each draft call gained `currentOwner()` as the first or only argument (what the old code used). Nothing else.

## Tests and logs
Unit (new `tests/round8-draft-owner.test.tsx`, 6 tests, pass): 20 people's 30 day slots removed and a 6 day one stays; exactly 7 days stays, 7 days + 1 ms goes; own old slot left for the banner; A's banner open, B keeps a recording, A taps X: B's is still there; A taps Send while B is signed in: no clip, no post; B signs in at the post: one post, key `ka`, A's slot kept while B is in, then A signs in: nothing sent again, slot cleared.

Browser (`e2e/round8.e2e.mts`, built app, 390x844, two tabs, fake microphone, stub API), last run:
```
ok   HIGH 1: clips 0, posts 0, slots [], stale line 1, Send still on A's tab; after A signs in again and reloads: clips 0, posts 0, no slots (the in-memory recording is gone after a reload, accepted; nothing was sent twice)
FAIL HIGH 2: after A records in tab 1, slots [u:B]  (see Open)
FAIL HIGH 2 mirror: A's tab shows Send and B's kept recording (see Open)
ok   MEDIUM 1: after post: clips 1, posts 1 (as A, key kept-A), slot u:A still kept; A signs in later: posts 1, clips 1, slots []
ok   LOW 1: left ["u:Q"] (the 6 day one)
ok   network drops once at /voice-clips, /complete, /voice-clips/c1, /questions/q1/answers: ends posted after one more tap, 1 post each (1 clip each)
ok   kept recording survives a reload and sends once: clips 1, posts 1, slots []
ok   one person alone, 30 refreshes and a clock change forward 3 days: stale lines seen 0, 1 clip, 1 post
```
I also kept `e2e/round7.e2e.mts` (the 10 plain voice and typed runs at both widths, token out at each step, two tabs of one person) as the one-person proof; I did not re-run it after the last change, only the shorter checks above. Not done: 10 + 10 runs at 1440x900 for this round, and a token-out run at each step on this build.

## Open (HIGH 2 in the browser)
In my run, when tab 1 (A, record screen, idle) is touched after B signs in in tab 2, the record screen in tab 1 is mounted again and is then opened for B (log line: a new mount that reads B). It then saves as B and shows B's kept recording. I did not find what remounts it. `opened-for.ts` does not help because the remount is slower than its short window. In the case where the screen is not remounted (HIGH 1, recording already on the screen) the rule holds. So HIGH 2 is closed in code and unit tests, but not proven closed in the browser. Next step: find what unmounts `SpeakScreen` (likely the question loader above it) when the sign-in changes in another tab.

## Could not prove
- HIGH 2 in the browser (above). A voice reply from the browser and the 1440 wide runs of this round. `VoiceBox` still reads its person once when it is created (a remount there would behave like the screen above).

## Totals (before the last push)
`npx tsc --noEmit` 0 errors. `npx next lint` clean. `npx vitest run` 150 files, 1536 of 1536 passed. `npx next build` ok.
