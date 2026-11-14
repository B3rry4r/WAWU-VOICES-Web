VERDICT: FIX

# Verify V-DM web (direct messages, screens)

Code under test: `v/dm` 51a1b20 (as carried by `verify/v-dm`). Run against a stub API only, built app (`next build`, `next start`), Chromium 390x844 and 1440x900, light, deviceScaleFactor 2, clock fixed at 14 Nov 2026 10:00. Pictures: `docs/lead/dm/shots/` (80 files; the folder is in `.gitignore` as `shots`, so they were added with `git add -f`). Scripts are in my scratchpad and are not committed.

## Step 1: merge and checks
- `git merge origin/main` (53e738b) into a throwaway worktree: **no conflicts**, 22 files, auto-merged. Nothing was pushed from it.
- `npx tsc --noEmit`: 0 errors.
- `next lint`: "No ESLint warnings or errors".
- `npx vitest run` on the merged copy: **86 files, 85 passed, 1 failed; 856 tests, 854 passed, 2 failed.** Both failures are in `tests/shell-bar.test.tsx` (the same 2 fail on the unmerged `verify/v-dm` tree; the file passes 19/19 on origin/main). See HIGH-1.
- `next build`: succeeded (51 static pages; `/messages` 4.67 kB, `/messages/[id]`, `/messages/new/[userId]` built).

## Findings

### BLOCKER
None found.

### HIGH
1. **Two existing tests fail because of this branch.** `tests/shell-bar.test.tsx`: "a signed-in person gets the bell to /notifications with a dot from the API" (`apiFetch.mock.calls[0][0]` is not `/notifications/unread-count`, the new `/dm/unread` call goes first) and "phone and desktop bells share one unread call per mount" (`apiFetch` called 2 times, expected 1). The builder ran only `tests/dm.test.tsx` and `subscriptions.test.tsx`. The tests need updating (the second call is by design) or the DM poll needs to be separate from that mock; either way main's own suite is red on this branch. `src/components/shell/Messages.tsx:22-47`, `AppShell.tsx`.
2. **A long chat opens at its top, not at the newest message, and sending does not scroll.** `ConversationPage.tsx` has no scroll-to-latest. With 200 messages, on open `scrollY=0`, page height 2016, newest message at y=1783 (picture not taken, measured). With a long unbroken URL sent, the new bubble ends up behind the composer (`state-long-emoji-rtl-390.png`, last bubble cut off by the composer). A chat app must land on the newest message. Should: scroll to bottom on open and after the person's own send.
3. **Unverified sender: the screen sends them to subscription plans.** `dm-logic.ts:41` text "Subscribe and get verified to send messages." and link "See subscription plans" to `/units/buy` (`chat-403-unverified-390.png`; `F11` href `/units/buy`). The owner's rule is "only a verified person can send"; the way forward is to get verified, not to subscribe. The builder admits the gate is still "a running subscription" and the verify merge is not done. The words and target must follow the verify flow. (No `/verify` route exists in this web branch, so the right target is unknown: needs an owner decision.)

