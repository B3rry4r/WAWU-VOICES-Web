VERDICT: FIX

# Verify V-SURVEYS, web screens

Code under test: `origin/v/surveys` at 36f9588. Verifier branch: `verify/v-surveys` (report and pictures only; the builder's branch is untouched). Everything ran against the built app (`next build`, `next start`) with the API stubbed in the browser. No live service was called. Scripts stayed uncommitted.

The Survey, SurveyDone and brand page work and the privacy promise holds in what I could see. Three things need fixing first: VIEW is counted before the card is seen, START is counted again on reload, and a person who leaves by Back or by closing the tab sends no SKIP. The boards also draw a good deal that is not built. That is listed in its own section for the API to close.

## Step 1: merge and checks

- `git merge origin/main` into a local scratch branch: "Already up to date". `origin/main` (53e738b) is an ancestor of `v/surveys`. No conflicts. Nothing was pushed from the scratch branch, which is now deleted.
- `npx tsc --noEmit`: exit 0.
- `next lint`: "No ESLint warnings or errors".
- `vitest run` (whole suite): 88 files, 877 tests, 877 passed, 0 failed.
- `next build`: succeeded. All runs below used this build.
- No failure on the branch, so there was nothing to compare with `origin/main`.

## Findings

### BLOCKER
None.

### HIGH

**H1. VIEW is counted when the card mounts, not when it is seen.**
- Where: `src/components/feed/SurveyFeedCard.tsx:14-19`, placed at the end of the feed in `HomeScreen.tsx` (`order-9`).
- What I did: signed in at 390x844, opened Home, waited 2 s, did not scroll, read the requests.
- What I saw: `VIEW` had been sent while the card sat at `top=1420px`, below the 844px screen. The person never saw it. The API's daily frequency cap counts views, so one look at the top of Home can use up the day's slot. The brand's "Seen" number is also too high.
- Should be: send VIEW when the card is actually on screen (IntersectionObserver, at least half visible), once per card per page visit.
- Related: opening Home again (Back from the survey) sent a second VIEW. That is one per visit, not "never twice". Decide the rule with the API (per day, or per visit) and keep one.

**H2. START is sent again after a reload.**
- Where: `SurveyScreen.tsx`, the `started` ref in `Ask`. It is lost on reload and on a second open.
- What I did: Home, Start the survey, answer Q1, press reload on the browser, read the requests.
- What I saw: `['VIEW','START','START']`. Opening the survey again after leaving also sends START again. The brand's "Started" is over-counted.
- Should be: one START per person per survey. Either the API ignores a repeat START (say so in the contract), or the web keeps a flag in `sessionStorage` per survey id. I did not see the API's behaviour, so the API must confirm.

**H3. Leaving by Back or by closing the tab sends no SKIP, and a reload throws away the answers with no warning.**
- Where: `Ask` in `SurveyScreen.tsx`. Only the on-screen Leave button and "skip every question" send SKIP.
- What I did, per case:
  - Reload at Q2 after answering Q1: the survey came back at "Question 1 of 3", the Q1 answer was lost, START was sent again.
  - Browser Back at Q2 with one answer given: went Home at once, no "Leave the survey?" box, no SKIP, no response.
  - Closed the tab at Q1: no SKIP.
- Result: answers are kept only in page state. Everything is lost on reload, Back or close. The API's two-skip limit and the brand's "Skipped" count never see these exits. Kept on reload: nothing. Lost: every answer and the position.
- Should be: use `pagehide`/`visibilitychange` with `navigator.sendBeacon` or `fetch keepalive` for SKIP, and a `beforeunload` or history guard when answers exist. Better: keep answers in `sessionStorage` per survey id so a reload resumes. Voice clips are already uploaded, so a clip id can be kept the same way.

### MEDIUM

**M1. The web trusts `belowMinimum` fully.** `SurveyResultsPage.tsx:90-130`. I fed a report with `belowMinimum:false` and 15 answers (`V-AdminResults-flag-false-but-15-1440.png`): the page showed every count, share, free answer and voice transcript. The API is meant to enforce the floor of 20, and its report returns nothing about people below it. Even so, a stale or wrong flag would put small-group data in front of an admin and into the CSV. Cheap fix: also hide the per-person sections when `totals.responses < minGroupSize`.

**M2. Free answers are shown and exported exactly as the API sends them.** I fed a phone number, an email and a handle (`V-AdminResults-above20-1440.png`). The admin saw all three, and the CSV had all three. The API report says it removes them by pattern; I did not test that API. If the pattern misses one, the web adds no second check. Name this as the API's duty. A web-side scrub of the same patterns would be a safe extra.

**M3. Phone Survey has no "Why am I seeing this?" link.** The board (`Survey-390.dc.html`) puts a bold green "Why am I seeing this?" link at the end of the grey paid-for box. The phone build drops it (`SurveyScreen.tsx:225-228`). On desktop the rail has the heading with copy, not a link, and the copy differs from the board (see the differences list).

**M4. The Survey screen has no "Say why" button** (board draws it under "Send answer" on a choice question). See the gaps section.

**M5. The feed card does not show the first question and choices.** The board's Home and brand page cards show the question and the four choices. The build shows only the survey title and a "Start the survey" button. See the gaps section.

### LOW

- **L1.** Choice buttons are `role=radio` buttons that are each a tab stop, and the arrow keys do not move the choice (checked: focus stayed on "1 to 6 hours" after ArrowDown). Space selects. A radio group should be one tab stop with arrows. The same component serves the existing polls, so this is not new, but it is on the survey now.
- **L2.** The admin sidebar shows no count for surveys awaiting approval (the Adverts item has one). The builder said the frame could not be edited; the list page header does say "1 awaiting approval".
- **L3.** Text question on a phone: the helper line and the "43 / 500" counter share a row and the counter wraps to two lines (`V-Survey-text-390.png`).
- **L4.** Skipping one question sends no event (builder's stated choice). Only skipping all, or leaving, sends SKIP. Fine if the API means it that way; confirm.
- **L5.** An approved survey that has not started shows "Approved" with no hint that it is not live yet (`V-AdminSurveys-list-1440.png`, Soon Co).
- **L6.** In the admin list a hidden option is an empty cell in the CSV (no word "hidden"). Harmless, but a reader of the CSV cannot tell hidden from zero. Count and share are blank for both.
- **L7.** Advert link on the brand page opens in the same tab with no `rel` (the Visit button uses `noopener noreferrer`). Existing AdSlot behaviour, noted only.

## Pictures (all under `docs/lead/surveys/shots/`, light theme, scale factor 2, prefix `V-`)

I opened and looked at these before writing: FeedCard-390, HomeFull-1440, Survey-single-390 and -1440, Survey-voice-recording-390, Survey-laststep-anonymous-390, Survey-text-390, Survey-error-390, Survey-dark-390, SurveyDone-390, -1440 and -dark-390, BrandPage-full-logo-390 and -1440, AdminSurveys-list-1440, AdminSurveys-refusal-1440, AdminSurveyForm-5q-1440, AdminBrands-form-logo-1440, AdminResults-above20-1440 and -below20-1440.

The rest were taken by the same runs and their text was checked in the run output, but I did not open each picture: Survey-voice-before/after, laststep-share, leave-with-answers, loading, offline, 404, guest, answer-refused, SurveyDone-409, BrandPage (nologo, nosurveys, noads, empty, loading, error, offline, 404), Home-no-survey, AdminSurveys-detail-s1..s7, AdminSurveyForm-1q, AdminBrands-list, AdminResults (error, offline, 404, flag-false), Admin-390, AdminNav, cmp/.
Covered: feed card; single choice, text, voice before, recording, after; Leave with answers; last step with share state and age band, and with "Answer without my name"; Done after answering and on 409; brand page with and without logo, website, surveys, adverts; loading, empty, error, offline for Survey, brand page and results; dark Survey and Done at 390; admin lists in six statuses; form with 1 and 5 questions; decisions; refusal; brands; results above and below 20.
Skip and Leave without answers show no picture of their own: Skip is a button, and Leave without answers goes Home with no box (behaviour proved, see below).

## Step 3: board against build, element by element

Boards read from the `.dc.html` markup and the PNGs. The logo picture is missing on the boards; ignored.

### Survey 390
- Header row (close, badge, Skip), "Question N of 3", "About 1 min", progress bar at 66%/(N/total): same as the board.
- Card (badge, "by Zobo Fresh", Bagel question, four options, "Send answer", lock line): same words and order. **Missing: the "Say why" button** beside "Send answer".
- Grey box: board "Zobo Fresh paid for this survey and WAWU approved it. Answering is free, optional, and never uses a free post." + bold green link "Why am I seeing this?". Built: same sentence, **link missing**.
- Bottom bar: the live tab bar replaces the board's; spacing differs by a few pixels (builder's note, agree).
- Not on any board and added: the "What the brand can see" box on the last step (share state, age band, "Answer without my name"). The board has no such block, so the API's need for consent controls was met by a new design. It is plain and fits the page. Flag for the owner.

### Survey 1440
- Board: no search bar, no country, no bell above the content; the units chip bottom-left. Built: the shell's search bar and bell sit above; a mute button sits bottom-left. Shell, as the builder said.
- Board: "Leave the survey" top-left, badge top-right, progress, card, then "Back" and "Skip this question" under the card. Built: same.
- Card: **no "Say why"**; the privacy line in the card wraps to two lines in the build (board: one line, because the card is wider by a few pixels).
- Rail: heading "ABOUT THIS SURVEY", avatar ZF, brand name, "See the brand page" link, three icon lines. Same words. "Why am I seeing this?" body: board "The brand asked to reach people who follow Power and light in Lagos. Nothing else about you was used." Built: "The brand chose who to ask by place and topic. Nothing else about you was used." Changed (generic).

### SurveyDone 390 and 1440
- Badge, tick circle with two dots, "Thanks. Your answers are in.", sub line, white recap list (390) or grey recap (1440), "Back to today's question", "Visit Zobo Fresh": same words and order; 390 close button same.
- **Changed: the voice answer.** Board draws a player (play button, wave, 0:12, 1x). Built draws the text "Voice answer, 0:02". See the gaps section.
- The recap exists only straight after sending. After a 409, after a reload on ANSWERED, or if the person comes back later, the recap is gone (the API returns no past answers); the board draws it.
- 1440: the card sits lower than the board's because the shell's search bar is above it.

### BrandPage 390
- Header "Back" + "Brand page": built. **Missing: the "More: why this ad, report this ad" button** at the right.
- Hero card: logo/initials, name, SPONSORED badge, tagline, "Visit Zobo Fresh": built. **Missing: the verified tick** next to the name, and **the voice note** ("A voice note from the brand · plays only when you tap" + player). Badge shows the API's `label`.
- "FROM ZOBO FRESH": ad card built; **missing "Why this ad?" link on the ad** (board draws it right of "Order now"; built hides it by `onWhy={false}`).
- Survey card: board shows the question and four choices with Send answer / Say why. **Changed:** built shows title and "Start the survey".
- "Why brands are here" card: heading and text same. **Missing: "Report this ad"** link with flag icon.

### BrandPage 1440
- Hero: board has SPONSORED badge on top, name with tick, tagline, Visit button at right, voice note across the bottom. Built: badge, name, tagline, Visit; no tick, no voice note.
- Ads: board shows two ads side by side (one with an audio player, "Visit page"). Built: grid of two columns; a single ad takes half the width.
- Survey card: board full width with choices. Built: title and button.
- Rail: board has two cards: "Why brands are here" with "Report this ad", and **"Rather not see ads?"** (An Ad-free pass hides sponsored cards and banners for 7 days. Find it in Settings.). Built: only the first, no link; the second is missing.
- Top bar: board shows search, "Nigeria" and a bell; built shows search, "Nigeria" and "Sign in" for a guest. Shell.

### The builder's own list, one by one
| Item | Board draws | Built | State |
|---|---|---|---|
| "Say why" | Secondary mic button "Say why" beside "Send answer" on a choice question (390, 1440, and the brand-page card) | Not drawn. A voice question is its own question. | Missing |
| Voice recap on Done | VoicePlayer: play, wave, "0:12", "1x" | Text line "Voice answer, 0:02" | Replaced |
| Brand's voice note | "A voice note from the brand · plays only when you tap" and a player | Nothing | Missing |
| The tick | `badge-check` icon, label "Verified brand", next to the name | Nothing | Missing |
| The More menu | IconButton `ellipsis`, "More: why this ad, report this ad" (390) | Nothing | Missing |
| "Report this ad" | Flag link in "Why brands are here" | Nothing | Missing |
| "Rather not see ads?" card | Rail card with the Ad-free pass words | Nothing | Missing |
| "Why am I seeing this?" | 390: bold green link; 1440: rail heading with targeted copy | 390: nothing. 1440: heading and generic copy, not a link | Missing (390), changed (1440) |
| Feed card's first question and choices | Four choices, "Send answer", "Say why", lock line | Title and "Start the survey" | Replaced |

## What the boards draw that is not built, and what the API must give

1. **First question and choices on the feed card and the brand page's survey card.** Board: the card is a live first question. Built: title and button. API: `GET /surveys/placement` and the brand page's survey cards must carry the first question's `prompt` and its `options` (id and label), and the kind. Then answering the first question from the card (and the `Survey` screen starting on question 2) is a web step.
2. **"Say why".** Board: a voice note that goes with a choice. Built: none. API: an optional `clipId` on a choice answer (`SurveyAnswerInput` with both `optionId` and `clipId`), with the same checks (own clip, `SURVEY_ANSWER`, READY, survey maximum length), and a result for the brand (transcript beside the choice). Or the owner says a voice question stands in for it.
3. **Voice recap player on Done.** Board: a player. Built: text. API: a playable address for the person's own clip right after sending (`/voice-clips/{id}/play` exists for other clips; the Done screen needs it to be allowed for a `SURVEY_ANSWER` clip owned by the person), and the clip's wave data. Without it the web cannot play it back.
4. **Past answers on Done.** Board: the recap with the person's answers. After a 409 or later visit nothing is shown. API: `GET /surveys/{id}` with `myStatus: ANSWERED` could return `myAnswers` (labels, text, clip id) for that person only. This conflicts with the promise that the response row holds no person id; the API holds `respondentKey`, which can match, but answers are linked to it. API owner to decide whether keeping this is allowed.
5. **The brand's voice note.** Board: "A voice note from the brand" with a player. API: a `voiceClip` (URL, seconds, wave) on `GET /brands/{slug}`, uploaded by the admin on the brand form, with the admin form and the storage rules to match.
6. **The verified tick.** Board: `badge-check` "Verified brand". API: a `verified` boolean on `BrandPage` and on the admin brand form. The web draws it.
7. **The More menu and "Report this ad".** Board: report this ad from the brand page. API: a report target for a brand or a survey (the API report says the report flow has none). Needs a target type and a reason list the web can send to.
8. **"Why this ad?" on the brand page's ad card and "Why am I seeing this?" with real copy.** Board: a link, and on 1440 a sentence naming the place and topic. API: a `why` line per placement and per survey (for example "You are in Lagos. You asked about power and light.") that says only what was used. Without it the web can only show generic copy.
9. **"Rather not see ads?" card.** Board: the Ad-free pass words. API/owner: whether the pass exists at launch (the builder says it is not in launch). If not, the owner should remove the card from the board, not leave a missing element.
10. **Brand badge word.** Board always says "Sponsored". Built shows the API's `label` (for a brand: "Sponsored" in my stub, "Brand" in the admin list). API: say which word the brand page returns.
11. **Surveys awaiting approval on Today.** The admin sidebar count needs a field on `AdminToday` (for example `needsAttention.surveys`).
12. **Start and view rules.** The API must say whether a repeat START or VIEW from the same person for the same survey is ignored (see H1, H2). If not, the web must stop sending them.

## Step 4: behaviour, by clicking and watching requests

Each line was run at 390 and, where noted, at 1440.

- **VIEW once when the card shows:** one VIEW per Home visit, sent before the card is on screen (H1). Not twice in one visit.
- **One START:** one START per open. Reload sends a second (H2).
- **SKIP:** Skip x3 (all questions skipped) sent one SKIP, no answer, went Home. Leave with no answers: START, SKIP, Home, no box. Leave with answers: box "Leave the survey?" ("Your answers so far have not been sent. They are lost if you leave." Keep going / Leave); Leave sent SKIP, no answer. Back and closing the tab: nothing (H3).
- **Answer body:** choice, choice, voice gave `{"answers":[{"questionId":"q1","optionId":"h1"},{"questionId":"q2","optionId":"o2"},{"questionId":"q3","clipId":"c1"}], ...}` exactly the chosen ones, one POST.
- **Answer without my name:** I switched on share state, picked 25-34, then switched on "Answer without my name". The body was `...,"anonymous":true` with no `shareState` and no `ageBand`. The switch also greys and clears the two other controls and says "Nothing about you is kept with this answer." Without it, the state and age band go as chosen (the earlier run sent `shareState:true`).
- **Second answer:** a stub 409 shows Done. The text "You already answered this survey." is not shown. The recap is empty then (no answers to show).
- **ANSWERED on open:** Done, no questions.
- **Guest:** no placement call is made, no card drawn (390 and 1440). `/surveys/s1` shows "Sign in to answer".
- **Placement null, 500 and offline:** no card, no wrapper, no space (no `.order-9` element; page height identical to the no-survey page: 1508 at 390, 1212 at 1440).
- **Voice answer length and purpose:** with the survey's `voiceMaxSeconds` at 30 the timer showed 0:30 and "It stops by itself at 30"; with 20 it showed 0:20 and "You have 20 seconds". The clip request was `{"purpose":"SURVEY_ANSWER","mime":"audio/webm",...}`.
- **Words:** no screen I opened mentions tokens, a price or a naira amount to a member. "never uses a free post" is on the page, from the board's own words. The admin form says "Price in naira" (admin only).
- **A stub 422 on send:** "Your answers were not sent" and the API's own sentence; the person stays on the last question with answers kept. Fine.
- **Load states:** Survey loading skeleton, 500 ("This did not load", with the API's message shown as given), offline ("You are offline"), 404 ("This survey is not open"): all as designed.
- **Reload half way:** see H3. **Back, phone back gesture, closing the tab:** see H3. (I could not do a real phone gesture; browser Back is the same call.)

## Step 5: results page and CSV

- Above 20 (stub): totals, per choice count and share, free answers, voice transcripts, by state, by age band. The CSV has columns Section, Question, Answer, Count, Share (%), Seconds; **no id, no time, no handle**; byte-order mark at the start, CRLF line ends; filename `survey-results-zobo-fresh-power-and-light.csv` (builder's run) and the same pattern for mine.
- Below 20 (`belowMinimum:true`): only Seen, Started, Skipped, the notice "Fewer than 20 answers so far", and the API's note. The CSV: the same three counts and the note, nothing else. Pass.
- Formula safety: a free answer or label starting with `=`, `+`, `-`, `@`, tab got a leading apostrophe in the CSV (`'=HYPERLINK(...)`, `'+1+1`, `'-2+3`, `'@SUM(A1)`, `'<tab>=1+1`, `'=Sleep outside`, `'=cmd|calc`). Quotes and a new line inside a cell are quoted correctly. Pass. The apostrophe shows in the cell; that is the usual trade.
- Phone, email, handle in a free answer: the admin sees them and the CSV has them (M2).
- Numbers: the web prints what the API sends; it does no sums. In the stub, shares 26+46+20 = 92 and the fourth option is hidden, so shares cannot add to 100 by design. The page says "Fewer than 20 answers, not shown" for it. Not a defect.
- Load states: 500 ("boom" as given, Try again), offline ("VOICES could not be reached..."), 404 ("We could not find that survey").

## Step 6: roles in the browser

I ran each role with `/me` delayed 700 ms, opened `/admin/ads`, then typed `/admin/surveys`, `/admin/brands` and `/admin/surveys/s1/results`. A poll every 15 ms looked for the page's own words (New survey, Approval checks, New brand, Save as CSV) from the first paint.

| Role | Nav items | The three new pages typed in | Flash of content |
|---|---|---|---|
| Member (no role) | none | "We could not find that" on all three | none |
| MODERATOR | Today, Moderation | not found | none |
| EDITOR | Today, Override the day, Topic calendar, Question pool, News tags, Posted results, Weekly report | not found | none |
| AD_MANAGER | Today, Adverts, Sponsored Surveys, Brand pages | open | page words only after the check |
| ADMIN | all 11 | open | page words only after the check |

Pass.
- **Admin at 390:** `/admin/surveys`, `/admin/brands`, `/admin/surveys/s1/results` and `/admin/ads` all show "Open the admin on a computer." No sideways scroll (scrollWidth 390).
- **Nav at 1366x768 and 1280x720 (ADMIN):** 11 items (Today, Override the day, Topic calendar, Question pool, News tags, Posted results, Adverts, Sponsored Surveys, Brand pages, Weekly report, Moderation). Last item ends at y=652; the person block starts at y=712 (1366x768) and y=701 (1280x720). All can be seen, none overlap, no inner scroll needed.
- **Decisions:** the stub received `{"decision":"APPROVE"}`, `{"decision":"ASK_FOR_CHANGES","reason":"..."}`, `{"decision":"REJECT","reason":"..."}`, `{"decision":"RESUME"}`; "Ask for changes" and "Reject" stay disabled until a note is typed. A stub 422 "Approval is refused: a price is needed." was shown in the API's own words in a red bar. Pause was not clicked (the picture list has a paused row and the button exists in the code, line 252); see "Not proved".
- **Form:** 1 question by default; "Add a question" is gone at 5 ("Questions (5 of 5)"); six choices is the most ("Six choices is the most."). A stub create returned fine; I did not post an invalid form.
- **Brands:** list, edit, logo chosen: `POST /uploads {"kind":"AD_CREATIVE","mime":"image/png","sizeBytes":70}`, then `/uploads/f1/complete`, then `PATCH /admin/brands/b1 {"logoFileId":"f1"}`. Pass.

## Step 7: words, scroll, keyboard

- Em-dash and en-dash: none in any changed or new file under `src/` (grep). None in the page text I read. Not checked in `contract/openapi.yaml`.
- "Rant": nowhere in the changed files.
- Plain short sentences: yes in the screens I read. The one long line is "Brands pay for labelled spots, approved by WAWU before they run. They never change rankings or poll results, and never see who you are." That is the board's own text.
- No sideways scroll at 390: feed, survey, brand page, admin pages all `scrollWidth` 390.
- Keyboard, Survey at 1440: Leave the survey, three choices, Skip this question, See the brand page, then the page's shell. Survey at 390: Leave the survey, Skip, choices. "Send answer" is disabled until a choice, so it is not a stop (and a disabled button is right). Choices are separate stops (L1). Every input on the admin form has a label (zero without). The form's tab order follows the page: brand page, email, title, kind, question, choices, Add a choice, Add a question, states, cap, dates, price, target. Labels found: all fields. The focus ring was not measured (my check was crude and unreliable; see "Not proved").

## Step 8: shared pieces, branch against `origin/main`

I built `origin/main` in a second work tree on a second port and ran both with the same stub (survey placement null, so the branch Home draws no card).

- Home (390 and 1440), Speak (`/speak`), `/q/q1/speak`, the thread page `/q/q1/a/a1`: screenshots **byte-identical** (same md5) on both builds, at both sizes.
- Adverts admin (`/admin/ads`, AD_MANAGER, 1440): the content area (x from 340) is byte-identical. The only difference on the page is the two new sidebar items, as intended. (An earlier whole-page compare used a stub that crashed the page on both builds, so I ignore it.)
- Voice reply (open the thread, "Reply by voice", pick "I agree", record 1 s, Send): identical words on both ("Tap to record. You have 60 seconds.", "Listen back. Nothing posts until you tap Send.", "Send"), identical requests on both: `POST /voice-clips` purpose `REPLY`, `/complete`, `POST /answers/a1/replies` kind `VOICE`. Pictures in `shots/cmp/`.
- `speak.ts`, `VoiceBox.tsx`, `vx/sponsored.tsx`, `nav.ts`, `roles.ts`, `HomeScreen.tsx`: diffs read; changes are additive optional props, two nav prefixes, two roles entries and one placement call. The existing 877 tests pass unchanged.
- `HomeScreen.tsx` change: a signed-in Home now calls `/surveys/placement` on every load (one extra call). Home is identical in the picture when the answer is null.

## Proved by runs
- Merge, tsc, lint, 877 tests, build (counts above).
- Every behaviour in steps 4, 5, 6, 8 above, with the request lists.
- Pictures listed above.

## Read only
- `SurveyScreen.tsx`, `BrandPageScreen.tsx`, `SurveyFeedCard.tsx`, `logic.ts`, `survey-csv.ts`, `SurveyResultsPage.tsx`, parts of `SurveysPage.tsx` and `BrandsPage.tsx`, `admin-surveys.ts`, `surveys.ts`, the diffs of the shared files, both builder reports, the board markup.
- The Pause button in the admin (code at `SurveysPage.tsx:252`).
- Whether the API ignores a repeat START or VIEW; whether its report scrubs contact details. I did not read or run the API.

## Not proved
- Pause, and the "Changes asked" and "Rejected" paths on a draft, were not clicked through to their API call; Resume, Approve (refused), Ask for changes and Reject were.
- Pictures I listed as taken but not opened (see the Pictures section).
- Real phone Back gesture, a real mobile keyboard, a real screen reader, a real spreadsheet opening the CSV.
- The brand page with a real logo file (I used an inline SVG as the logo URL).
- The admin form with an invalid entry (API refusals for 0 or 6 questions, bad dates); not clicked.
- The loading state for the Home feed card and the admin pages (no skeleton picture taken for the feed card, which has none by design).
- Anything against the real API.
