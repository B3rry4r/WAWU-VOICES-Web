VERDICT: FIX

# Verify V-DM web, second check

Code under test: `v/dm` 5fb4a50, as carried by `verify/v-dm` (48e72c6). Stub API only (browser routes, no live service). One production build (`next build`, `next start`), Chromium, clock fixed at 14 Nov 2026 10:00. Pictures: `docs/lead/dm/shots-r2/` (light, deviceScaleFactor 2, 390x844 and 1440x900; dark for the inbox and chat; 1024, 1180, 1280 wide; `board-vs-built-*.png` are the board on the left and the build on the right at deviceScaleFactor 1). Scripts are in my scratchpad and are not committed. Servers stopped.

## Step 1: merge and checks
- `git merge origin/main` (53e738b) into a throwaway worktree: **already contained in the branch, "Already up to date", no conflicts.** Nothing pushed from it.
- `npx tsc --noEmit`: 0 errors. `next lint`: "No ESLint warnings or errors".
- `npx vitest run`: **88 files passed, 894 tests passed, 0 failed.**
- `next build`: succeeded (`/messages` 2.68 kB, `/messages/[id]`, `/messages/new/[userId]` built).
- `tests/shell-bar.test.tsx` rewrite: **stricter, with one small loosening.** Stricter: each address must be called exactly once (`/notifications/unread-count` 1, `/dm/unread` 1, total 2) after both bells and both messages icons render, the mock answers by address (so a wrong call gets a wrong number), and a new test says a guest makes neither call and shows no Messages icon. Looser: the first bell test no longer pins the call order (`calls[0]`); it compares the sorted list of addresses. Net: stricter. I also saw in the browser that `/messages` itself calls `/dm/unread` a second time (the inbox refresh); that is outside the shell test and by design.

## First check's findings

| # | Finding | Now | Evidence |
|---|---|---|---|
| H1 | shell-bar tests red | **closed** | vitest 894/894 |
| H2 | opens at top, no scroll after send | **closed** | 200 messages: opens with scrollY = max, newest bubble above the composer (390 and 1440); after send (from scrolled up, 3 in a row) newest is visible. See N-M1 for "Show older". |
| H3 | 403 sends to plans | **closed** | Banner "Subscribe and get verified to send messages." + link "See how to get verified" with href `/verify`, click lands on `/verify` ("Get verified"). The words keep "Subscribe" because `/verify` itself says "Verification comes with a subscription" (VerifyScreen.tsx:116). `chat-403-unverified-390.png` |
| M1 | no Retry, focus lost | **closed** (but see N-H1) | Retry button; after a failed send focus is the input; Enter works again. `chat-send-failed-390.png` |
| M2 | Unread counts chats | **closed** | "Unread 3" for rows 2+1; muted chat leaves the total (Unread 1 when Kemi muted). `inbox-chats-390.png`, `inbox-muted-chat-390.png` |
| M3 | "Say hello" on closed chat | **closed** | only "This person is not taking messages.", no composer, history readable. `chat-messages-off-390.png` |
| M4 | deleted chat keeps composer | **closed on stub data** | `acceptsMessages:false` + deleted: closed line, no menu, no composer. `privacy-deleted-chat-390.png`. Real API field not observed. |
| M5 | More menu not accessible | **mostly closed** | `aria-expanded` true/false, focus into first item, Escape closes and returns focus to the button, click outside closes. ArrowDown does not move (see N-L1). |
| M6 | fixed 5,000 | **closed** | `maxChars:2000` from `/dm/limits` gives "Keep it to 2,000 characters." at 2,001; default 5,000 on 5,001. Send disabled by `tooLong` (read in code). |
| M7 | 1440 layout | **mostly closed** | See board against built. |
| L1 | guest sees search and + | **closed** | `guest-messages-390.png` |
| L2 | muted bell | **closed** | muted bell icon plus "Muted" shown, `inbox-muted-chat-390.png` |
| L3 | recording line wraps | **closed** | one line "Recording 0:02 / 0:10", `chat-recording-390.png` |
| L4 | messages icon mint at 1440 | **closed** | plain with dot, `inbox-chats-1440.png` |
| L5 | tab bar highlights Home | **closed** | nothing highlighted on `/messages` at 390 |
| L6 | Message/Report/Block on yourself | **closed** | `/p/adaeze.o` (my handle): 0 More buttons |
| L7 | "Messages you already have stay." | **open, not provable** | text is still in Settings; the stub cannot show the real API behaviour |
| L8 | day label style | no issue | unchanged |

## New findings

### BLOCKER
None.

### HIGH
**N-H1. A retry after a server error (5xx) sends a new Idempotency-Key, so a message the server already stored is stored again.** `ConversationPage.tsx` send(): on any `ApiError` with `status > 0` the key is replaced ("a refusal makes the next try a new one"). A 500 is not a refusal; the server may have committed. Run: stub stores the message and answers 500, then Retry: 2 POSTs, 2 different keys, **2 copies stored** (`storedInConv: 2`). Same for pressing Enter again. A network failure does it right (2 POSTs, same key, 1 stored). When a price is above 0 the second copy is also charged twice. Should: keep the key for 5xx and network errors, new key only after a 4xx refusal (403, 409, 422, 429).

