VERDICT: FIX

# V-FIX-D web verification

Code under test: `v/fix-d` at c02e37f (my branch `verify/v-fix-d` adds only the boards, this report and pictures). Browser runs were against the one `next build` of that code, with every API call stubbed in the browser (and a tiny local stub for the server-rendered share page). Nothing live was called. The scripts are not committed. Pictures: `docs/lead/fix-d/shots/` (80 files, light theme, deviceScaleFactor 2, 390x844 and 1440x900; the dark ones are `dark-*`).

The wrong-account test, the one that would be a BLOCKER, passed: nothing went out under the wrong account. There is no BLOCKER. The verdict is FIX because of the HIGH items below, which are visible on the main phone screen or are false words.

## Checks (exact)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `next lint` | "No ESLint warnings or errors" |
| `npx vitest run` | 89 files passed (89), 867 tests passed (867) |
| `next build` | passed (one build) |
| origin/main alone | nothing failed, so there was nothing to compare |

I also built origin/main (53e738b) in a throw-away worktree to prove the shared screens (item 8). That worktree is removed.

## Findings

### BLOCKER
None. See "Different person signs in" under Proved by runs.

### HIGH

**H1. The Outbox offer banner is still squeezed into a thin column at 390.** `src/features/speak/Outbox.tsx` (the `offer` Banner, the container `max-w-[560px] ... px-4`). Picture: `outbox-priced-offer-390.png`. I went offline, recorded 2 seconds, tapped Send, came back online and opened `/` with no free post left. The title "A recording is waiting" breaks to "A / recording / is waiting" and the body "Saved while you were offline, 2 seconds." breaks into seven short lines beside the "Send for 78 tokens" button; the banner is about 215px tall. The builder's round 1 note says this was fixed by shortening the words, but that picture was taken on `next dev`, not on the build. On the build it is still broken. It should read as a short banner: title and one line, with the button under them or at full width. The sending and failed pictures (`outbox-priced-sending-390.png`, `outbox-priced-failed-390.png`) use the same Banner. At 1440 it is fine (`outbox-priced-offer-1440.png`).

**H2. The how-to panel says things that are false on a computer and on an iPhone.** `src/features/share/ShareSheet.tsx` (the `saved` block) and `save-card.ts`. Pictures: `howto-stories-390.png`, `howto-tiktok-390.png`, `howto-stories-1440.png`. Tapping Stories or TikTok only makes the browser download a PNG (`a.download`, no Web Share, no gallery write; I saw `voices-story-card.png` and `voices-square-card.png` download in Chromium). The panel then says "Open Instagram and tap Your story" and "Pick the VOICES card from your photos".
- On a computer: Instagram on the web does not post stories, and the file is in Downloads, not in "photos". The panel is shown at 1440 as well, with the same words.
- On an iPhone: a browser download goes to Files, not the Photos app. I cannot run iOS here, so this one is from how browsers save a download, not seen. I did not see a real phone at all (see Not proved).
- On an Android phone the download normally shows in the gallery, so the words are probably right there.
It should either use the phone's own share sheet with the file where it exists, or say where the file went ("Saved to your Downloads") and drop "from your photos" and the Instagram steps on a computer.

### MEDIUM

