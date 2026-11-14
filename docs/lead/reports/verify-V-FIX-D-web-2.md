VERDICT: FIX

# V-FIX-D web, second check

Head checked: `origin/v/fix-d` = efb32fe, as stated. My branch: `verify/fix-d-2`. origin/main is 38ec048, a squash of fde1253; `git diff fde1253 origin/main` is empty, so the join equals tonight's release plus the V-FIX-D work (the three-dot diff against main shows only V-FIX-D files).

No HIGH found. Three MEDIUM findings, so the verdict is FIX. Method as the earlier check: `next build` of this head (port 3991) and of origin/main in a worktree (port 3992), `next start`, Chromium through Playwright, every API call stubbed with `page.route`, offline by `context.setOffline` plus the stub refusing the network (needed: a stubbed call is answered even when the context is offline, so I made the stub abort calls too). Nothing live was called. Scripts are not committed. Pictures are in my scratchpad, not in the repo.

## Findings (most severe first)

### MEDIUM

**M1. Changing the stance after a failed reply keeps the Idempotency-Key (W4), in two places.**
- Reply write screen, 390, signed in. `src/features/talk/WriteScreen.tsx:93`: the key is renewed when the words or the name switch change, not when the stance changes (`key.current.text !== body || key.current.anon !== anonNow`).
- Voice reply sheet, 390 and 1440. `src/features/speak/VoiceBox.tsx:186` sends `take.key` (or `take.key-anon`); the stance chosen in `VoiceReply.tsx` is not part of the key.
- Steps: open a reply, pick I agree, type or record, Post/Send, make the stub answer 500, pick I disagree, Post/Send again. Run: write screen, calls `AGREE` then `DISAGREE`, keys `13e3…` and `13e3…` (same); voice reply, `AGREE` then `DISAGREE`, same key `d613b05e-6…`. The text composer at 1440 does this right (new key on stance, switch and words) and so does the switch on the write screen and the voice sheet.
- Why it matters: if the first call reached the server and only the answer was lost, the retry with another stance and the same key either gets the stored AGREE reply back (the person posted a stance they just changed) or an error. The rule says a changed body gets a new key.
- Should: add the stance to the key's identity, as the composer does.

**M2. Two tabs can still both send a waiting recording (W5).** `src/features/speak/Outbox.tsx` `look()` and `src/features/speak/outbox.ts` `sendKeptRecording`.
- Steps: queue a free recording offline, come back online, open `/` in two tabs at the same moment. Run three times: 1 answer, then 2 answers, then 1 answer. In the bad run: 2 `POST /voice-clips` (c1, c2), 2 `POST /questions/q1/answers`, same Idempotency-Key, different `clipId`, and both tabs said "Your saved voice was posted".
- Cause: each tab reads the kept recording first, the slower one then gets the Web Lock after the first tab has finished and cleared it, and sends without looking again.
- Not proved: what the real API does with the second request (same key, other clip). If it replays the first answer, nothing double posts but a clip is orphaned; if it answers IDEMPOTENCY_KEY_REUSED, the second tab shows a wrong message. I did not run the API.
- The priced case (both tabs tap Send at once) was clean: 1 clip, 1 answer. So the earlier M5 is closed for the priced case and still OPEN for the free auto-send.
- Should: after taking the lock, look at the kept recording again and stop if it is gone.

**M3. Offline sending only covers a recorded voice answer; text answers, text replies and voice replies are not kept for later (W5).**
- Text answer (write screen 390), text reply (composer 1440): with the network down, Post shows "This did not post. You are offline. Check your connection and try again." The words stay in the box and survive a reload (kept in the browser), but nothing is sent when the connection comes back; the person must tap Post again. Nothing is in the outbox.
- Voice reply (sheet 390): Send offline says "You are offline. Your recording is kept. Check your connection and try again." The recording is held only in the open sheet. Nothing is in the on-device store (`IDB draft: null` in my run), nothing is sent on reconnect, and closing the sheet or reloading loses it, so "kept" is true only while the sheet stays open.
- The person is told plainly and has a way round (tap again) for text; for the voice reply the recording is lost if they leave. The brief and W5 say a post (answer and reply, text and voice) waits and is sent later. If the builder meant voice answers only, the brief and the builder's own words should say so.
- Files: `WriteScreen.tsx`, `ReplyComposer.tsx`, `VoiceReply.tsx`/`VoiceBox.tsx` (no use of `outbox.ts`).