### MEDIUM
1. **No Retry control on a failed send.** The danger banner appears ("Something went wrong on our side. Try again in a moment.", `chat-send-failed-390.png`) but there is no Retry button and no failed bubble; the text stays in the field. Worse: the field is disabled while sending, so focus drops to `<body>` (measured `BODY`), and pressing Enter again does nothing; a keyboard person must Tab back. Idempotency key reuse does work (F12: second try sent once with a key). Should: a Retry button beside the error, focus returned to the field.
2. **Unread tab count differs from the board.** Board shows "Unread 3" for rows with 2 and 1 unread (messages); built counts chats ("Unread 2", `inbox-chats-390.png`, `InboxPage.tsx` `unreadCount` filters conversations). Board number is the sum of unread messages. Decide; as built it disagrees with the board.
3. **Person who blocked you or turned messages off: the page says "Say hello".** `chat-messages-off-390.png`, `chat-blocked-you-390.png`: the empty state "Say hello / Write a message or tap the microphone..." is shown above the line "You can't message this person." with no composer. Contradictory. Also the same generic line for both cases although `dmFailure` has a different text for `dm_closed` ("This person is not taking messages."). Should: hide "Say hello" and use the specific line.
4. **Existing chat with a deleted account (or someone who has since blocked you or closed messages) keeps an enabled composer.** `accepts` is only learned from `/dm/with` (new chats), not for `/dm/conversations/{id}/messages`. `privacy-deleted-chat-390.png`: header "Deleted account", no More menu (good), but "Write a message" and the mic are live; the person only learns on a failed send ("You can't message this person."). Should: disable and say why.
5. **More menu is not accessible.** `ConversationPage.tsx:315-322`. Measured: Escape does not close it, a click outside does not close it, the button has no `aria-expanded`, focus does not move into the menu on open (S8). Report sheet and New message sheet are Sheets and were not tested for the same.
6. **Number not from the API.** `DM_MAX_CHARS = 5000` is fixed (`dm-logic.ts:6`), used for the disable point, "5,000 characters" and "N of 5,000". `/dm/limits` returns `maxChars`. With `maxChars: 2000` the screen still accepts 3000 characters (S10d). Voice seconds and prices do come from the API and the caption was correct in all cases tried: free/10 s "Messages are free. Voice messages are up to 10 seconds."; priced "Text costs 0.5 tokens for every 150 characters. A voice message costs 2 tokens and can be up to 30 seconds."; text free + voice priced "Text messages are free. A voice message costs 1 token and can be up to 60 seconds." No "free" when a price is above 0. If `/dm/limits` fails the caption is empty (blank line, no number invented).
7. **1440 layout does not match the board** (builder said it was never compared). See table. Biggest: Messages heading area order (board: title, tabs, search; built: title, search, tabs), tabs stretched full width instead of a small left pill, list not in a rounded white card, "New message" is a filled green button (board outlined), conversation has no "Back to messages" text link row and no bordered header card, composer not in a white card, right Trending column is missing.

### LOW
1. Guest on `/messages` sees the Search and + icons in the bar; + does nothing (`InboxPage.tsx` returns the sign-in note before the sheet renders) (`guest-messages-390.png`, S14).
2. Muted row uses a plain bell icon, not a muted bell, and "Muted" label only for screen readers (`inbox-muted-chat-390.png`).
3. Recording line wraps to two lines at 390: "Recording 0:02 of 0:10" (`chat-recording-390.png`).
4. Messages icon on `/messages` at 1440 is drawn in the mint "active" state; board draws it plain white with the dot.
5. Bottom tab bar highlights Home on /messages (board highlights none); there is no tab bar on a chat (fine).
6. Own profile `/p/<my handle>` (stub) shows "Message @me, Report, Block" on yourself; the real app may redirect own handle, so not proved either way.
7. Settings help text "Messages you already have stay." is a claim about API behaviour I could not check.
8. Day divider for older days reads "Tuesday, 10 Nov"; time in the inbox falls back to "Tue" (board "Mon"): matches the board style, no issue.

## Board vs built, element by element

390 inbox (Messages-390.png vs inbox-chats-390.png)
- Top bar: back arrow, title "Messages", search, plus: same. Same icons and order.
- Tabs: board is a compact pill (All / Unread 3) left aligned; built stretches the segmented control across the width (difference, LOW-MEDIUM). Unread number: see M2.
- Rows: board full-bleed, 76 px, mint band edge to edge with red count; built is inset 16 px each side, same 76 px, same mint rows, red badges, mic + "Voice message · 0:09", "You: " prefix, handle, time. Text truncates earlier in built ("Perfect. Send me the link when yo...") because of the inset; the board's fits (difference).
- Footer privacy line: same words, same centre. 
- Bottom nav: board has none highlighted; built highlights Home.

390 conversation (Conversation-390.png vs chat-more-menu-390.png)
- Header: back, avatar, name, "@kemi.b · Abuja", ellipsis: same. Menu: Mute this chat / Report @kemi.b / Block @kemi.b with bell, flag, circle-x icons, red Block: same words, order and icons. Built menu is slightly wider and sits a little higher.
- Bubbles: theirs white left, mine mint right, 9:41am style times, voice player with transcript line "Transcript ..." bold word, "1x" chip, duration 0:08: same.
- Composer: "Write a message" pill, round green mic, caption under it: same. Built composer is separated by a hairline and sticky; same text.

1440 inbox (Messages-1440.png vs inbox-chats-1440.png): see M7. Also: built logo is the real logo (board shows a broken image alt, board defect); country pill "Nigeria" is in the board top bar and absent in built (not DM; also absent on origin/main Home: see regress pictures); messages icon present with yellow dot in both.
1440 conversation (Conversation-1440.png vs chat-more-menu-1440.png): see M7; menu position and words match; date divider "Today" matches.

