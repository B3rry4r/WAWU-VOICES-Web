VERDICT: FIX

# Verify V-SURVEYS web, second check

Code under test: `v/surveys` at b1330b6 (merged locally into `verify/v-surveys`; builder branch untouched). Everything ran against `next build` + `next start`, with the API stubbed (in the browser, and for the tab-close proof by a real local HTTP stub, because Playwright's request interception misses requests sent while a page closes). No live service, no `.env`.

The VIEW, START and consent/brand-select work, the three results stages and the role gates are closed or pass. Two new HIGH problems remain, both in the new "keep answers and count SKIP on leaving" work: a reload counts a SKIP (two reloads lock a person out of a survey they are answering), and the kept answers are not tied to the person (another person signing in on the same tab inherits them).

## Step 1: checks
- `npx tsc --noEmit`: exit 0.
- `next lint`: "No ESLint warnings or errors".
- `vitest run`: 90 files, 909 tests, 909 passed, 0 failed.
- `next build`: succeeded. All runs below used it.
- `git merge-tree origin/main HEAD`: the branch is based on 53e738b; `origin/main` is now 59a44d6 and **conflicts in `src/features/admin/roles.ts` and `src/features/speak/VoiceBox.tsx`** (see M3).

## First check's findings

| # | Finding | State | Proof |
|---|---|---|---|
| H1 | VIEW sent when card mounts | **Closed** | Card at top 1420 of 844 (390) / 1180 of 900 (1440): 0 VIEW after 2 s untouched; 40% visible: 0; ~70% visible: exactly 1; scroll away and back twice: still 1. To survey and Back: new Home visit, VIEW only once the card is scrolled to (2nd VIEW); reload and scroll: 3rd. So one per page visit where the card was seen; the server daily cap decides. No IntersectionObserver: none sent. `H1-FeedCard-seen-*.png` |
| H2 | START again on reload | **Closed, per tab** | Answer Q1, reload, leave to Home and reopen: one START. A second tab (new session storage) sends START again, and a new browser session does too: the flag is `sessionStorage`. The API's own rule (START once per person per survey, API report L1) covers that. |
| H3 | Reload loses answers; Back/close send no SKIP | **Partly closed; two new defects (N1, N2)** | Reload at Q1, Q2, Q3: position and answers kept. A voice clip kept once it has been sent with "Send answer" on its question (draft holds `clipId`). Back with answers: "Leave the survey?" on the page, no SKIP; Keep going stays; a second Back asks again; Leave: exactly one SKIP, Home, draft removed. Back with no answers: one SKIP, goes back. Tab close, page.close, navigate away, popup `window.close()`: one SKIP, with the bearer token, **arrived on the real HTTP stub** (4 of 4). After a finished survey: Back and close send nothing. After sending, storage holds only the started flag, no answers. `H3-back-asks-*.png`, `H3-reload-Q3-voice-*.png` |
| M1 | trusts `belowMinimum` | Closed (code + unit tests; not re-run in the browser) | `showsPeople` needs `responses >= minGroupSize` |
| M2 | no second scrub | Closed in part | Page and CSV scrub emails, links, @handles, long digit runs (run: `a@b.com`, `0803 123 4567`, `@handle` removed). Not caught: "insta: name", number words, bare domains. The server now handles those; the web is a second check only. The scrub also over-removes: `=HYPERLINK("http://x","y")` became `'=HYPERLINK(""[removed]`. Harmless. |
| M3 | no "Why am I seeing this?" on phone | **Closed** | Link under the grey box opens a sheet (`Survey-why-sheet-390.png`). Words are generic and true. |
| M4, M5 | no "Say why", no question on feed card | Open, still not built (listed below) | |
| L1 | choices not one tab stop | **Closed** | 390: tab goes Leave, Skip, one radio, Why link. Arrow Down moved the choice and focus; Tab goes to "Send answer". |
| L2 | no sidebar count | Open (needs an API field) | |
| L3 | counter wraps | Not re-checked in a picture (css line only) | |
| L4 | skip one question sends nothing | Kept by design | |
| L5 | "Approved" not live | Closed in code (pills), not opened in a picture | |
| L6 | hidden option blank in CSV | **Closed** | CSV row `I just bear it,hidden,,` |
| L7 | advert link same tab | Unchanged, existing AdSlot | |

## New findings

### BLOCKER
None.

### HIGH

**N1. A reload counts as a SKIP, so two reloads lock a person out of a survey they are answering.**
- Where: `SurveyScreen.tsx`, `pagehide` and `visibilitychange` call `sendSkip` (`skipSent` lives in the page, so every new page load can send one).
- Run (real local HTTP stub; stub applies the API's rule "skipped twice: 404", taken from the contract text): answer Q1, reload (events START, SKIP, page resumes at Q2), reload again (events START, SKIP, SKIP). The page then shows "This survey is not open. It may have ended, or it is not for your area." The kept answers are unreachable. `H3-two-reloads-locked-out-390.png`. A different run with four reloads/exits sent START plus four SKIPs.
- Also: `visibilitychange` to hidden sends SKIP when the person only switches app (proved by simulating the event; headless Chromium would not change real visibility). On a phone, answering a message mid survey and a browser that reloads the tab on return gives two SKIPs.
- Fix: SKIP only for a real leave (Back with no answers, Leave, link away, tab close with `pagehide` where `persisted` is false), not for reload or hidden; or keep the SKIP flag in `sessionStorage` per survey and send only once per survey per tab; or have the API count SKIP once per person per survey.

**N2. The kept answers are not tied to a person: another person signing in on the same tab inherits them.**
- Where: `logic.ts`, draft key `wawu.survey.<id>.draft` and started key have no user in them; `signOut()` clears the app's token store (its own `sessionStorage` module), not `window.sessionStorage`.
- Run: person A answers Q1 and Q2, goes to Q3. Settings, Sign out (draft still in storage). Person B signs in on the same tab and opens the survey: "Question 3 of 3", carrying A's two answers; B's send would post A's choices under B's account. If A had a recorded voice answer, B inherits A's clip id (server would refuse a clip that is not B's: an error at the end). The START flag is also shared, so B's START is never counted. `H3-other-person-inherits-answers-390.png`.
- Fix: key the draft and started flag by user id, and clear both on sign-out.

### MEDIUM

**N3. A voice answer recorded on the question being shown is lost on reload until "Send answer" is pressed.** On the last question (the usual place for a voice question) the recording is not in the draft (`draft` held only q1 and q2 while Q3 was recorded; after reload "Tap to record. You have 30 seconds." again). Only after "Send answer" on a middle voice question does the draft hold the `clipId` (run: kept, restored at the next question). The clip has been uploaded and is orphaned. Fix: save the clip id as soon as the recording is ready.

**N4. Leaving by a link away keeps the draft.** In-app link to Profile sends the SKIP but leaves `wawu.survey.s1.draft` (with the answers) in `sessionStorage` until the tab closes; coming back resumes it. Only "Leave" and sending clear it. The first of the two reads of "nothing stays after leaving" is met; this exit is not.

**N5. The branch conflicts with `origin/main`** (`roles.ts`, `VoiceBox.tsx`). Needs a merge by the lead before it ships; the shared-piece checks below were done on the branch, not on the merged result.

### LOW
- N6. Settings line "Lets a survey aimed at your state reach you. It stays off until you turn it on." says what the switch does but not that the brand still never sees the state. Fine as written, the owner may want the second sentence.
- N7. The web scrub cannot find names or addresses in plain words. The review screen says so in plain words. Not a defect.
- N8. Back to Home after a survey counts another VIEW when the card is seen again (one per visit). Builder said so; the API cap applies.
- N9. In my stub `/settings` threw `Cannot read properties of undefined (reading 'filter')` once when a list endpoint answered a shape the page did not expect (stub artefact, not shown to be an app bug; the page worked).

## Step 3: results page in its stages (clicking as AD_MANAGER and ADMIN, 1440)
- **Running** (`stage RUNNING`): page says "17 people have answered so far" and when the results are ready; no choice, share, percent or text anywhere in the page (searched); the only admin request is `/report`, whose body is the count only; `free-answers` is never asked; no CSV button. Same for AD_MANAGER and ADMIN. At 390: "Open the admin on a computer.", scrollWidth 390.
- **Review**: all three free answers and the transcript listed with "0 of 3 hidden"; Hide, Show, Hide = exactly three PATCH calls with `{hidden:true}`, `{hidden:false}`, `{hidden:true}`; count updates ("1 of 3 hidden"); Release opens a dialog ("Release the results?", says results are fixed, the email goes to the brand's contact, "1 written or voice answer stays hidden"); "Not yet" and Escape: 0 release calls, dialog closed; confirm with a double click: **1** release call, page moves to the released view. Server refusals shown in the server's own words ("Results were already released.", "These results were already released."). Free-answers load error: Try again and no Release button. Empty list: "There are no written or voice answers to read. You can release the results."
- **Released**: stored report, "Released on Wed 2 Dec, 10:00am. These results are fixed.", "Other 12 · 8%" line, hidden option "Fewer than 20 answers, not shown", state and age tables with Other row; below minimum: banner "Fewer than 20 answers so far" and only the three counts; the CSV built from that response only: header `Section,Question,Answer,Count,Share (%),Seconds`, no ids, no times, BOM, hidden choice as `hidden`, below minimum only the counts and note. Formula safety (run on the cell code): `=1+1`, `+1+1`, `-2+3`, tab+`=`, `=cmd|calc` get a leading apostrophe; `@SUM(A1)` is scrubbed; quotes and newlines quoted. A leading-space `  =1+1` is left alone (Excel does not read it as a formula). "No hidden answers in the CSV" holds because the web prints only what the server's released report sends; I did not test the server.
- States: report 500 and offline show Try again; 404 "We could not find that survey". Pictures `R-*`.
- **Roles** (`/me` delayed 700 ms; typed `/admin/ads`, `/admin/surveys`, `/admin/brands`, `/admin/surveys/s1/results`; page poll every 15 ms): member, MODERATOR, EDITOR: no Sponsored Surveys or Brand pages item; "We could not find that" on all four; none of the page's words (New survey, Results for the brand, Save as CSV, Release the results, free answer text) seen at any moment. AD_MANAGER: Today, Adverts, Sponsored Surveys, Brand pages; ADMIN: all items; both open the pages, page words only after the check. (The EDITOR body text I printed was cut off; the pass rests on the empty word list and nav.)

## Step 4: consent switch and brand select
- Settings (390 and 1440): "Use my state to choose surveys for me" sits first in "Ads and privacy", default off, turning it on sends `{"useMyStateForSurveys":true}` only; "Share my word" sends only `{"shareMyWord":true}`. A refused PATCH shows the error and the switch returns to off. Other switches unchanged.
- Adverts form: "Brand page (optional)" lists "No brand page" and the brands; new advert with none: no `brandId` key; with a brand: `brandId:"b1"`; edit shows the current brand selected; editing only the headline sends only the headline; choosing "No brand page" sends `{"brandId":null}`.

## Step 5: boards beside the build
I opened my 390 Survey, 390 Done, 390 Brand page and 1440 Brand page next to their boards (Survey-390 and BrandPage-390 boards opened). The 1440 Survey and Done boards were not re-opened this round; the first check's notes stand for them (the delta did not touch their layout).
- Survey 390: header, "Question N of 3", "About 1 min", progress, card, choices, Send answer, lock line, grey box with the green "Why am I seeing this?" link: as the board. Missing: "Say why".
- Done 390: tick circle with the two dots, "Thanks. Your answers are in.", reassurance line, white recap card, "Back to today's question", "Visit Zobo Fresh": as the board for a choice answer; no player.
- Brand page 390 and 1440: hero, "FROM ZOBO FRESH", ad card with "Why this ad?" (new), survey card, "Why brands are here": as the board apart from the list below. A lone ad is now full width (1440 picture).

## What the boards draw that is still not built
For each: nothing on screen is a dead control and no claim is false, except where noted.

| Board draws | Built instead | Dead control or false claim? |
|---|---|---|
| "Say why" voice button beside Send answer | nothing | No. |
| First question and choices on the feed card and brand-page survey card | title and "Start the survey" | No. The card is honest; it is a smaller card. |
| Voice player on Done (play, wave, 0:12, 1x) | text "Voice answer, 0:12" | No. |
| Past answers on Done after 409/reload/later | nothing (recap only straight after sending) | No. |
| Brand voice note on brand page | nothing | No. |
| Verified tick | nothing | No. |
| "More" menu and "Report this ad" | nothing | No (absent, not drawn). |
| Real "Why this ad?" / "Why am I seeing this?" copy | generic true copy in a sheet | No. Copy says "sometimes by state"; true. |
| "Rather not see ads?" card (Ad-free pass) | nothing | No. Owner to remove it from the board. |
| Badge word always "Sponsored" | the API's `label` | No. |
| Sidebar count of surveys to approve | none | No. |
| Brand-facing CSV route | admin only | No. |
What the API must give is as in the first check and the builder's list: first question and options on the card/brand cards; optional `clipId` on a choice answer; playback of the person's own survey clip; `myAnswers` (owner ruling needed); brand `voiceClip`; `verified`; report target for brand/survey; `why` line; a surveys count on `AdminToday`.

## Step 6: states, dark, scroll
Survey: loading skeleton, 404 "This survey is not open", 500 "This did not load" with Try again, offline "You are offline" with Try again; Brand page: empty ("has nothing live right now"), 404 "We could not find that brand", offline; dark Survey and Done at 390 (pictures `Survey-dark-390.png`, `SurveyDone-dark-390.png`, taken, not opened one by one). scrollWidth = 390 on `/surveys/s1`, `/brands/zobo-fresh`, `/` and the admin pages at 390. Keyboard: survey (above); review: Hide/Show buttons are labelled "Hide: <start of the answer>"; release dialog has `aria-modal`, label "Release the results?", focus lands on "Not yet", Tab cycles Close, Not yet, Release, Escape closes and focus returns to the Release button.

## Step 7: tests the builder changed
- `surveys-public` "counts one VIEW" was split into: mounts with no VIEW; 0.3 visible none; 0.6 then 1 gives one VIEW; no observer gives none. A real rule change, covers more than before.
- `surveys-public` afterEach now waits 5 ms and clears `sessionStorage`: needed because START flag and draft live in the tab now. Hides nothing.
- `surveys-logic` CSV: `"A fan, ""battery""",,,` became `...,hidden,,`: the L6 fix, matches the run.
- Fixtures gained `stage`, `ready`, `released`, `releasedAt`, `other: null`: the schema requires them. No other assertion weakened.
- The new tests (30) do not cover N1 (SKIP on reload) or N2 (other person), which is how both passed.

## Step 8: words and shared pieces
- Em or en dash in any string a person reads in the changed surveys, results, brands, feed-card, Settings and adverts files: none (scripted check on non-comment lines). "Rant": nowhere. No price, naira or token word in the survey, Done or brand screens (grep and the page text read). The admin form says "Price in naira" (admin only).
- Shared pieces: `HomeScreen.tsx`, `VoiceBox.tsx`, `SponsoredSurvey` were unchanged by round 2 except `vx/sponsored.tsx` (one-tab-stop radio group, optional behaviour). The first check had Home, Speak, thread and voice reply byte-identical to main; I did not rebuild main this round. Settings and adverts form: only the two additions, proved above.

## Proved by runs
tsc, lint, 909 tests, build; H1, H2, H3 runs with request lists; real-HTTP stub for tab close and for the two-reload lockout; stages, roles, CSV, Settings, adverts form, states, keyboard; pictures in `docs/lead/surveys/shots-r3/` (390x844 and 1440x900 light, scale 2; dark at 390).

## Read only
`SurveyFeedCard.tsx`, `SurveyScreen.tsx` delta, `logic.ts`, `SurveyResultsPage.tsx`, `survey-csv.ts`, the AdsPage and SettingsPage diffs, the test diffs, both builder reports, the API report's round 2 section.

## Not proved
- A real tab switch or phone app switch (headless Chromium does not change visibility); the `visibilitychange` SKIP was proved with a simulated event.
- The API's actual behaviour (two-skip rule, START/VIEW dedupe, hidden answers absent from the released report, scrub): I modelled the rule from the contract text.
- Pictures taken but not opened: most `R-*`, dark, state, Settings and AdsForm pictures; opened: Survey-q1-chosen-390, BrandPage-390 and -1440, SurveyDone-390 (and the Survey-390 and BrandPage-390 boards).
- Merge with the current `origin/main`; Home/Speak byte comparison against main this round; the invalid admin form paths; a real phone back gesture; a real screen reader; a spreadsheet opening the CSV.
