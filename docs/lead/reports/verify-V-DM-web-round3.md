VERDICT: MERGE

# Verify V-DM web, third check

Code under test: `v/dm` a023058 as carried by `verify/v-dm` (0034fe6). origin/main (59a44d6) is already an ancestor of the branch (checked with `merge-base --is-ancestor`), so the merge adds nothing new. Stub API only: Playwright browser routes answer every `/api/v1` call; no live service, no `.env` opened. One production build (`next build`, `next start` on 3100). Chromium with the fake microphone, light, deviceScaleFactor 2, 390x844 and 1440x900 (1024, 1180, 1280 at 900 high). My scripts are in my scratchpad and not committed. Pictures: `docs/lead/dm/shots-r3/` (`board-vs-built-*.png` are the board on the left, the build on the right, at 1x). All servers I started are stopped; the main worktree I built for comparison is removed.

Decision on my own: I rank by what a person meets. Nothing found is a BLOCKER, HIGH or MEDIUM, so the verdict is MERGE; the lows below can follow.

## 1. Checks (exact)
- `npx tsc --noEmit`: exit 0, no errors.
- `npx next lint`: "No ESLint warnings or errors", exit 0.
- `npx vitest run` (whole suite, after the builder's last CSS change): **90 files passed, 923 tests passed, 0 failed.**
- `npx next build`: succeeded, exit 0. Everything below ran against that build.

## 2. The second check's new findings

| # | Finding | Now | Run or picture |
|---|---|---|---|
| N-H1 | retry after 5xx sends a new key | **closed** | see "N-H1 runs" below |
| N-M1 | Show older loses your place | **closed** | see "N-M1 runs" below; `older-after1-390.png` |
| N-M2 | tick wraps, header outgrows bar | **closed** | 390: bar 56 px, name 20 px high at y 9, tick 16 px at y 11, same line, who block 38 px (was 54). 1440: header card 74 px. `chat-390.png`, `chat-1440.png`, `chat-more-menu-*.png` |
| N-L1 | ArrowDown in More menu | **closed** | Enter opens, focus on first item; Down, Down, Down, Up, Up gave Mute, Report, Block, Mute (wraps), Block (wraps), Report. 390 and 1440. Escape closes and returns focus to the button |
| N-L2 | focus lost after sheets close | **closed** | Report sheet: closes by Done, focus goes to the More button. New message sheet: Escape returns focus to the New message button (390 phone plus icon, 1440 outlined button). One gap, see L-A |
| N-L3 | Retry on a refusal that cannot succeed | **closed for dm_unavailable, verification_required, ACCOUNT_SUSPENDED, VOICE_TOO_LONG** | dm_unavailable on a live send: 0 Retry buttons, composer gone, "This person is not taking messages." at once (`closed-after-refusal-*.png`). 403 verification_required: 0 Retry. See L-B for two that still show Retry |
| N-L4 | banner covers newest bubble | **open at 390** (closed at 1440) | 403 banner: 390 newest bubble bottom 677, composer top 638, so 39 px of the bubble and its time sit under the composer, and the page is already at max scroll so it cannot be revealed. 1440: 705 against 746, fine. `chat-403-unverified-390.png`. See L-C |
| N-L5 | double focus ring | **closed** | one 2 px green ring on the pill (field and New message search), no inner rectangle. `chat-field-focus-390.png`, `inbox-search-focus-1440.png` |
| N-L6 | gap under caption (75 px) | **improved, not gone** | caption bottom to window bottom is now 44 px at 390 (was 75), 60 px at 1440 (inside the card). Board is about 31 px. Cosmetic |
| N-L7 | privacy line wraps and is off-centre at 1440 | **closed** | 1440: line 640 px wide, same left and centre as the list (centre 674 and 674), one line. 390 two lines, centred (board also two) |
| N-L8 | composer field white at 1440 | **closed** | 1440 field fill rgb(221, 243, 232) (mint), 390 white as the 390 board |
| N-L9 | 660 character link | no defect (unchanged) | 200 and 660 character links: no sideways scroll. Builder's measurements in `r3/measurements.txt` agree; I did not rerun the 660 case |

### N-H1 runs (the stub stores the message, then answers; Idempotency-Key read from the request)
Message "hello once", press Enter, then Retry (or Enter again):

| Stub answer | POSTs | distinct keys | messages stored |
|---|---|---|---|
| 500, stored | 2 | 1 | 1 |
| 502, stored | 2 | 1 | 1 |
| 503, stored | 2 | 1 | 1 |
| 504, stored | 2 | 1 | 1 |
| connection dropped after storing, Retry | 2 | 1 | 1 |
| 500 stored, Enter instead of Retry | 2 | 1 | 1 |
| connection dropped, Enter | 2 | 1 | 1 |
| 500 stored twice then Retry twice | 3 | 1 | 1 |
| 403 verification_required then Enter | 2 | **2** (new key) | 1 |
| 422 VALIDATION_FAILED then Retry | 2 | **2** | 1 |
| 409 then Retry | 2 | **2** | 1 |
| 429 RATE_LIMITED then Retry | 2 | **2** | 1 |
| 429 DAILY_LIMIT_REACHED then Retry | 2 | **2** | 1 |

So: 5xx and a lost connection keep the key (one message stored); a 4xx makes the next try a new key. **A 429 makes a new key.** Is that right? Yes for this API: the rate limiter and the daily cap refuse before anything is stored, so a new key cannot duplicate a message. Keeping the key would also be safe (a server that stored nothing treats it as new), but only if the server never records a key against a 429; a new key is the cautious choice for a refusal. Agreed.

### N-M1 runs (200 messages, scroll to the top, tap "Show older messages", three times; first message below the button measured by its text)
| Width | Tap | First message below the button, top before | after | page scroll after |
|---|---|---|---|---|
| 390 | 1 | 206 px | 206 px | 2198 |
| 390 | 2 | 206 | 206 | 2160 |
| 390 | 3 | 206 | 206 | 2160 |
| 1440 | 1 | 329 | 329 | 1698 |
| 1440 | 2 | 329 | 329 | 1660 |
| 1440 | 3 | 329 | 329 | 1660 |
Bubbles went 20, 40, 60, 80 each time. The message stays exactly where it was; the person is moved down by the height added. Opening a 200-message chat lands at the bottom (scrollY 1665 = max at 390, 1260 = max at 1440).

## 3. What the builder says stays
- "Messages you already have stay." (Settings): **agree.** The closed chat stays in the inbox and readable (step 5), which is what the sentence says. I could not see the real API do it (Not proved).
- Nigeria pill and units pill on the 1440 board, and the board's broken logo image: **agree.** Not DM; the shell code for them is not in this diff against main (the diff touches only `AppShell`, `DeskSearch`, `Messages`, `nav`, `shell.css` for the Messages icon), and the board's logo `<img>` renders broken in the board's own picture.
- Hairline above the composer: **agree.** The board's own CSS has `box-shadow: 0 -1px 0 var(--line)` on that bar (read in `Conversation-390.dc.html`); the build draws the same line.
- "Tue" against the board's "Mon": **agree.** The label is computed from the message date (`when()`); my data happened to be a different weekday.

## 4. Board against built, element by element (390 and 1440, `board-vs-built-*.png`)

390 inbox: back, "Messages", search and plus, tab pill (All / "Unread 3", count 2+1 with the muted chat left out), edge-to-edge 76 px rows, mint unread rows, red count badges, avatars, mic and "Voice message · 0:09", "You: " prefix, handle, time, privacy line (two lines, centred), bottom nav with nothing highlighted: same. Differences: verified tick (owner's rule, not on the board); "Muted" with bell-off on a muted row (not on the board, held over from round 2); the board has a blank 20 px band above the top bar (a drawn status bar, not a screen element).

390 chat: back, avatar, name with tick, handle · place, ellipsis menu (Mute this chat, Report @handle, Block @handle in red), day divider, theirs left and surface, mine right and mint, time under each, voice player with 0:08 and "1x", transcript line, "Write a message" pill, round green mic, caption: same words, icons and order. Differences: composer to window-bottom gap 44 px against about 31 (L-D); the other person's voice bubble is white in the build as on the board; tick added.

1440 inbox: left rail, title "Messages" with outlined "New message", tab pill, search field, rounded list card with mint rows, centred one-line privacy text, Trending rail on the right (it appears when the trending call answers; my first run left it empty because my stub did not answer it, I fixed the stub and re-shot): same. Differences: the board's top bar carries a Nigeria pill and the side rail a units pill, absent in the build (shell, not DM, also absent on main); real logo instead of the board's broken image; tick and "Muted" additions; a spacing difference of a few pixels between the title row and the card.

1440 chat: "Back to messages" row, bordered header card with avatar, name, handle · place, ellipsis; "Today" divider; bubbles; composer in a white card with a mint field and caption; Trending rail: same. Differences: the header card scrolls away on a long chat (it is not sticky at 1440, so More is a scroll up from the bottom; the board's chat is short and does not show this) (L-E); tick.

Ranking of what still differs: all LOW (see L-A to L-F). Nothing changes layout, words or flow.

## 5. The closed chat as the API now sends it
Four stubs ("blocked me", "messages off", "suspended", "banned"), each answering `acceptsMessages: false` for the same conversation `c1` with readable history, as the builder's report says the API now does. In the browser at 390 and 1440, for each I took the whole page text, the list of controls and the page markup and compared checksums: **text, controls and markup are identical in all four** (390: text 892528ac, controls fe63337c, markup c2ba509e; 1440: text 99851e1b, same controls and markup). Words on screen: the history, then "This person is not taking messages." (role=status). Controls: back (two links, phone and desktop), "More: mute, report or block", play, speed. No composer, no "Say hello", nothing that names the reason. The inbox row (outerHTML length 1126) and `/messages/new/{id}` (redirects to `/messages/c1`) are identical too. `closed-chat-390.png`, `closed-chat-1440.png`.
Honest limit: the web branches on `acceptsMessages` only, so identical stubs give an identical screen by construction; what this proves is that the web adds no tell of its own. That the real API sends these four with identical fields is the API's own spec (builder's claim), which I did not run.
Person who blocked: with the stub answering an empty inbox the row is gone ("No messages yet") and a direct `/messages/c1` (404) shows "We could not find that." with Back and Home; after the stub unblocks, the row is back. This proves the web follows the API; the API hiding and restoring is Not proved here.

## 6. Flows by clicking (390 and 1440 both passed)
Inbox row opens `/messages/c1`, mark-read called once; "Unread 3" (2+1); send text (Idempotency-Key present, body `{toUserId, kind TEXT, body}`, bubble appears, focus back in the field, reload stays on the chat); voice with the fake microphone ("Recording 0:02 / 0:10", draft "Voice message 0:02", create clip, complete, send with kind VOICE and the clip id, player bubble appears); mute then unmute (label flips, stub state follows); report (dialog, Send disabled until a reason, body `{targetType DM_MESSAGE, targetId, reason}`, "Thanks. We got your report.", Done returns focus to the More button); block (`PUT /me/blocks/{id}` once, lands on `/messages`); New message "amaka" opens `/messages/new/u-amaka` with a composer; inbox search filters ("tunde" 1 row, "zzz" "No messages match"); profile More opens, "Message @kemi.b" goes to `/messages/new/u-kemi`, send lands on `/messages/c1`; own profile has 0 More buttons; guest sees "Sign in to read your messages." with no search or plus; Settings switch "Let people message me" sends `PATCH /me/settings {dmOpen:false}`.
Keyboard only, one pass at 1440 (no mouse): Tab to "Kemi Bello, 2 unread" row, Enter, chat opens; Tab to the field, type, Enter, sent (1 POST) and focus stays in the field; Shift+Tab back to More, Enter opens the menu with focus on the first item; Down, Down, Up moves; Enter on Report opens the dialog with focus inside; Tab to a reason, Space, Tab to Send report, Enter (1 report sent); Tab to Done, Enter closes the sheet and focus returns to More; Enter reopens the menu, Escape closes it with focus on More; Shift+Tab to "Back to messages", Enter, back on `/messages`. One gap: right after the report is sent, focus is on the page body until the next Tab (L-A).

## 7. Widths 1024, 1180, 1280 (inbox and chat)
Three columns hold (rail, list or thread, Trending). scrollWidth equals the window width every time; no element past either edge; no cut text without an ellipsis. `inbox-chats-w*-*.png`, `chat-w*-*.png`, `w1024-pair.png`. On a long chat the Trending rail scrolls with the page rather than staying in view (same as other pages; not DM).

## 8. Words
- No em-dash, en-dash or "Rant" in the page text, labels or placeholders of 20 states (inbox, chat, new message, Me, Settings, closed, priced and free captions, nine error banners), and none in `src/features/dm`, `src/app/messages`, `Messages.tsx`, `src/lib/api/dm.ts` (grep).
- Numbers come from the stub: voice seconds 10, 30 and 45 shown as set; "400 of 2,000 characters" with maxChars 2000.
- "Free" only where the stub's price is 0: text 0.5 and voice 2: "Text costs 0.5 tokens for every 150 characters. A voice message costs 2 tokens and can be up to 30 seconds." (no "free"); text 0 and voice 2: "Text messages are free. A voice message costs 2 tokens ..."; text 0.5 and voice 0: "... Voice messages are free and can be up to 30 seconds."; both 0: "Messages are free. Voice messages are up to 45 seconds."; typing 400 characters at 0.5 per 150: "400 of 2,000 characters. Costs 1.33 tokens."

## 9. Shared screens against origin/main (same stub, both built, 1x full page)
- Home: only the top-bar icon area differs (390: x 214-308, y 6-54; 1440: x 851-934, y 14-62), the new Messages icon.
- Person page: 390 identical; 1440 only the same icon area.
- Notifications (bell page), `/verify`, `/me`: 390 identical; 1440 only the icon area.
- Settings: 390 and 1440 are 77 px and 59 px taller, the added "Let people message me" row under "Ads and privacy" (`shared-settings-390-main-vs-dm.png`); nothing else moved.
- Caution: `/me` and Home render error or empty states with my stub, so those two prove the shell and chrome only, not content.

## New findings

### BLOCKER
None.
### HIGH
None.
### MEDIUM
None.
### LOW
- **L-C (N-L4, still open at 390).** With the 403 "Subscribe and get verified" banner showing, the sticky composer grows and covers the bottom 39 px of the newest bubble and its time; the page is at max scroll so it cannot be revealed until the banner clears. The scroll-into-view runs, but the page has no spare room under the message. `chat-403-unverified-390.png`. 1440 is fine.
- **L-A.** After "Send report" the sheet swaps to its "Thanks" view and focus falls to the page body (it lands on Done only after one Tab). The close return is correct.
- **L-B.** DAILY_LIMIT_REACHED ("Come back after midnight") and a 409 still show a Retry button that cannot succeed. Harmless.
- **L-D.** Gap under the composer caption 44 px at 390 against about 31 on the board.
- **L-E.** At 1440 the chat header with More is not sticky; on a long chat it is out of view at the bottom.
- **L-F.** After a failed send the 402 prompt "Get tokens" link goes to `/verify?from=/messages`, not a token page. Not rechecked against the plans; reported as I saw the link only in code (`PLANS_HREF`).

## Proved by runs
tsc, lint, whole vitest (90/923), `next build`; N-H1 (13 stub cases), N-M1 (3 taps at 2 widths), N-M2 measurements, N-L1, N-L2, N-L3, N-L4 (open at 390), N-L5, N-L6, N-L7, N-L8 in the browser; closed-chat identity across four stubs at two widths; the blocker-side stub; every click flow at 390 and 1440 including voice and profile; one keyboard pass; widths 1024, 1180, 1280; words in 20 states; shared screens against a main build; Settings dmOpen PATCH. Pictures I opened and looked at: chat 390, inbox 390 and 1440 side by side with the boards, chat 1440 side by side, chat 403 390, field and search focus rings, dark chat 390, profile (stub miss, fixed), 1024 pair, settings main-versus-build.

## Read only
`ConversationPage.tsx`, `InboxPage.tsx`, `dm-logic.ts`, `dm.css`, `DmRail.tsx`, `dm-voice.ts`; the board HTML (hairline rule); `git diff 5fb4a50..a023058`.

## Not proved
- The real API: whether blocked, messages-off, suspended and banned really arrive with identical fields; the blocker's chat really hidden and restored; a real idempotent replay after a 5xx; real 429 behaviour.
- Pictures I produced but did not open: dark inbox 390 and 1440, dark chat 1440, the 1180 and 1280 width pictures, the other closed and error pictures (their numbers above come from measurements).
- The 30 s unread poll; voice playback sound and the "1x" change; microphone permission denied; a real phone keyboard.
- Home feed content and the `/me` page content (stub gave empty states).
- Screen-reader output (roles, names and focus order were read from the page, not heard).
