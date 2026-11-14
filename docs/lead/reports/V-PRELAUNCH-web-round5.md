# V-PRELAUNCH web, round 5 (branch v/batch-1114c2, from ca00c8f)

Proof: one `next build` (57 pages, exit 0) served with `next start`; Chromium through Playwright at 390x844 and 1440x900; API stubbed from the contract's shapes (`e2e/round5.e2e.mts`, and round 4's `e2e/round4.e2e.mts` for the share runs). Nothing live was called. Servers stopped. Pictures: `docs/lead/prelaunch/shots-r6/`.
Gates: `npm run lint` no warnings or errors; `npm run typecheck` exit 0; vitest 96 files, 966 tests, all passed; `npm run build` exit 0, 57 pages.

## Findings and what closed them
| Finding | Closed by |
|---|---|
| MEDIUM-1 (the rest of it) | One helper, `needsNewKey` (and `newKeyLine`, `freshKey`) in `src/lib/api/keys.ts:9`; `src/features/talk/lib.tsx` re-exports it. Every writer below drops its key on that answer, keeps the words or the recording, and shows "That did not post. Tap <the button's word> to try again." in view (`src/components/InView.tsx` scrolls the line into view). Never "Something went wrong on our side" for this case. |
| MEDIUM-2 (device clock steps) | `src/lib/api/server-clock.ts` carries the server's time with `performance.now()` (never steps), so a step of `Date.now()` does not move it (`serverNow`, line 45). `useStartWatch` (`src/components/feed/useLoad.ts`, from the `AGREE_MS` block down) measures every wait on the monotonic clock (`lastAsk`, `next`), notices a step (device clock and monotonic clock disagreeing by more than 30 s between two looks, `stepped`) and plans again; on return to the tab it also asks when `Date.now()` is earlier than the last fetch (`wall < fetchedAt.current`). |
| MEDIUM-3 (never one clock) | `useStartWatch`: two guesses of the opening instant, by the device clock and by the server-corrected clock (`lead()`). It starts at the earlier (plus the 0 to 5 s spread). While the guesses differ by more than 10 s and the later has not come it asks at most once a minute (`LIGHT_MS`, the load's own fetch counts as the first ask); at the later guess it asks again (`lateAsked`) and then keeps to the 5, 15, 30, 60 s steps. |
| LOW-2 (offset by when measured) | `server-clock.ts` `take()`: a reading is kept only if the instant it stands for (`Date` plus `Age`, or the page's own server time) is later than the one held. An old answer from a cache that arrives last no longer moves the clock back. |
| LOW-1, LOW-3 | Left as they are. |

## The writers (every `idempotencyKey` found by `grep -rn "Idempotency-Key\|idempotencyKey" src`) and what each does now on 409 "new key" or IDEMPOTENCY_KEY_REUSED
| Writer | Key | After the refusal |
|---|---|---|
| Text answer, `WriteScreen.tsx` | the held draft's key (same text, same key) | key dropped; the held draft keeps its words and waiting state and gets a new key (`renewDraftKey`, `units/draft.ts`; it used `clearDraft` in round 4); line "Tap Post" |
| Text reply, `WriteScreen.tsx` (`?reply=`) | per text | key dropped (round 4); line "Tap Post" |
| Text reply box on the thread, `ReplyComposer.tsx` | per text | key dropped (new); line "Tap Post" |
| Voice answer, `SpeakScreen.tsx` | `take.key`, also in the kept recording (IndexedDB) | `take` gets a new key and the kept recording is saved under it; the next send makes a new clip; recording kept; line "Tap Send ... Your recording is kept." (`speak/logic.ts` `refusalText`) |
| Voice reply and vote explanation by voice, `VoiceBox.tsx` (`VoiceReply.tsx`, `ResultsPage.tsx`) | `take.key` | new key on the take, new clip, recording kept; same line, "Tap Send" |
| Held draft posted after a purchase, `units/post-draft.ts` | the draft's key | not changed: it is a post on its own after a payment; a refusal keeps the draft and stops waiting ("kept"), and the person's next Post tap (WriteScreen) now carries a new key. |
| Explain my vote in words, `ResultsPage.tsx` | per tap, already dropped on any answer | line "Tap Post" instead of the server's words |
| Proposal, `ProposePage.tsx` | per tap, already dropped | line "Tap Post" (it used to say "This question is closed" for any 409) |
| Vote, `PollCard.tsx` | per tap, dropped | line "Tap Confirm vote ... Nothing was charged." |
| Flash poll vote, `FlashPoll.tsx` | kept on a 409 (bug) | dropped now; line "Tap Confirm vote" |
| Fix my text, `FixPanel.tsx` | per text, kept on a 409 | dropped now; "That did not work. Tap Fix my text to try again. You have not been charged." |
| Polling unit result, `PostResultPage.tsx` | per form, kept | dropped now; line "Tap Post" |
| Payment start, `units/checkout.ts` | one per choice in localStorage, kept on a plain 409 CONFLICT by design (a simultaneous request) | on "new key" the attempt is dropped (`needsNewKey` added to the refused set), so the next tap is a clean attempt; "Tap Pay to try again. Nothing was charged." |
| Payment verify, `payment-return.ts`; create profile, `api/me.ts`; reactions, `NewsCard.tsx` and `TalkCard.tsx` | a new key on every call | nothing to change |
| Admin actions, `admin/ui.tsx` `useAction` | per tap, dropped on any answer | words: "That did not go through. Tap the button to try again." (no button word on a generic admin tap) |

## Runs (one build, 390x844 and 1440x900)
**MEDIUM-1.** The server answered every post with 409 `CONFLICT` "Start again with a new key" three times, then 201. Fake microphone (`--use-fake-device-for-media-stream`), signed in, `moodOptions` empty.
| flow | width | requests | keys | line in view at 390x844 / 1440x900 | generic line | posts accepted |
|---|---|---|---|---|---|---|
| text answer `/q/q9/write` | 390 / 1440 | 409 409 409 201 | 4 different | yes, 3 of 3 / 3 of 3 | no | 1 |
| voice answer `/q/q9/speak` | 390 / 1440 | 409 409 409 201 | 4 different | yes / yes | no | 1 |
| text reply `/q/q9/write?reply=a1` | 390 / 1440 | 409 409 409 201 | 4 different | yes / yes | no | 1 |
| voice reply (sheet on `/q/q9/a/a1`) | 390 | 409 409 409 201 | 4 different | yes | no | 1 |
Pictures (opened and looked at): `post409-text-answer-390.png` (the line under the form, the Post button in the same screen), `post409-voice-answer-390.png`, `post409-text-reply-390.png`, `post409-voice-reply-390.png`. The voice reply at 1440 gave no result: the run did not get through the desktop thread's reply entry in my script (not run, not proved there; the same `VoiceBox` code is proved at 390).

**MEDIUM-2.** 7 pages (Home, landing, `/join`, `/go`, question, `/speak`, share), clock right at load with a right `Date` header, the device clock stepped about 24 s after load, the instant 60 s after load, 390 wide. Seconds to live after the real instant, min to max over the 7 pages:
| step | live (s) | asks before the instant |
|---|---|---|
| back 10 min | 0.35 to 5.76 | 0 |
| back 3 h | 0.57 to 4.47 | 0 |
| forward 10 min | 1.09 to 5.81 | 1 ask per page (Home, landing, `/join` make 3 API calls per ask: 3 each, others 1) |
| forward 3 h | 0.47 to 4.00 | same |
Return to the tab (step, tab hidden through the instant, shown 12 s after; 0 API calls while hidden on all 7): back 10 min, back 3 h, forward 3 h: all 7 pages were still "Coming up" when shown and live 0.05 to 0.50 s later.

**MEDIUM-3.** 7 pages per case, 390 wide, the instant about 200 s after the pages were settled (2.9 min watched). "Asks" are API calls before the real instant per page (Home, landing, `/join` make 3 calls per ask).
| case | live after the real instant (s) | calls before it per page, over 2.9 min |
|---|---|---|
| header right, device 10 min slow | 1.32 to 3.80 | 0 |
| header right, device 10 min fast | 0.64 to 5.35 | 9 (3 asks) for the 3 multi-call pages, 3 (3 asks) for the others: one ask a minute |
| device right, header 10 min slow | 1.77 to 5.17 | 0 |
| device right, header 10 min fast | 0.17 to 4.41 | same as device fast: one ask a minute |
| header missing, device right | 0.54 to 4.76 | 0 |
| header missing, device 10 min slow | share 3.58; the other 6 NOT live in 60 s: **late, as allowed** (there is no second clock to ask by) | 0 |
| both wrong the same way (device and header 10 min slow) | share 4.50; the other 6 NOT live in 60 s: **late by design** | 0 |
The share page is live in the last two rows because the server draws it with its own right clock and hands that time to the page.

**Regression, both clocks right** (Home, `/go`, question, `/speak`, share; 5 runs each, seconds to live, pooled per run, never early, requests before the instant 0 on every page of every run):
390: run 1: 0.36 2.96 3.02 4.08 4.50; run 2: 0.87 1.29 2.30 3.61 4.84; run 3: 1.29 1.74 1.78 3.10 4.22; run 4: 1.22 1.74 1.89 3.67 5.15; run 5: 0.66 1.47 1.80 5.01 5.13.
1440: run 1: 1.25 1.51 2.13 2.87 4.74; run 2: 0.05 0.17 0.59 0.98 3.24; run 3: 0.35 1.11 2.18 3.64 3.99; run 4: 0.79 2.39 3.05 3.12 3.98; run 5: 0.14 1.52 3.59 3.76 4.36.
(The values are in the order the pages finished, not page order; the run output did not keep the names for this part.) Pictures: `regress-live-*-390.png`, `regress-live-*-1440.png`; opened: `regress-live-share-390.png` (live share page), `back-home-390.png` (Home live after the tab returned).
**Round 4's share runs** (`e2e/round4.e2e.mts` `PART=srv`, the server's own call failing 1, 2, 5, 20 times, a hang, 503 x5; 390 and 1440): error page at any 100 ms sample: none in all 12 runs; live 0.43 to 5.10 s after the instant; server calls after the instant 0 (the 3 counted are the first load).

## Tests
Added `tests/round5.test.tsx` (15): the helper, a held draft's key renewal, three taps of the reply box with three keys, newest reading wins (LOW-2), 4 clock steps with the watch, return after a backwards step, 5 two-guess cases, device and header both slow (late). Added `tests/support/clock-setup.ts` (every test starts with no reading of the server clock, as a fresh page does).
Test setup changed: `vitest.config.ts` fakes `performance` with the other timers (`fakeTimers.toFake`) and runs the setup file above. The watch measures waits on `performance.now()`, so a test that moves time must move it too.
Assertions changed (one): `tests/round3.test.tsx` "device clock 10 minutes fast: asks within 0 to 5 s of the real instant and never before". Old: no ask before the real instant for any skew. New (the round 5 ruling, the earlier of the two clocks): for the fast clock at most 1 ask in the 19 s before it (one a minute); right and slow clocks still 0; the ask within 0 to 5 s of the real instant is unchanged. No other assertion was touched.

## Choices
- When the two guesses differ by 10 s or less they count as one clock: the old behaviour (steps 5, 15, 30, 60) is unchanged.
- While only the earlier guess has come, one ask a minute (not the 5, 15, 30 steps); at the later guess the steps begin again. If the earlier guess is the right one and the API answers from a cache, it is up to 60 s late (LOW-1 stays as it was).
- The server's time is also the starting point when there is no reading: the device clock at the first look, carried by `performance.now()`. A device clock that was right at load and steps later keeps its guess even with no `Date` header.
- A device clock that is fast now asks early, about once a minute, by design (the ask is harmless: only the server's answer opens the page).
- `InView` scrolls the failure line to the middle of the screen when it appears (no inline style; `scroll-my-4`). Used on the writers above that have a visible post button.
- A payment keeps its key on a plain 409 CONFLICT (a simultaneous request); only the "new key" answer drops it.
- The posted page logged one console error in my stub runs (`reading 'split'`): my stub does not serve `GET /answers/a9`; not a product finding.

## Not done
- The voice reply at 1440 (see above). The held-draft auto post after a purchase keeps its key (see the table).
- The regression run output does not name the page behind each time.
- Home, landing and `/join` make 3 API calls per ask (as before); the early ask of a fast device clock costs 3 calls on those three pages once a minute.
