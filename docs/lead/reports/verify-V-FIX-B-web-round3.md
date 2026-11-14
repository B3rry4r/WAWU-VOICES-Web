VERDICT: MERGE

# Verify V-FIX-B round 3 (web), code `v/fix-b` at 503c206 (my branch also holds reports and pictures)

`git merge origin/v/fix-b` into `verify/v-fix-b` was clean. Everything below ran against ONE `next build` served by `next start` (port 3100), the API stubbed in the browser from the contract, a fake microphone, Chromium at 390x844 and 1440x900, light and dark. A second build of origin/main (59a44d6) was served in a scratch worktree only to compare the record screen. No live service, no .env. The API repo is not in this checkout, so the server's real words, payloads and counting are not proved.

Why MERGE: all five round 2 findings that were open (A, B, C, D, E) and F are closed by runs; posting with no tag is one tap with the same requests as origin/main; the join flow carries the tag and the source into the POST body for every tag. Nothing HIGH or above is open. One MEDIUM (a 409 line can be off screen) and several LOW remain, listed below. The merge with `v/batch-1114c2` has one conflicting file (two hunks), listed under 8.

## Gates (exact)
- `npm run lint`: "No ESLint warnings or errors".
- `npm run typecheck`: exit 0, no output.
- `npx vitest run`, the whole suite, once: **92 test files passed, 910 tests passed, 0 failed.**
- `npm run build`: exit 0 (the build all runs used).

## Round 2 findings
| # | Finding | State | Proof |
|---|---|---|---|
| A | Song and recorder preview outside "one clip at a time" | **Closed** | 3 below: every reachable pair, both orders, 1 sounding clip at all times (sampled every 80 ms for 1.6 s after the second tap) |
| B | Branch conflicted with origin/main in SpeakScreen | **Closed** | Merge clean; record screen compared with main in 5 states (1 below) |
| C | Decided or vanished request stays, words unhelpful | **Closed, with new MEDIUM M1 (words can be off screen)** | 4 below |
| D | POLL_CLOSED with no `questionId` opens nothing | **Closed** | 5 below: opens `/weekly` |
| E | Advert link pauses whatever plays | **Closed** | 6 below |
| F | Malformed held draft tag gives "Application error" | **Closed** | 2 below: 6 malformed shapes, no error, page works, "Not news" shown |
| LOW 8 (editor sees Request chip briefly) and LOW 9 (boards) | Not retested, not in the delta | | |

## New findings

### BLOCKER
None.

### HIGH
None.

### MEDIUM
**M1. After an editor's Approve or Decline gets 409 or 404, the explaining line is above the visible part of the page.**
- Where: `src/features/admin/NewsPage.tsx:164-176` (`go`, `onGone` sets `saved` and calls `load()`); the line is drawn above the tabs (`NewsPage.tsx:~100`), the form it came from is far down the page.
- Did: editor at 1440x900, three requests in the queue, typed a reason, tapped Approve; stub answered 409 with no body, then the list (without the row) came back.
- Saw: the row left (3 rows to 2), the line text is in the page ("Someone else already decided this one."), but its box is at top -47 px with scroll 284 px: not in view. `admin-news-409-view-1440.png` shows the next row selected and an empty Reason box with no explanation. With a 500 the red line sits next to the buttons and is in view (`admin-news-approve-500-1440.png`).
- Should: scroll the line into view, or show it where the buttons are (as the 500 line is).

### LOW
- **L1. Two tabs can play together.** Tab A plays the override note, tab B plays the advert: both sound (`["id501.wav"]` in A, `["id602.wav"]` in B). The claim is per page (a module variable); nothing coordinates tabs.
- **L2. A notice for an answer with no `questionId` opens nothing**, for every type except TAG_FOLLOW (opens `/news/{id}`). In particular TAG_CHANGED (the likely "your request was approved" notice) with `targetType: "answer"` and no `questionId` stays on Notifications; with `questionId` it opens `/q/{Q}/a/{A}` (the thread, not the Newsroom post). `src/features/notifications/NotificationsPage.tsx:72-73`. The API's real shape is not in this checkout; the contract only says "questionId is the question to open when the target is an answer". MODERATION_NOTICE opens nothing by design (Appeal action); a null target opens nothing.
- **L3. No age limit on a held recording.** A draft 100 days old comes back with its tag (`src/features/speak/draft.ts` has no expiry; same as main). The brief mentions "older than its limit": there is no limit in code to test.
- **L4. An answer that is playing keeps playing while the reply recorder records** (390 sheet and 1440). Recording is not a clip, so "one clip at a time" holds; the microphone may hear it.
- **L5. Two tabs both signed in with `?autopost=1` each POST the answer** (same Idempotency-Key `k-...` on both, same body). The server is expected to de-duplicate by key; not proved. Same code path as main.

