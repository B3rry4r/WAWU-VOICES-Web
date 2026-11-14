# V-FIX-D web, round 3

Branch `v/fix-d`. Code head: 6decad9 (the report and the browser script are in the commit after it). Joined `origin/main` (38ec048 at the time) with no conflicts. `origin/main` has since moved to 8fa75a3; I did not join that.

Kept from main: `src/features/dm/live.ts` still says `DMS_LIVE = false`. Nothing I added shows Messages or calls `/dm/` (the browser run counted 0 `/dm` calls and no "Messages" on Home). The record screen files were touched only for M3 (see below) and its tests still pass.

## M1. A changed stance gets a new key
- `src/features/talk/WriteScreen.tsx:42, 93`: the stance is now part of the key's identity (with the words and the name switch).
- `src/features/speak/VoiceBox.tsx` (`keyNow`, new prop `keyPart`) and `src/features/talk/VoiceReply.tsx` (`keyPart={pick}`): the key sent is the take's key, plus `-STANCE`, plus `-anon`. Same take and same stance keeps its key.
- Tests (`tests/fixd-round3.test.tsx`): write screen and voice reply, each a 500, a retry with nothing changed (same key), then another stance (different key).

## M2. Two tabs never both send
- `src/features/speak/outbox.ts` `sendKeptRecording`: after the lock is taken, a new check `stillWaiting` runs before anything is sent. If the kept recording is gone or is another one, it sends nothing and returns "done by another tab".
- `src/features/speak/Outbox.tsx:42-46`: passes that check (reads the kept recording again). When another tab did the post, this tab shows nothing (no second "Your saved voice was posted").
- Tests: two callers racing on one kept recording give one `createVoiceClip` and one answer post; a caller that finds it gone sends nothing; the outbox shows no note for it.

## M3. "Kept" is true for a voice reply
What I built: the voice reply recording goes into the same on-device store as the voice answer (`draft.ts`, one new optional field `reply: { answerId, stance }`). It also carries the name switch (`anonymous`), the question id and the Idempotency-Key it would have been sent with.
- `VoiceBox.tsx`: new props `keep`, `onKept`. Send offline (or a network failure while sending) calls `keep`. A box with no `keep` (explain my vote) no longer says "kept": it says the recording stays on this page.
- `VoiceReply.tsx`: the `keep` for replies; the sheet closes and `ThreadScreen.tsx` shows: "You are offline. Your voice reply is saved on this device. It will be sent when you are back online, or you will be asked to tap Send."
- Sending later: the outbox (`Outbox.tsx`, `outbox.ts`) posts it as the same reply (`createVoiceReply` with the parent, stance, switch and key; clip purpose REPLY). **Free post covers it: sent by itself when the connection is back or the app opens. Otherwise it is offered with its price and one Send tap, never charged unseen.** Same as a voice answer. Success note: "Your saved voice reply was posted." with a link to the thread.
- Owner check unchanged: a recording of another person is never shown or sent (and is removed, as before for answers).
- One slot: a second waiting recording asks first. The reply sheet says "A recording is already waiting to be sent on this device. Saving this one will replace it." with a "Replace it" button. The record screen does the same when a voice reply waits (`SpeakScreen.tsx` `keepForLater`), and its other draft saves (`saveDraftKeepingReply` in `draft.ts`) never overwrite a waiting reply. The record screen ignores a kept reply (`SpeakScreen.tsx:139`), so a reply can never be sent as an answer.
- Text answers and text replies: untouched. No text screen says "kept" or "will be sent" (searched `src` for the wording; the only matches are the voice screens above and a text-paywall line about a held draft).
- Tests: offline Send keeps parent, stance, switch and key and sends nothing; closing the sheet then the outbox posts one reply with those; the `online` event sends it with no reload; signed in as someone else sends nothing and shows nothing; a second recording does not replace the first until "Replace it".

## Totals
- `npx tsc --noEmit`: clean. `npx next lint`: no warnings or errors.
- `npx vitest run`: 115 files, 1247 tests, all pass (base before my change: 114 files, 1237). 10 new tests, no existing test changed.
- `npx next build`: ok.

## Browser run (`e2e/fixd-round3.e2e.mts`, `next start`, 390x844, API stubbed, no live call)
- M1, write screen: AGREE fail, AGREE again (same key), DISAGREE (new key). OK.
- M2, two tabs opened at the same moment on `/` with one kept recording, 3 runs: each run 1 `/voice-clips`, 1 answer post, 1 "posted" note in total, draft cleared. OK.
- M3, voice reply on `/q/q1/a/a2`: I disagree, record, name switch on, offline, Send: draft found in IndexedDB with `reply {a2, DISAGREE}`, `anonymous true`, key `...-DISAGREE-anon`, no request sent. Sheet closed and the page replaced by a new one, back online: one `POST /answers/a2/replies` `{stance DISAGREE, kind VOICE, anonymous true}`, draft cleared, no answer post. OK.
- Home record flow (mood question): "Pick one word", "Say it in N seconds", "Type it instead" shown; record, Send: one voice answer post with the mood word. No Messages on Home, 0 `/dm` calls. OK.

## Not proved
- The "reload" in the M3 browser run: my read of the store from the offline new page returned null because the page could not load offline (that read was on a blank page). What proves it is that the next page, opened after, found and sent the recording. Not run: a real reload of the same tab while offline.
- Not run on a real phone, nor against the real API (what it does with a reused key). The reply sheet at 1440 was not looked at in a browser.
- A free-post check happens when the outbox runs, not when Send was tapped: if the free post is used up meanwhile, the person is offered the price instead of an automatic send.