**M1. The how-to panel is below the first screen at 390.** `howto-stories-390.png`: after tapping Stories the card is saved but the panel starts under the fold (the sheet's card image is 357px tall), and nothing scrolls it into view. On a phone the person sees a download and no instruction until they scroll the sheet. It should scroll into view, or the card preview should be smaller while the panel is shown.

**M2. A failed saved recording has no way to try again, and a priced offer disappears when it fails.** `Outbox.tsx` `send()`. Pictures: `outbox-free-failed-390.png`, `outbox-priced-failed-1440.png`. After a failure the banner says "We could not send your saved recording. It is kept on this device. Try again in a moment." with no button. The recording is still there (a reload sent it, see below) but the person has no control, and for a priced one the "Send for 78 tokens" offer is replaced by the failed note, so the price and the button are gone until the next page load. It should keep the offer and add a Try again.

**M3. A free recording sends with no sign for the person.** `Outbox.tsx` (the free path calls `send()` without setting a view). With the answer call slowed to 3 seconds I polled the page every half second: no banner at all until the 3.7 second mark, then "Your saved voice was posted." A person who opens the app sees nothing while their voice uploads and may close it. A "Sending your saved voice" line is needed.

**M4. Storage full: the screen says the recording is saved when it is not.** `SpeakScreen.tsx` `keepForLater` and `draft.ts` `saveDraft` (the catch is silent). With `IDBObjectStore.put` throwing QuotaExceededError, offline Send still said "You are offline. Your recording is saved on this device. It will be offered for sending when you are back online" (`outbox-storage-full-390.png`). After coming back online and loading `/`, nothing was posted and no Outbox appeared: the recording was lost without a word. It must say it could not be kept and ask the person to stay on the page.

**M5. Two tabs: two clips and two answer requests with one key.** Two tabs on `/` with one kept recording (free): 2 `POST /voice-clips`, 2 `POST /questions/q1/answers`, both with the same Idempotency-Key, and both tabs showed "Your saved voice was posted. See it". No clip was deleted, so one clip is orphaned, as the builder said. For the priced case, both tabs showed the offer, I tapped both: 2 clips, 2 answer requests, same key, `extraVoiceTokenId` null in both (my stub has no old tokens). Whether one answer or two is posted, and whether anything is charged twice, depends on the real API honouring the key; my stub returns 201 for both, so this is not proved either way. What a person sees is "posted" in both tabs. The lock (`claimSend`) is per tab (an in-memory Set), so it cannot stop this. A lock in IndexedDB or a BroadcastChannel would.

**M6. A reply retried after flipping the switch keeps its Idempotency-Key.** `ReplyComposer.tsx` (`key.current` is reused while the text is the same). Case: a named reply fails, the person turns the switch on, taps Post again: the second call has `anonymous: true` and the same key as the first (`T1b`, keys `2b19829e` both). The contract has `IDEMPOTENCY_KEY_REUSED`. If the first call actually reached the server and only the answer was lost, the retry either gets the stored named reply back (named without meaning to, the worse case) or an error the person cannot act on. The reverse flip (on, fail, off) has the same property. The key should change when the anonymous choice changes. Not proved against the API.

### LOW

**L1. "More" is missing where the browser has no `navigator.share`.** `ShareSheet.tsx` (`canNative`). The board draws ten targets with More last, at 390 and at 1440. In headless Chromium (desktop, no share) the sheet shows nine targets, second row of four (`sheet-answer-390.png`). With `navigator.share` stubbed it shows ten as drawn (`sheet-with-more-390.png`). Right for a browser that cannot share, but it differs from the 1440 board on most desktops.

**L2. At 390 a writer's own "My experience" reply makes the page scroll sideways.** `ThreadScreen.tsx` reply row. Page scroll width 410 or 415 against 390 (`thread-writer-390.png` shows the card cut off at the right). The named version overflows on origin/main as well (415 on main), so it is not new, but the new "Posted without your name" line is in the same row and the unnamed one is 410 here (on main an unnamed reply cannot exist). Needs the header to wrap.

**L3. `published_from_link` is not sent for a recording that the Outbox posts.** `Outbox.tsx` never calls `notePublished()` (grep: only `SpeakScreen.tsx:410` and `WriteScreen.tsx:101` do). A voice recorded offline from a share link and sent later is not counted as published from the link.

**L4. The switch on the 1440 reply box sits under the Post button.** `composer-off-1440.png`: Post is at about y=1130 of 1250, the switch row starts below it and is outside the first screen at 900px high. A person who types and taps Post does not see it. Default off so nothing goes wrong, but it is easy to miss.

**L5. The story and square cards have no preview in the app.** The brief lists "the story and square card previews". The sheet only previews the 1200x630 card; the 1080x1920 and 1080x1080 cards are downloaded unseen. So I have no picture of them from the UI. The cards themselves are drawn by the API, which I did not run.

## What the boards draw and the screens do (per element)

Method: I opened each `.dc.html` in Playwright, read its text and its pictures. The boards DO render for me (text is there); only the logo image is missing.

### ShareSheet (board `entry/ShareSheet-390` and `-1440`) against `sheet-*-390.png` and `-1440.png`
- Targets and order: board WhatsApp, Status, Stories, Facebook, X / TikTok, Telegram, SMS, Copy link, More. Built the same, nine of ten (More only with `navigator.share`, L1). Proved by the order read from the DOM on all 14 sheets I opened.
- Grid, circle, label: board `repeat(5,1fr)`, gap 12px 4px, 52px circle, label 12px/16px 600, 6px between. Built `grid-cols-5 gap-x-1 gap-y-3`, 52px, 12px, `gap-[6px]`. Same. Circle line: board uses an inset 1px shadow, built uses a 1px border: same look.
- Icons: board uses two-letter marks (WA, WS, IG, FB, X, TT, TG) and a chat icon for SMS, link icon on mint for Copy link, dots for More. Built the same. The board's marks are drawn that way, so it matches, though they are not the apps' real logos.
- Title "Share this voice" and "A card and a link go out. The audio file never does.": same on an answer. Other kinds get their own titles (question, results, week, profile, summary, thread), which the board does not draw. They read fine.
- Fine print "Sharing is free. Your link carries your referral code.": the board prints it always; built prints it signed in and "Sharing is free." for a guest. A guest's link has no referral code, so the shorter line is the true one.
- Card: board shows the dark 1200x630 card; built shows whatever image the API gives (a plain violet square in my stub). Real card not proved.
- Close button, handle, rounded top at 390; dialog 520 wide at 1440: same positions (compared `sheet-answer-1440.png` with the board picture).
- Not drawn by the boards: the how-to panel, the "Save the square card instead (1080 x 1080)" link, the "card is still being made" and error lines. Judgement: the saved panel uses the same grey rounded block and 14px body text as the rest of the app and looks like it belongs; its wording is the problem (H2), and it sits below the fold (M1). The "(1080 x 1080)" figure is a technical word for a lay reader; "Save the square version" would do.

### Posted (board `talk/Posted-390`): not changed by this branch except its share sheet. `sheet-posted-390.png` and `sheet-posted-1440.png` show the same sheet. The board's own inline row "Share to WhatsApp / WhatsApp Status / Instagram Stories / Copy link / More apps" is unchanged on the screen and is a different control from the sheet; I did not find the sheet and that row disagreeing about Status (both open WhatsApp).

### Thread (board `talk/Thread-390`, `-1440`) against `thread-*-390.png`, `-1440.png`
- Reply rows, chips "I agree / I disagree / My experience", the "Reply to @tunde.a in words" bar: present as drawn. The board shows 86 replies with the counts "All 86, I agree 41 ...": built shows its count chips the same way.
- The board draws no "Anonymous" row and no "Posted without your name" line and no switch. Built: an unnamed reply is a row with an initial avatar "A" style placeholder, name "Anonymous" and (for the writer only) the line "Posted without your name". Judged against the neighbouring rows it is consistent with how an anonymous answer reads.
- The switch ("Post without my name" plus "Your name and photo stay hidden. Admins can still see who posted, to keep Voices safe.") is not drawn on the Thread, Write or Record boards. It is the same component the answer write screen already has, so the screens around it agree.
- Words: board "Reply to @tunde.a in words" equals built.

### Write (board `talk/Write-390`) against `write-off-390.png`, `write-on-390.png`
Same title/question block and counter; the switch row sits under the text box as it does on the answer write screen. Board prints "Last free post" and a price line; built prints its own lines from the allowance. Not a V-FIX-D change.

### Record (board `talk/Record-preview-390`)
Board: "Listen back. Nothing posts until you tap Send." then Re-record / Delete / Send. The built voice box adds the switch between the hint and the buttons (`voicebox-off-390.png`, `voicebox-on-390.png`). Not drawn on the board. It uses the forest-panel colours of the recorder, so it sits well.

### SharePage and the share cards
`sharepage-390.png` is the share page against my stub (not changed by this branch except the visit memory). I did not compare the four card boards (question, poll, voice, weekly) to the real cards: they are drawn by the API, which I did not run. Not proved.

## Anonymous replies, in the browser (item 4)
- `anonymous: true` is in the request with the switch on, on the text composer at 1440, the write screen at 390, and the voice reply at 390 and 1440 (`kind: VOICE`). Off sends no `anonymous` field.
- Fail then Try again: the text composer, write screen and voice box all sent `anonymous: true` on both the first call and the retry (two calls each, same key). Switch on after a named failure: the retry went unnamed; on, then off before the retry went named: the retry read the switch as it was at the time. Pictures `composer-failed-1440.png`, `write-failed-390.png`, `voicebox-failed-390.png`, `voicebox-failed-1440.png`.
- Switch on in one tab, send from another: the other tab's switch is off (the choice is `sessionStorage`, per tab) and its post carried no `anonymous`. The first tab still showed on.
- Remembered state: not shared with the answer switch. The answer switch is stored under the question id, the reply switch under `reply:<answer id>`; turning one on left the other off. The reply choice is kept for the tab until a reply is sent: leaving the write screen and coming back showed it still on, a reply to another answer showed off. The text composer and the voice sheet of one reply stay in step (both on, both off). Unnamed without meaning to: the switch is visible where it is sent from, and the remembered state is shown on return. Named without meaning to: I did not see it on a normal flow; the one route I found is M6.
- After sending, an unnamed reply shows "Anonymous" to a guest and to another member (`thread-guest-390.png`, `thread-member-1440.png`), and the writer also sees "Posted without your name" (`thread-writer-390.png`, `-1440.png`). The text of the page for all three people had no "me.handle" or "Me Person" (the writer's own name); page title "Replies | VOICES"; the address `/q/q1/a/a1`; no toast. The share sheet for an anonymous answer sends only `{"objectType":"ANSWER","objectId":"a4"}` (`anon-answer-sheet-*.png`); the card text and whether the story and square cards carry the name are API work I did not run.

## Share events (item 6), by request log
- Arrive on `/s/<code>`, tap "Add your voice", record, Re-record, record, Send: `link_open`, `add_voice_tap`, `recording_started`, `published_from_link`. One of each. A second post in words in the same visit sent nothing more.
- No link: recording and posting a voice and an answer in words sent no events.
- Link then answer in words only: `link_open`, `published_from_link`.
- `/speak?from=NOT_A_CODE`: nothing. Another tab with no link after a link visit in the first: no `recording_started`. Guest: `link_open` only, no Authorization header on the event.
- Not counted: an offline recording that the Outbox posts (L3).

## Offline send (item 5), by request log
- Offline Send sent nothing and kept the draft `queued: true`; the offline note is `outbox-offline-note-390.png`.
- Free, back online: opening `/` sent it by itself once (1 clip, 1 answer request) with the draft's own key as Idempotency-Key; a reload sent nothing more. Banner "Your saved voice was posted." (`outbox-free-sent-*.png`). If the first send fails (503), a reload retried and posted once more (2 request total, one success).
- Reload while waiting (priced): the offer came back, nothing posted.
- Priced: record screen said "Send for 78 tokens" and the Outbox said "Send for 78 tokens", same number (my stub's price, not a real one). Before the tap: 0 clip requests, 0 answer requests after 1.5 seconds, at 390 and 1440. After the tap: 1 answer request. Sending ("Sending it now."), failed and sent pictures at both sizes.
- Signed out while one waits: opening `/` sent nothing and kept the draft. The same person signing back in sent it once.
- Different person (u2) signs in on the same browser: opening `/` sent 0 clips and 0 answers (priced and free cases), the draft was deleted, and the record screen for u2 showed no take. Passed. It depends on the token carrying a `sub`; `currentOwner()` returns null for a token that does not, and then two such people would match. Real tokens not checked (Not proved).
- 7 days: a recording aged 8 days was removed on opening `/` with "A recording you saved more than 7 days ago was removed." and nothing was sent (`outbox-7day-*.png`); at 6.9 days it was sent; the same note shows on the record screen for a listened-only take (`record-7day-390.png`).
- Storage full: M4. Two tabs: M5.

## States and words (item 7)
- Loading, error and "card being made" for the share sheet: `sheet-loading-390.png` (skeleton "Making your card"), `sheet-error-390.png` ("We could not make your link. Close this and try again."), `sheet-cardmaking-390.png`; tapping Stories while the card is not ready shows "The card is still being made. Try again in a moment." and no panel. Empty: the sheet has no empty state other than the plain text version of the link when no card is made. Offline for the sheet: not exercised separately (the link call fails like the error case).
- No sideways scroll at 390 on the share sheet, the how-to panel, the write screen, the voice box or the Outbox banner (measured `scrollWidth` = 390). The thread has L2.
- Keyboard, share sheet: Enter on "Share this voice" opens it; Tab order Close, WhatsApp, Status, Stories, Facebook, X, TikTok, Telegram, SMS, Copy link, then Close again (focus stays inside); Escape closes and focus returns to the button that opened it; the dialog has `aria-modal` and a title label; targets are labelled by name; a visible 2px focus outline shows on a target. The switch: role `switch`, name "Post without my name", Space toggles, a visible focus ring.
- Dark: `dark-sheet-390.png`, `dark-sheet-1440.png`, `dark-thread-390.png`, `dark-thread-1440.png`, `dark-composer-on-1440.png`, `dark-write-on-390.png`. I looked at the sheet and the thread: text and circles read well, the panel and the grey blocks keep contrast.
- Em-dash and "Rant": none in the lines this branch adds (`git diff` filter), and none in the page text, title or labels of 13 screens including both sheet states (a scan of rendered text). The word "Rant" appears nowhere in `src` or the added lines.
- How-to words against what happens: see H2. "Add a link sticker with your link, then share" is Instagram-only and is right for it; "Add the link to your caption, then post" for TikTok is right.

## Shared pieces against origin/main (item 8)
Same stub, same time, screenshots of 12 screens at 390 and 1440 from the two builds (`/`, `/q/q1`, thread, answer write, reply write, results, what next, speak, posted, weekly, a profile, discover). Pixel-identical, with identical text, on all of them except: the reply write screen at both sizes and the thread at 1440, which gain the switch (expected); and 10 and 31 pixels of difference on `/q/q1` and results at 1440 (an animated dot). The empty Outbox adds nothing visible to any screen. The old answer write screen with its own switch is identical.

## Test diffs (item 1)
- `tests/v-anon.test.tsx`: the old test "is not offered on a reply" now checks the switch is offered and off; a new payload test covers `createReply` and `createVoiceReply` with and without `anonymous`; one stub line is added. Nothing else changed. It hides nothing.
- `tests/w8b-reach.test.tsx`: the one line "TikTok is not offered" is replaced by a check that Status, Stories and TikTok are present. The rest of that test (link, intent, WhatsApp href) is untouched. It does not check the order of targets, which the unit tests never did; I checked the order in the browser.

## Proved by runs
- tsc, lint, vitest (867), build.
- 14 share sheets (7 surfaces at 2 sizes): question, answer, poll result, weekly report, What Next summary, profile, Posted, with the nine targets in board order; Stories and TikTok download the story card, the square link downloads the square card; Status links to `https://wa.me/?text=...`; intents counted.
- Anonymous replies: request body, retry, two tabs, shared state, three viewers, thread text.
- Offline: queue, free auto-send, priced offer and tap, 7 days, reload, sign out, other person, two tabs, storage full.
- Share events.
- Keyboard, dark, em-dash and "Rant" scan, no sideways scroll except L2.
- Shared screens identical to origin/main.

## Read only
- Outbox does not call `notePublished` (grep).
- The `Idempotency-Key` reuse rule (the contract lists `IDEMPOTENCY_KEY_REUSED`; the API was not run).
- Browser download behaviour on iPhone and Android.

## Not proved
- The real cards (1200x630, 1080x1920, 1080x1080) and the anonymous card's words: the API draws them and I did not run it, so the sheet pictures show a placeholder image.
- Anything on a real phone: a real reconnect, the phone's share sheet, where a downloaded card lands, Instagram and TikTok steps.
- Whether two tabs post or charge twice (M5) and what the real API does with a reused key (M6): the stub accepts both.
- Real access tokens carrying a `sub`.
- "Share this question" and other sheets' offline state, and the real price numbers (78 tokens is my stub).
- The `/go` link arrival: not measured by design (builder report item 2).