## Proved by runs
1. **B, main's record screen kept.** Signed in, five allowance states (first post, last free post, out of free posts, verified person (120 s limit), not enough tokens), 390 and 1440, idle and after recording, branch against origin/main's own build, page text compared line by line: idle screens identical in all 10; the preview differs only by the five tag-picker lines ("Is this news? Pick a tag so readers know." and the four chips). Nothing of main's lost, no extra duplicate lines (duplicate counts equal 1/1 at 390, 3/3 at 1440, same as main). Words seen: "This one is free, up to a minute." (first and last free post), "Up to 30 seconds is 78 tokens, longer is 100 tokens, charged when you send." and "Send for 78 tokens" (out of free posts, not enough tokens). `git diff origin/main HEAD -- src/features/speak` is tag and draft code only. Pictures: `speak-first-post-preview-390.png` (branch), `speak-main-first-post-preview-390.png` (main), `speak-out-of-free-preview-1440.png`.
2. **Join flow by the real pages** (guest records on `/q/{id}/speak`, taps Send, lands on `/join?next=...&held=1`, real welcome slides, real country step, real `/sign-in?mode=join`; only the email code is skipped by setting the session, then real `/join/topics`, `/join/profile`, tap "Finish and post my voice"). The tap sent the sequence `PUT /me/categories`, `PATCH /me/profile`, `POST /voice-clips`, `/complete`, one `POST /questions/{id}/answers`, and landed on `/q/{id}/posted?a=new1`:
   - no tag: `{"kind":"VOICE","clipId":"c1"}`.
   - Gossip: `{"kind":"VOICE","clipId":"c1","isNews":true,"newsTag":"GOSSIP"}`.
   - Unverified News: `...,"isNews":true,"newsTag":"UNVERIFIED_NEWS"}`.
   - Request Verified News with source NiMet and link: `...,"newsTag":"UNVERIFIED_NEWS","requestVerified":true,"newsSourceName":"NiMet","newsSourceUrl":"https://nimet.gov.ng/x"}`. Also run at 1440 dark: same body.
   - Closed tab: recorded, picked Request Verified News, typed source and link, tapped Send (went to join), closed the tab, opened a new tab on the speak page: recording back, "Request Verified News" pressed, source and link filled, 0 posts (`tab-return-request-390-dark.png`).
   - Held drafts seeded in IndexedDB: fresh with Gossip, 100 days old with Gossip, no tag field, tag `"junk"`, `{pick:7}`, unknown pick, `null`, `[]`: no error in any; the first two keep Gossip; the malformed and missing ones show "Not news". Request with empty source: pressed, Send disabled.
   - Two tabs: B sees A's draft with Gossip; B changes to Unverified News; A reloaded shows Unverified News.
   - Send disabled with Request and no source, with a source but a link without http, enabled with a good link.
   - Page: `join-request-5-profile-390.png` ("Finish and post my voice", "This is your 1st of 2 free posts"; the button is greyed until a name is typed).