### LOW

**L1. Another person signing in on the same device deletes the first person's waiting recording without a word.** `src/features/speak/draft.ts` (`owner` mismatch). Run: u1 queued a recording; u2 signed in and opened `/`: nothing was sent as u2 (good, this is the important part), the draft was removed; u1 signing back in found nothing. The earlier check accepted this. It is by design for privacy; it is still a lost post. Single slot, no note.

**L2. No "More" on a desktop browser with no `navigator.share`** (headless Chromium, 390 and 1440 show nine targets). Unchanged from the earlier L1; right for the browser, differs from the board.

### Not found

Nothing HIGH: no nameless reply shows its writer; no wrong-person send; no waiting post lost to a refusal; no control on the launch path that does nothing; no error page.

## W1. Each earlier finding

| Earlier | Result | How |
|---|---|---|
| H1 Outbox banner squeezed at 390 | CLOSED | RAN: failed-send banner at 390 on the build reads title, one line, Try again under it (picture outbox-fail-500) |
| H2 how-to words false on a computer / phone | CLOSED | RAN: after Stories the panel reads "Saved to your downloads. Open the app and add it from there." at 390 and 1440. READ: `ShareSheet.tsx` hands the file to the phone's share sheet where `canShare` files works. The phone path was not run (no phone) |
| M1 how-to panel below the fold at 390 | CLOSED | RAN: panel box y 723 to 843 in an 844 high viewport, visible |
| M2 failed saved recording had no retry | CLOSED | RAN: 500, 504, 429, dropped, 409 new key, 402, 409 closed, 422: banner keeps its button (Try again or the price) and the draft stays; one more tap posted once in every retry case |
| M3 free send showed nothing while sending | CLOSED | READ: `Outbox.tsx` "Sending your saved voice". Not timed in a browser |
| M4 storage full said saved | CLOSED | READ: `saveDraft` returns false, `SpeakScreen.tsx:359` says it could not be kept. Not run |
| M5 two tabs | PARTLY: priced case closed, free case OPEN | RAN, see M2 above |
| M6 key kept when the switch flips | CLOSED | RAN: composer, write screen and voice sheet all get a new key when the switch flips (voice: `key-anon`) |
| L1 More missing | OPEN, same | RAN |
| L2 thread overflow at 390 | CLOSED for the unnamed reply | RAN: `scrollWidth` 390 with an own unnamed reply. The own named reply was not re-run |
| L3 `published_from_link` for an outbox post | CLOSED | READ: `Outbox.tsx` calls `publishedFromLink(d.shareCode)` |
| L4 switch below Post at 1440 | CLOSED | RAN: switch at y 515, Post at y 852 |
| L5 no card previews | CLOSED | READ only (`ShareSheet.tsx` fetches story and square pictures to show small); not looked at in a picture |

## W2 to W8 in short