### MEDIUM
**N-M1. "Show older messages" does not keep your place.** With 200 messages the button sits at the top of the thread, so the person is at scrollY 0 when they tap it. Measured: the message that was first on screen (y 194) is at y 2554 afterwards, scrollY still 0, at 390 (323 to 2083 at 1440). The 20 older messages appear and the person is now above where they were, with 2,000 px to scroll back. Should: after the older page is added, restore scrollY by the height that was added.
**N-M2. The verified tick wraps onto its own line in the chat header, and the header outgrows its 56 px bar.** 390: name block 54 px high in a 56 px bar, so "Kemi Bello" touches the top edge (measured top y=1); unverified person fits (38 px). 1440: header card 80 px against 74 px. The same wrap shows on the person page header (`side-person-390`, the verify feature, not DM) and the tick sits on a separate line under the name there too. `chat-more-menu-390.png`, `chat-more-menu-1440.png`. Should: keep the tick on the name line (inline, with the ellipsis on the name only).

### LOW
- N-L1. The More menu is `role="menu"` but ArrowDown does nothing (only Tab moves between items).
- N-L2. After the Report sheet or the New message sheet closes with Escape, focus falls to `<body>` (not back to the More or New message button). Opening moves focus in and the Tab cycle is trapped, so only the return is missing.
- N-L3. A refusal "This person is not taking messages." (403 dm_unavailable) while the chat is open shows a banner with a Retry button that cannot succeed, and the composer stays until the next refresh (focus or 30 s); only then the chat becomes the closed state (run I). Retry should not show for this refusal.
- N-L4. A banner above the composer (the 403 prompt) grows the sticky composer and covers part of the newest bubble (`chat-403-unverified-390.png`: "you post." cut at the line). Not re-scrolled.
- N-L5. Focus ring on the message field and the New message search shows a dark rectangle inside the pill (a second ring; `.dm-field input:focus-visible { outline:none }` is beaten by another rule). `chat-send-failed-390.png`, `new-message-search-390.png`.
- N-L6. The composer leaves a gap of about 75 px under the caption at 390 when scrolled to the end (sticky bottom inside a padded page); the board's composer sits at the window's bottom edge.
- N-L7. The privacy line under the inbox list at 1440 wraps into two lines and is centred about 125 px left of the list's centre; the board has one line centred under the list (`board-vs-built-inbox-1440.png`).
- N-L8. At 1440 the composer field is white; the board draws it with a faint mint fill.
- N-L9. Newest bubble taller than the space between header and composer (a 660 character unbroken link, 646 px at 390) cannot be fully visible; its bottom edge is above the composer and its top is under the header. Not a defect of the scroll code; noted because I tested it. A 200 character link and the 200-message chat are fine.

## Board against built, element by element

390 inbox (`board-vs-built-inbox-390.png`, `inbox-chats-390.png`)
- Top bar: back, "Messages", search, plus: same. Tabs: compact left pill, same, "Unread 3": same.
- Rows: edge to edge, 76 px, mint unread rows, red count badges, mic + "Voice message · 0:09", "You: " prefix, handle, time: same. Difference: verified tick (blue badge) beside the name, new by the owner's rule; "Tue" for an older day where the board says "Mon" (my data).
- Footer line same words, same place. Bottom nav, nothing highlighted: same.

390 chat (`board-vs-built-chat-390.png`)
- Header, menu (Mute this chat, Report @kemi.b, Block @kemi.b, bell, flag, circle-x, red Block), bubbles, transcript line, "1x" chip, 0:08, "Write a message" pill, round green mic, caption: same words and icons. Differences: verified tick wraps (N-M2); hairline above the composer (board has none); 75 px gap under the caption (N-L6); transcript bubble is a little narrower.

1440 inbox (`board-vs-built-inbox-1440.png`)
- Order title, outlined "New message", tab pill, search, rounded white list card, mint rows, privacy line, Trending rail: same. Differences: footer wrap and offset (N-L7); the board's top bar has a Nigeria pill and the side bar a units pill, both absent in the build and on origin/main (not DM); real logo instead of the board's broken image.

1440 chat (`board-vs-built-chat-1440.png`)
- "Back to messages" row, bordered header card, ellipsis menu, "Today" divider, bubbles, composer in a white card with caption, Trending rail: same. Differences: tick wrap and taller header (N-M2), composer field fill (N-L8), the two non-DM items above.

1024, 1180, 1280 (`inbox-chats-w*-*.png`, `chat-w*-*.png`): the three-column layout holds, list card and composer card present, no overflow. At 1024 the shell's search placeholder is cut ("Search questions, voices"), a shell matter. Dark: `dark-inbox-390/1440`, `dark-chat-390/1440` readable, tokens switch, mint and surface contrast fine.