3. **A, one clip at a time.** Real audio elements (every `play()`/`new Audio` tracked, `paused`/`ended` read), 25 s WAV. Each ordered pair, fresh page each: Home (override note, advert, song) 6/6 at 390 light and 6/6 at 1440 dark. Thread (answer, reply, song) 2/2 at 390 (no song button on that layout) and 6/6 at 1440. Record screen at 1440 (recorder preview, song) 2/2 (`clips-*` samples). Reply sheet: answer playing, open the sheet, record, play the sheet's preview: preview sounds and the answer stops, 390 and 1440 (`clips-reply-sheet-open-390.png`, `clips-reply-sheet-preview-1440.png`, `clips-thread-signed-1440.png`). At no sample were two elements sounding. Pairs not reachable on one screen: preview with override/advert (record screen has neither).
4. **C.** Editor at 1440, three asking rows; Approve and Decline, double-tapped (`dblclick`): exactly 1 decision request every time. 409 and 404 with the API's message: the API's words shown; without a message: "Someone else already decided this one." (409) and "This request is no longer there." (404); the row leaves in all eight cases (3 rows to 2, the stub's next list omits it). 500: row stays, "That did not go through. Try again." or the API's message. The words can be out of view: M1. Admin at 390 shows "Open the admin on a computer." (`admin-news-asking-before-390.png`).
5. **D.** Notifications stubbed with every type in the contract crossed with nine target shapes, tap each: POLL_CLOSED `poll` + `questionId` opens `/q/{Q}/results`; `poll` without it opens `/weekly`; TAG_FOLLOW `answer` opens `/news/{A}` (with or without `questionId`); TAG_CHANGED `answer` + `questionId` opens `/q/{Q}/a/{A}`; CATEGORY_ALERT/DAILY_QUESTION `question` open `/q/{Q}`; UNITS_ADDED/EXTRA_VOICE_ADDED `wallet` open `/units`; WEEKLY_REPORT `weekly_report` opens `/weekly/{R}`; FLASH_POLL opens `/`; VIDEO_READY `answer` + `questionId` opens the posted page. See L2 for what opens nothing. Page picture: `screen-notifications-390-dark.png`.
6. **E.** Home with a link on the audio advert, tap "Visit" (new tab opened every time, Home stays): override note playing stays playing; song playing stays playing; advert playing is paused; nothing playing: nothing else started except the guest's first-tap song (existing rule). 390 and 1440.
7. **Nothing else moved.** Signed in, no tag, one tap on Send: requests `POST /voice-clips`, `/complete`, `POST /questions/{id}/answers {"kind":"VOICE","clipId":"c1"}`, `POST /share/links`, on this branch and on origin/main's build: identical. Newsroom, news post, notifications, settings, Home, record page, `/admin/news`, `/admin/override`: no horizontal scroll at 390 or 1440 in light and dark (scrollWidth equals clientWidth everywhere). Rendered text and labels: no em-dash or en-dash, "rant" nowhere; no added line with either dash in `git diff origin/main HEAD -- src`; no "Rant" in `src`, `.next/static`, `.next/server/app`. Settings: "News tag alerts" shows true, one tap sends `{"notifyTagFollows":false}` and "Topic of the week" sends `{"notifyWeeklyTopic":false}` (`screen-settings-1440-light.png`). Admin gates by role across eleven pages for MEMBER, EDITOR, MODERATOR, AD_MANAGER, ADMIN and a guest: each role opens only what `PAGE_ROLES` lists; a blocked page shows "We could not find that" and makes no page-specific call (only the layout's `/admin/today`). Newsroom picture: `screen-newsroom-390-dark.png`; Home: `screen-home-390-dark.png`.
8. **Against v/batch-1114c2** (`git merge --no-commit origin/v/batch-1114c2` into a scratch worktree of this branch, aborted and removed): one conflict, `src/components/feed/HomeScreen.tsx`, two hunks. (a) near line 60, the loader's return: this branch returns `audioAd` and ends `}, [signedIn])`; batch-1114c2 drops `audioAd` and ends `}, [signedIn], (d) => soonest(questionStart(d.home.dailyQuestion), topicStart(d.home.topicOfWeek)))`. The merged result needs both. (b) near line 139: this branch draws the audio advert block (`{audioAd?.audioClipId ? <AudioAdCard .../> : null}`) at the end of the trending area, batch-1114c2 wraps the "new conversations" list in `{h.newConversations.length ? (`. Auto-merged without conflict: `contract/openapi.yaml`, `src/lib/api/types.ts` (generated: re-run `npm run api:types` after the merge to be safe).
9. **Existing assertions changed in cf2c175..503c206.** Against origin/main only these existing tests differ from main on this branch: `tests/wf-admin.test.tsx` (RW3: the old "News shows Flagged and All changes only" now expects the Asking tab, as in round 2) and `tests/listen-track.test.tsx` (mock gains no-op `claimPlayback`, `releasePlayback`, `stopPlayback`). In `tests/fixb-one-clip.test.tsx` the one removed line is `vi.mock("@/lib/theme-song", ...)`, because the song now takes part (the new rule; the file adds two tests). The other removed assertions in the `cf2c175..503c206` range (`w4-speak`, `w6-helpers`, `invite`, `lch-a-go`, wording tests) come from the merge of origin/main and are identical to main's own versions (`git diff origin/main 503c206 -- tests` shows only the files above plus new fixb files). `tests/fixb-r2-web.test.tsx` gains one test (POLL_CLOSED with no question opens `/weekly`).

## Read only
- `src/lib/theme-song.ts` (`onSongStart` hook), `playback.ts`, `NewsPage.tsx` `go`, `tag-choice.ts` (`validTag`), `draft.ts`, `SpeakScreen.tsx` delta against main.
- The generated `types.ts` and `contract/openapi.yaml` (the contract has no 409 on the decision route; 409 was stubbed anyway).

## Not proved
- Anything in the API: real notice shapes (L2), the words of 404/409, idempotency of a double autopost (L5), advert LISTEN counting, whether the API lists a decided request after a 409 (the web relies on the reloaded list to drop the row).
- Real sign-up and email code (skipped by setting the session), a real microphone and speaker, Safari/iOS, the real mp3 beyond Chromium playing it.
- Clip pairs not reachable by a person (see 3). The first-check LOW 8 and 9.
- The answer to "after the join, one tap" is proved with the profile step's button; the sign-in code step itself was not driven.

Pictures: `docs/lead/fix-b/shots-r3/` (18, all looked at; 390x844 at scale 2 and 1440x900 at scale 1; `advert-link-while-override-390.png` is the Home page after the tap, scrolled to the advert). My scripts stay uncommitted in the scratchpad.
