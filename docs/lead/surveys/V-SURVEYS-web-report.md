# V-SURVEYS web report

Branch `v/surveys`. Built against the API report and the contract reference only; no live service was called.

## What is built

1. **Contract and types.** The 12 survey and brand paths and 29 schemas were copied from the reference into `contract/openapi.yaml` (patience diff: 1,342 added lines, none removed). `npm run api:types` regenerated `src/lib/api/types.ts` (additions only). Nothing else in the contract changed.
2. **API calls.** `src/lib/api/surveys.ts` (placement, get survey, events, answer, brand page) and `src/lib/api/admin-surveys.ts` (surveys, decision, report, brands, logo upload). No fetch in a component. `createVoiceClip` accepts the purpose `SURVEY_ANSWER` (the reference has it; this contract's enum does not, so the type is widened in `speak.ts`).
3. **Admin.** `SurveysPage.tsx` (list with status; create and edit with 1 to 5 questions, 2 to 6 choices, categories, states, dates, cap, price, target, brand; send for approval, approve, ask for changes, reject with a note, pause, resume; the API's refusal words are shown as given). `BrandsPage.tsx` (list, create, edit, logo upload with kind `AD_CREATIVE`). Both are in the admin nav right after Adverts ("Sponsored Surveys", "Brand pages"), roles AD_MANAGER and ADMIN. `AdminFrame.tsx` was not touched; `roles.ts` got added lines plus two ids added to the one-line `AdminPageId` union.
4. **Results page** `/admin/surveys/[id]/results`: totals, counts and shares per choice, free answers, transcripts, by state, by age band, `belowMinimum` state, "hidden" options, and "Save as CSV" built from the same response (no ids, no times; formula-safe cells).
5. **Public.** Home feed card (`SurveyFeedCard`, `SponsoredSurvey` got new props, none copied); Survey screen `/surveys/[id]` (one question at a time; choice, text, voice via the existing `VoiceBox` with the survey's `voiceMaxSeconds`; Skip; Leave the survey with a confirm when answers exist; the privacy line; share state, age band and "Answer without my name" on the last step); Done screen (also for a 409 and for `ANSWERED`); brand page `/brands/[slug]`. Events: VIEW once when the card shows, START once when the survey opens, SKIP when the person leaves or skips every question.
6. **Tests and pictures.** See below.

## Files
New: `src/lib/api/{surveys,admin-surveys}.ts`, `src/features/surveys/{SurveyScreen,BrandPageScreen}.tsx`, `src/features/surveys/logic.ts`, `src/components/feed/SurveyFeedCard.tsx`, `src/features/admin/{SurveysPage,BrandsPage,SurveyResultsPage}.tsx`, `src/features/admin/survey-csv.ts`, routes under `src/app/{surveys,brands,admin/surveys,admin/brands}`, `tests/surveys-{logic,public,admin}.test.ts(x)`, `e2e/surveys.e2e.mts`, `docs/lead/surveys/shots/*.png`.
Changed (small): `contract/openapi.yaml`, `types.ts`, `HomeScreen.tsx` (added lines), `nav.ts` (two active-tab lines), `roles.ts`, `vx/sponsored.tsx` (new optional props), `VoiceBox.tsx` (purpose value and two optional text props), `speak.ts`.

## Checks
- `npx tsc --noEmit`: exit 0. `next lint`: no warnings or errors.
- New vitest: 9 (logic) + 21 (public) + 16 (admin) = 46 pass. Whole suite once: 88 files, 877 tests, all pass.
- One existing test (`wf-admin` "the empty state does not mention brands") failed with a nav label "Brands"; I renamed the nav label to "Brand pages" instead of touching the test. No existing test was edited.
- `next build`: succeeded (before the last label rename; the rename is one string).
- Playwright (`e2e/surveys.e2e.mts`, built app, API stubbed, fake microphone): ALL OK, at 390x844 and 1440x900: feed card + one VIEW; null and failed placement draw nothing; full survey with a real recording (clip purpose `SURVEY_ANSWER`), answers body, START only, Done; 409 shows Done; Skip and Leave send SKIP; offline load; brand page and 404; admin list, refusal words, form, nav order; results, CSV download with no id, below-minimum; brands.
- Pictures in `docs/lead/surveys/shots/` (deviceScaleFactor 2): FeedCard, Survey, SurveyVoice, SurveyShare, SurveyDone, SurveyOffline, BrandPage at 390 and 1440; AdminSurveys, AdminSurveysRefused, AdminSurveyForm, AdminResults, AdminResultsBelowMinimum, AdminBrands at 1440. I compared Survey, SurveyDone and BrandPage at both sizes with the boards.

## Differences from the boards I did not close
- **"Say why"** is not drawn: the API has no voice attached to a choice. A voice question is its own question.
- **Voice recap on Done** shows "Voice answer, 0:12" as text, not a player: the API gives no playback address for the person's clip, and a fake player would do nothing.
- **Brand page**: no voice note (no audio on the brand), no verified tick (nothing says verified), no "More" menu, no "Report this ad" (no report target for it), no "Rather not see ads?" card (the ad-free pass is not in launch). Brand badge shows the API's `label`, not always "Sponsored".
- **"Why am I seeing this?"** is plain copy in the desktop rail, not a link; its text is generic ("by place and topic"), since the API does not say what was targeted.
- **Phone Survey** has no Back button (board has none); desktop has Back.
- **Shell chrome**: the desktop pages show the app's search bar, country or Sign in and bell above the content, which the Survey boards do not draw; the units chip in the side nav is not shown. Both belong to the existing shell.
- **Feed card** shows the survey title and a "Start the survey" button, not the first question and choices: placement carries only the title.
- Phone Done and Survey pictures show the live tab bar; the board's bottom bar spacing differs by a few pixels.

## Choices where the sources were silent
- Button wording "Send answer" on every question (board wording), though only the last one sends; answers are held on the page until then.
- SKIP event: sent when the person leaves, or skips every question (nothing is sent then). Skipping one question sends no event.
- Sharing choices on the last step: "Answer without my name" switches on `anonymous` (and disables state and age band); otherwise `shareState` and `ageBand` only when chosen.
- Done: "Visit" goes to `brandWebsite`, else the brand page. "Back to today's question" goes Home.
- About "1 min": counted as ceil(questions / 3), at least 1.
- Admin price is entered in naira and sent as kobo; empty means the API's price list. Edits send only changed fields.
- Brand logo upload: the adverts form here has no logo upload, so `uploadBrandLogo` follows the avatar and result-photo upload pattern.
- Report `share` values are shown as percent.

## Not done
- Survey target in a "report this" flow; brand voice note; an audio player for the person's own answer on Done.
- Sidebar count for surveys awaiting approval (needs a field on Today; I may not edit the frame).
- Nothing was run against the real API.

# Round 2

Branch `v/surveys`. API stubbed everywhere; no live service called. Pictures: `docs/lead/surveys/shots-r2/` (public screens at 390 and 1440, admin at 1440). I opened Survey-390, BrandPage-1440, AdminResultsReview, AdminReleaseConfirm, SettingsSurveySwitch and AdminAdsBrandSelect and compared the first two with their boards. The rest were taken by the same run and asserted in it, but not opened one by one.

## Items

1. **Contract and types.** The survey and brand paths (release, free-answers, free-answers/{id}, report, brands 409, `/surveys/{id}`, `/brands/{slug}`) and schemas (Survey*, Brand*, AdminSurvey, AdminAd and UpsertAdRequest with `brandId`, HideFreeAnswer*, SurveyFreeAnswers/Item, SurveyReleaseResult) were set to the new reference in `contract/openapi.yaml`. Also `useMyStateForSurveys` in Settings, UpdateSettingsRequest and the `/me/settings` text. Nothing else from the reference (verification, money, subscriptions, `notifyWeeklyTopic`) was taken. `npm run api:types` run.
2. **H1** VIEW on sight: `SurveyFeedCard.tsx` IntersectionObserver, at least half visible, once per card per page visit. Where the browser has no observer, nothing is counted. Home again (Back) is a new visit and counts one more VIEW; the server's daily cap decides.
3. **H2** START once: `logic.ts` (`wasStarted`, `markStarted`, key `wawu.survey.<id>.started`, try/catch), used in `SurveyScreen.tsx`.
4. **H3** `SurveyScreen.tsx`/`logic.ts`: draft per survey id in `sessionStorage` (position, answers with voice clip ids, sharing choices), validated against the survey on load, cleared on send, 409 and leave. Back with answers: an extra history entry is kept on top, a Back press lands on it and the page shows its own "Leave the survey?" box. Back without answers sends SKIP and goes back. `pagehide`, `visibilitychange` (hidden) and unmount send SKIP once through `recordSurveyEvent(..., {keepalive: true})` (fetch, since a beacon cannot carry the sign-in header). A finished person sends none.
5. **MEDIUM and LOW:**
   - M1: `showsPeople` (`survey-csv.ts`) hides choices, free answers and breakdowns when responses are under the floor whatever `belowMinimum` says, in the page and the CSV.
   - M2: `scrub` (emails, links, @handles, long digit runs) is a second check on released free answers and transcripts, page and CSV. A name in plain words cannot be found; the review screen tells the reader to read each one.
   - M3: phone "Why am I seeing this?" link opens a sheet. Its words are true of every survey (topic, sometimes state, state only if the Settings switch is on); the rail copy on desktop uses the same words.
   - M4, M5: not built (see below).
   - L1: `vx/sponsored.tsx` choices are one tab stop, arrows move and select (shared component, optional behaviour, no copy).
   - L2: sidebar count not built (API must give it, below).
   - L3: `vx.css` counter in the field hint no longer wraps.
   - L4: skipping one question still sends nothing. The API report says only leaving counts, so this is kept.
   - L5: `SurveysPage.tsx` pills: "Approved, starts 20 Nov", "Over, results to review", "Results released"; no Edit or Pause once results are fixed (server answers 409).
   - L6: CSV writes `hidden` in Count for a hidden choice and a separate "Other" line.
   - L7: advert link on the brand page: existing AdSlot, unchanged.
   - Brand page: a lone advert now takes the full width; "Why this ad?" is drawn and opens a sheet with what is true (paid, approved by WAWU, no effect on rankings, brand never sees who you are).
6. **Results page** `SurveyResultsPage.tsx`, `admin-surveys.ts` (free-answers, hide, release). Running or not live: only "N people have answered so far" and when the results are ready (end date and target as given). Review: every answer as the server gives it, Hide or Show (one PATCH each), "N of M hidden", "Release the results" with a Dialog that says the results are fixed and the "results ready" email goes to the brand's contact; refusals show the server's own words. Released: stored report, Other lines, state and age Other rows, released time, "not enough answers" as reported, "Save as CSV" from that response only.
7. **Consent and brand select.** `SettingsPage.tsx` switch "Use my state to choose surveys for me" with one line (default off, PATCH `useMyStateForSurveys`). `AdsPage.tsx` "Brand page (optional)" select from the brands list; a new advert sends `brandId` only when chosen, an edit sends only a changed `brandId` (null clears).
8. **Boards compared** at 390 and 1440 on the build. Closed: Why link, desktop rail copy, single-ad width, counter wrap. What remains differs only by the items below and by the shell (search bar, bell and the side-nav units chip above the Survey boards, bottom bar spacing).

## Tests
- Added: `tests/surveys-round2-public.test.tsx` (12), `tests/surveys-round2-admin.test.tsx` (18). E2E `e2e/surveys.e2e.mts` extended (H1, reload, Back asks, Back and tab close send one SKIP, admin stages, brand select, Settings switch); all OK against the build.
- Changed (a rule changed):
  - `surveys-public` feed card "counts one VIEW": was `rerender` then `["VIEW"]`; now no VIEW at mount, one after the observer reports at least 0.5, none without an observer.
  - `surveys-public` afterEach: also waits for the page's unmount SKIP and clears `sessionStorage` (START flag and draft are per tab now).
  - `surveys-logic` CSV: hidden choice line was `...,"A fan, ""battery""",,,` now `...,hidden,,`.
  - Fixtures in `surveys-logic` and `surveys-admin` gained `stage: "RELEASED"`, `ready`, `released`, `releasedAt` and `other: null` (the new schema requires them). No other assertion was touched.
- Checks: `npx tsc --noEmit` exit 0; `next lint` no warnings or errors; vitest 90 files, 909 tests, all pass (before the pictures commit, which touched no src); `next build` succeeded; the browser run was against that build.

## Drawn on the boards, still not built, and what the API must give
- **First question and choices on the feed card and brand page card**: placement and brand survey cards need the first question's `prompt`, `kind` and `options` (id, label).
- **"Say why"**: an optional `clipId` beside `optionId` on a choice answer, same checks, transcript shown beside the choice in the report. Or the owner says a voice question stands in.
- **Voice recap player on Done**: playback for the person's own `SURVEY_ANSWER` clip right after sending, with wave data. Done shows "Voice answer, 0:12" as text.
- **Past answers on Done** (409, reload, later): `myAnswers` on `GET /surveys/{id}` for the person; owner to rule on the privacy promise.
- **Brand voice note**: `voiceClip` (url, seconds, wave) on `GET /brands/{slug}` and the admin form.
- **Verified tick**: `verified` on BrandPage and the brand form.
- **More menu and "Report this ad"**: a report target for brand and survey (ReportTargetType has none) and reasons.
- **Real "Why am I seeing this?" and "Why this ad?" copy**: a `why` line per placement or survey naming only what was used.
- **"Rather not see ads?"**: the Ad-free pass is not in launch; the owner should take the card off the board.
- **Brand badge word**: the board says "Sponsored"; the page shows the API's `label`. API to say which word.
- **Sidebar count for surveys to approve**: a field on `AdminToday.needsAttention` (for example `surveys`).
- **CSV after release for a brand**: no brand-facing route exists; admin only.

## Choices
- SKIP also goes on a reload (the page hides) and on a switch to another tab (`visibilitychange`), as asked. That counts toward the two-skip rule. If that is too eager, drop the `visibilitychange` listener.
- A reload with answers brings the person back where they were; the sheet "Leave" box is not restored after a reload.
- After Done the extra history entry is removed with one `history.back()`.
- Release dialog button is "Release the results", cancel "Not yet".
- Settings line: "Lets a survey aimed at your state reach you. It stays off until you turn it on."

## Not done
Everything in the list above; and the Home feed card still carries only the title.