## Step 4: long chat
- 200 messages, 390 and 1440: opens at the bottom (scrollY = max), newest bubble above the composer. 20 per page.
- After a send (from scrolled up), a long link, and 3 sends in a row: newest fully visible at 1440 and at 390 (except N-L9).
- A message arriving while reading older ones (scrollY 400, focus refresh): scrollY and the position of the message under the eye unchanged, no yank (390 and 1440). A message arriving while at the bottom is added; it was visible but the page is not scrolled to it.
- Window height 500 and 380 at 390 wide: composer inside the window, newest message above it, also after typing and after a send.
- No sideways scroll (scrollWidth 390 / 1440) with the long link.
- "Show older messages": see N-M1.

## Step 5: flows (clicks)
Passed: inbox to chat (mark read 1 call, Unread 3 to 1, icon "Messages, 1 unread"); send text (key sent, reload stays on the chat, chat on top of the inbox); voice with the fake microphone (draft "Voice message 0:02", 1 clip, 1 complete, VOICE send); mute and unmute (label flips); report (Send disabled until a reason, body `DM_MESSAGE`, "Thanks. We got your report.", duplicate 409 "You already reported this. Our team has it."); block (to `/messages`, row gone, PUT once); profile More then Message then send then top of inbox; own profile has no More; New message "@amaka" opens the chat; phone back arrow to `/profile`; settings switch PATCH `{dmOpen:false}`; new message from the other person after window focus; muting drops the unread from the total.
Unverified: 403 prompt, link to `/verify`, page loads (H3).
Becomes unavailable while open: N-L3.
Retry: network failure, same key, 1 stored (good). 500 not stored: 2 POSTs, different keys, 1 stored. 500 stored by the server: 2 stored (N-H1).

## Step 6: keyboard and screen reader
More menu: button has `aria-haspopup="menu"` and `aria-expanded`; Enter puts focus on the first item; Tab moves; Escape closes and returns focus; outside click closes; ArrowDown does nothing (N-L1). Report sheet: `role="dialog"`, `aria-modal=true`, labelled by its title, focus enters, Tab is trapped (radio, checkbox, note, Close), Escape closes (focus lost to body, N-L2); Send report disabled until a reason. New message sheet: dialog, focus in the search field, Escape closes (N-L2). Composer: label "Your message", Enter sends, mic "Record a voice message", send "Send message", focus returns to the field after a send and after a failed send; thread is `role="log"` named "Messages"; the caption has no live region. Tabs: `tablist` named "Show messages", arrow keys move and select, roving tabindex.

## Step 7: words
No em-dash, en-dash or "Rant" on any DM screen, menu, sheet, error or Settings/Me/person page I opened (page text checked in 16 states), and none in `src/features/dm`, `src/app/messages`, `Messages.tsx`, `src/features/verify` (grep). Caption follows the stub: free/10 s "Messages are free. Voice messages are up to 10 seconds."; text 0.5 per 150 and voice 2: "Text costs 0.5 tokens for every 150 characters. A voice message costs 2 tokens and can be up to 30 seconds." with no word "free"; text free + voice 1 token: "Text messages are free. A voice message costs 1 token and can be up to 60 seconds."; while typing 400 characters "400 of 5,000 characters. Costs 1.33 tokens."; `/dm/limits` failing gives an empty caption (no number invented).

## Step 8: shared screens against origin/main (same stub, built both)
Notification bell: unchanged (same pixels apart from the new Messages icon beside it). Notifications page: identical at 390; 1440 only the Messages icon area. Home: only the top-bar icon area (stub gave Home an error state, so feed content is not compared). Person page: taller header because the verify tick wraps (N-M2); rest unchanged. Settings: new "Verification / Get verified" section (verify merge) and "Let people message me" row under "Ads and privacy"; nothing else moved. Me: new Messages row. Nothing outside these moved.

## Proved by runs
Merge check, tsc, lint, full vitest (88/894), `next build`; every picture in `shots-r2/` produced (the ones I opened and looked at: inbox 390 and 1440, widths 1024 and 1180, chat menu 390 and 1440, 403, send failed, messages off, deleted chat, new person, long link/emoji/Arabic, recording, dark chat 390, dark inbox 1440, muted, new message sheet, guest, the four board pairs, person and settings side by side); scroll, Retry, flow and keyboard runs above; words in 16 states; regress diff of 5 shared screens at two sizes.

## Read only
`ConversationPage.tsx`, `InboxPage.tsx`, `dm-logic.ts`, `dm.css`, `VerifyScreen.tsx` text, the shell-bar test diff; the `acceptsMessages` use (code reads the field; the stub supplies it).

## Not proved
- Real API: real 403/dm_unavailable bodies, real `acceptsMessages`, real idempotent replay after a 500 (N-H1 is about what the web sends).
- The 30 s unread poll (only the focus refresh was run). Voice playback sound and the "1x" speed change. Microphone permission denied.
- Pictures of Home feed contents. Anonymous post in the browser. Real phone keyboard (I reduced the window height only).
- "Muted" visual is not on the boards.
- Screen reader output (I read roles and names from the page, not a reader).
