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