- **W2 CLOSED.** RAN: text composer 1440, write screen 390, voice reply sheet 390 and 1440. Switch off by default, text "Post without my name / Your name and photo stay hidden. Admins can still see who posted, to keep Voices safe.", `anonymous:true` in the request when on and no field when off (voice: `kind VOICE`). After posting: guest and another member see "Anonymous" and no `me.handle` or "Me Person"; the writer sees "Anonymous" plus "Posted without your name". Profile list: READ only (`PostRow.tsx` ReplyRow handles a null author and shows the tag to the writer); not run in the browser.
- **W3 CLOSED.** RAN: own nameless answer, composer 1440, write screen 390, voice sheet 390 and 1440: no switch, the line "Your reply stays without your name, because your answer is without your name.", request carries `anonymous:true`. The switch did not appear before the parent loaded (sampled 2 seconds). The voice sheet (no unit test) was tested in the browser as asked. Own named answer still has the switch.
- **W4: M1 above, rest passes.** RAN for the text composer 1440, write screen 390, voice sheet 390, outbox: 500, 502 (composer, voice), 504, 429, dropped connection: the retry carries the same key and one more tap posts exactly one reply; 409 "start again with a new key" and IDEMPOTENCY_KEY_REUSED: new key; plain 409 CONFLICT: same key. A timeout with no answer (client timeout) was not run.
- **W5: M2 and M3 above.** RAN and OK: voice answer offline is kept, told plainly ("You are offline. Your recording is saved on this device. It will be offered for sending when you are back online, or tap Send again then."), sent once when back, nothing more after a reload, once after closing and reopening the tab, key equals the kept recording's key; refusals 402 ("You are out of posts" with Get tokens), 409 closed, 422 each shown with a button or link and the draft kept; signed-out guest sends nothing; another person signing in sends nothing (L1). Not run: the "online" event with the tab open and no reload (my script's navigation failed; the reload and reopen paths pass).
- **W6 mostly CLOSED.** RAN at 390 and 1440 from Home and Search (list cards) and the answer page: 5 columns, `scrollWidth` equals the viewport, no clipped label, 9 targets in order WhatsApp, Status, Stories, Facebook, X, TikTok, Telegram, SMS, Copy link; Copy link put the link on the clipboard; Stories saves the card file. The Category list card had no Share control in my stub (its card did not render with my stubbed shape): NOT PROVED for Category. Sharing a file through the phone's own sheet was not run (no `navigator.canShare` files in headless).
- **W7 partly proved.** RAN: Home, Category, Search at 390 and 1440 with list cards: `document.querySelectorAll('a button, button a, a a, button button').length` is 0 on all six. Verified tick showed beside the verified person and not beside a nameless post (Home, one tick). NOT PROVED in a browser: "coming up" and the clock runs (my stubbed question did not show "coming up", so I have no result; the unit tests for it passed in vitest), the mood chip as a pill, the three dots / Like / React / Play on Category.
- **W8 CLOSED for what was run.** RAN: origin/main build against this build at 390 and 1440, light, same stub, animations off. Home 390, question 390 and 1440, profile 390 and 1440 (`/profile`), settings 390 and 1440, thread 390 and Home 1440 are pixel and text identical, except 3 pixels at one point on Home 1440 (an animated dot). Thread 1440 differs (page 1301 against 1377 high) by the reply box's new "Post without my name" row, which is the expected change. Settings 1440 and Home 1440 text identical. The first profile compare used a wrong address (`/me`, not found on both) and was redone at `/profile`.

## What I ran

| Line | RAN or READ | Number |
|---|---|---|
| `npx tsc --noEmit` | RAN | exit 0 |
| `npx next lint` | RAN | no warnings or errors |
| `npx vitest run` | RAN | 106 files, 1169 tests, all passed |
| `next build`, this head | RAN | exit 0 |
| `next build`, origin/main (worktree `../main-wt`) | RAN | exit 0 |
| `next start`, ports 3991 (head) and 3992 (main) | RAN | both 200 |
| Earlier report | READ | via `git show origin/verify/v-fix-d:docs/lead/reports/verify-V-FIX-D-web.md` |
| Browser runs, stubbed API | RAN | about 70 scenarios in 9 scripts; failures I saw were my own script's mistakes and are not listed (a wrong stub for another person's own-flag, voice sheet selector, offline that the stub did not honour) |
| Diff of `src` against main | READ | 20 files, 700 added, 53 removed |

Not proved: anything on a real phone; the real API's answer to a reused key; the real cards; Category's share control; "coming up" and the clock-slow run; the mood pill; real access tokens (I used unsigned tokens carrying a `sub`).