Differences that follow from facts above: caption words (number from API), the 403 prompt (verification rule, though see H3).

## Flows, by clicking (stub API, `flows.mts`)
Passed: open inbox then a chat (mark read called, Unread 2 to 1, dot stays while one chat unread); send text (bubble appears, key sent, reload stays on `/messages/c-bol`, chat moves to top of inbox after the stub's updated time); send voice with the fake microphone (draft "Voice message 0:0x", Send, 3 clip calls, bubble appears); mute and unmute (label flips); report (Send disabled until a reason, then "Thanks. We got your report."; duplicate 409 shows "You already reported this. Our team has it."); block from chat (goes to /messages, chat gone); profile More then "Message @amaka.e" then send then inbox (top row); New message search "@kemi" opens the chat; browser Back from a chat returns to inbox; phone back arrow on inbox goes to /profile; settings switch sends `dmOpen:false`; new messages from the other person appear after window focus; muting a chat drops its unread from the badge total.
Not passed: see H2, M1, M5.

## States
- Loading: skeleton shown (`state-loading-390.png`). 500 on conversations: "This did not load ... Try again" (`state-error-500-390.png`). Chat 500 and offline: same card with "You are offline", Try again (retry works as a button). Offline send: "You are offline. Check your connection and try again."
- 5,000 characters send; 5,001 disables Send and shows "Keep it to 5,000 characters." (fixed number, see M6).
- Long unbroken string, long URL, emoji, Arabic: no sideways scroll at 390 on any DM screen (scrollWidth 390 on /messages, a chat, new chat); Arabic bubble keeps `direction:ltr` (no `dir=auto`), so mixed text may align wrongly (LOW, `state-long-emoji-rtl-390.png` looked acceptable).
- Long handle/name: truncated with an ellipsis in header and rows, no overflow.
- 200 messages: 20 per page, "Show older messages" 9 clicks reaches 200; opens at top (H2).
- Dark theme: inbox and chat at 390 and 1440 (`dark-*.png`) readable, mint and surface tokens switch correctly.
- Focus order at 390: Back, More, players, message field, mic button; composer label "Your message", mic "Record a voice message", send "Send message".

## Privacy
- Anonymous post: the only ways into a chat are the person page More menu, the Messages row on Me, and New message; a post row with no author has no link (`PostRow.tsx:54` shows "Anonymous"). Read in code and grep of all `/messages` links; I did not click through an anonymous post in the browser.
- Blocked: block from chat removes the chat from the inbox and goes back; a person who blocked me sees the closed page of M3 and cannot send (403 `blocked` shows "You can't message this person.").
- Deleted account: header "Deleted account", no handle, no menu, composer still enabled (M4).

## Words
No em-dash and no "Rant" in `src/features/dm`, `src/app/messages`, `src/components/shell/Messages.tsx` (grep). Numbers on screen: seconds, prices, tokens come from `/dm/limits`; the 5,000 and the 30-second poll are fixed (M6).

## Other files changed
Same stub for origin/main (built) and the merged tree, full page, light, 390 and 1440: Home, Settings, Me, a person page (`regress-*-main-*.png`, `regress-*-dm-*.png`). Pixel difference: Home and person 1440: only the top-bar icon area; person 390: identical; Me 390: the new "Messages" row and the shift under it; Settings: the new "Let people message me" row (+77 px) and shift. Nothing else moved. Home used an empty Home payload, so Home feed content was not compared.

## Proved by runs
Merge (clean), tsc, lint, vitest (counts above), one `next build`, every picture in `docs/lead/dm/shots/`, flows F1-F14, states S1-S14, regress diff for 4 existing screens.

## Read only
`ConversationPage.tsx`, `InboxPage.tsx`, `dm-logic.ts`, `Messages.tsx`, `PersonPage.tsx` diff; anonymous-post entry points; the `/dm` API schema in `contract/openapi.yaml`.

## Not proved
- Real API behaviour (stub only): real 403 bodies, real `dm_closed`, rate limit, ordering by `updatedAt`.
- Voice playback audio (the stub gives no real audio file), transcript arriving later, `1x` speed change.
- Hold-to-record on a real phone and microphone permission denied states.
- Anonymous post in the browser; Home feed contents; mail/verify copy; pictures of the board's "Muted" visual, which the boards do not draw.
- The stub put `acceptsMessages` false for blocked/closed; the real API's answer for an existing chat was not observed.
- Unread dot polling every 30 s (only focus refresh was run).
