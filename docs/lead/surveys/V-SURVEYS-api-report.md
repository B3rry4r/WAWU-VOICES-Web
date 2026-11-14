# V-SURVEYS report: sponsored surveys, results for the brand, brand pages

Builder: unattended Sonnet session. Do not merge until the web half is done (see "What is not done").

## Branch heads

- API, `B3rry4r/wawu-voices-backend` branch `v/surveys` (from `origin/main`, then `origin/v/records-design` merged for the briefs and design canvas): head is the commit that adds this file (see `git log -1 origin/v/surveys`); the code head before this report was `7c5bb3d`.
- Web, `B3rry4r/wawu-voices-web` branch `v/surveys`: **not created.** The `add_repo` call for the web repo was refused by the session's permission classifier ("Unauthorized Access"). I did not try to reach the repo any other way. Items 2 (admin screen), 3 (feed card, Survey and SurveyDone screens), 4 (report page and CSV in the browser), 5 (brand page screen) and all Playwright pictures are therefore **not built**. Everything they need from the API is built, tested and in the contract.

## What I built, per item

### 1. Data (API, done)
One additive migration `api/prisma/migrations/20261114100000_sponsored_surveys/` with `rollback.down.sql` (refuses while any survey, brand, response or survey voice clip exists; drops the 7 tables and 2 enums otherwise; checked on a scratch database: refuses with a Brand row, drops clean when empty; the one new enum value `VoiceClipPurpose.SURVEY_ANSWER` cannot be dropped in Postgres and is left, and the file says so).
- `SponsoredSurvey` (brand name, optional `brandId`, `contactEmail`, title, status reusing `AdStatus`, category ids, states, start and end date, `frequencyCapPerDay`, `priceKobo`, `responseTarget`, reject reason, change request, `submittedAt`, `approvedById/At`, `resultsMailedAt`), `SurveyQuestion` (1 to 5; `SINGLE_CHOICE`, `TEXT`, `VOICE`), `SurveyOption` (2 to 6 per poll), `SurveyResponse` (one per person per survey), `SurveyAnswer` (per question), `SurveyEvent` (`VIEW`, `START`, `COMPLETE`, `SKIP`), `Brand`.
- Price: from the request, else the admin price list key `surveys.price.flat_kobo` (new, placeholder, null until the owner gives it). Nothing is hard-coded. New config keys: `surveys.price.flat_kobo`, `surveys.frequency_cap_per_day` (1), `surveys.max_skips` (2), `surveys.voice_max_seconds` (30), `surveys.review_days` (2). Listed in `docs/contract/PRICES.md` and the config catalogue.
- Identity: `SurveyResponse` has **no user id column**. It holds `respondentKey`, an HMAC of (survey, person) with the server pepper (the one the phone hash uses, domain-separated), enough to stop a second answer and useless for finding the person. State and age band are stored only when the person agreed to share (`shareState`, `ageBand`) and never when they answered anonymously.
- `SurveyEvent.userId` (for the frequency cap and the two-skip limit) is cleared by account deletion (`deletion.service.ts`), as `AdEvent.userId` is.
- Voice: the existing `POST /voice-clips` with purpose `SURVEY_ANSWER` (added to the allowed purposes). The answer route checks the clip is the person's own, that purpose, READY, not used before, and at most `surveys.voice_max_seconds`. A survey answer writes no `Answer` row, so it is never a public post.

### 2. Admin (API, done; screen not built)
Same roles as adverts (`AD_MANAGER`, `ADMIN`) through the same `@Roles` guard. Adverts have no creator-cannot-approve rule, so there is none here either (I followed adverts). Create makes a DRAFT; submit, approve, ask for changes, reject, pause and resume copy the adverts' rules, checks and error wording. Approval refuses (422, first failing check named) on: betting, gambling, lending, tobacco, political or health-claim wording (the adverts' `hasBannedWording`), a kept-away category (the adverts' `KEPT_AWAY`), missing dates, missing price, no usable question. Editing an approved or rejected survey is 409; new questions are 409 once anyone has answered; changing words on a paused survey sends it back to the queue. Every change writes an `AuditLog` row (`survey.create|update|submit|decision`, `brand.create|update`).

### 3. Public (API, done; screens not built)
- `GET /surveys/placement` is the feed slot, beside `GET /ads/placement`. Returns `{ survey: null }` for a guest and wherever a survey must not show: not APPROVED, outside dates, at or over `responseTarget`, a person outside its states, a category target that the page context does not match, a sensitive question or topic (how adverts decide), a kept-away category (stricter than adverts: they only check the flags), the day's frequency cap reached, already answered, skipped `surveys.max_skips` times.
- `GET /surveys/{id}` (questions, the note "...paid for by the brand and approved by WAWU. Answering is free and optional, and it never uses a free post.", `voiceMaxSeconds`, age bands, brand slug and website), `POST /surveys/{id}/events` (VIEW, START, SKIP), `POST /surveys/{id}/responses` (409 on a second answer).
- Proved in specs: an answer changes no wallet, ledger, free allowance, usage counter (the 20-a-day counters), notification or `Answer` row.

### 4. Results for the brand (API, done; page and CSV not built)
`GET /admin/surveys/{id}/report`. Built by a pure function (`survey-report.ts`) that is never handed a person. Totals, per-option counts and shares, free answers and transcripts listed alphabetically (no time order), state and age band breakdowns only from people who consented. The floor is `weekly.min_group_size` (20): while fewer people than that have answered, `belowMinimum` is true and nothing about people is returned (only view, start and skip counts); above it, an option, a list of free answers, a state or an age band under the floor is left out (counts and shares null, `hidden: true`). Emails, phone numbers, `@handles` and links are removed from free text and transcripts. The CSV is for the web to build from this body (no CSV route added).

### 5. Brand page (API, done; screen not built)
`GET /brands/{slug}` (public): name, logo URL, one line, website, live Sponsored Surveys and live adverts (matched by brand name, case-insensitive, since `Ad.brand` is free text), labelled "Brand". Never a contact address. Admin: `GET/POST /admin/brands`, `PATCH /admin/brands/{id}`; logo through the existing image upload (kind `AD_CREATIVE`), claimed and covered by the storage purge's reference check (`Brand.logoFileId` added to `STORED_FILE_REFS`; the existing privacy spec required it).

### 6. Emails (done)
F01 (submitted), F02 (approved), F03 (needs changes), F04 (results ready) are wired through `MailService.notifyBrand`, to the survey's own contact email (read from the survey row by the service, never passed by a caller), once per event (`MailLog` keyed `brand:<surveyId>`), after the action's transaction commits, never throwing. F04 is sent by `sweepFinished` (end date passed or response target reached; every ten minutes, and straight after the answer that reached the target; off under `NODE_ENV=test`). Template edits: logo from the one asset-folder setting, links to real pages, `support@wawuafrica.com` the only contact, `[REGISTERED ADDRESS]` absent, footer "Voices by WAWU". Words that changed and why are in `docs/mail/CATALOGUE.md` (rows F01 to F04, counts updated). `test/mail/mail.spec.ts` ("every wired template renders ...") and `mail-images.spec.ts` pass unchanged.

### 7. Contract (done)
All 14 new routes are in `docs/contract/src/routes.py` and schemas in `schemas.py`; `openapi.yaml` regenerated with `python3 docs/contract/src/build.py docs/contract/openapi.yaml` (196 routes, pure additions: 1,322 lines in a patience diff). `docs/contract/schema.prisma` got the new models and enum value; `CONVENTIONS.md` no longer lists surveys as "not in this contract".

## Routes added

| Route | Who |
|---|---|
| `GET /admin/surveys`, `POST /admin/surveys`, `GET /admin/surveys/{id}`, `PATCH /admin/surveys/{id}` | AD_MANAGER, ADMIN |
| `POST /admin/surveys/{id}/submit`, `POST /admin/surveys/{id}/decision`, `GET /admin/surveys/{id}/report` | AD_MANAGER, ADMIN |
| `GET /admin/brands`, `POST /admin/brands`, `PATCH /admin/brands/{id}` | AD_MANAGER, ADMIN |
| `GET /surveys/placement` | optional sign-in (guest gets null) |
| `GET /surveys/{id}`, `POST /surveys/{id}/events`, `POST /surveys/{id}/responses` | signed in (the last needs write access) |
| `GET /brands/{slug}` | public |

Existing routes return exactly what they returned. Existing files touched: `ads.service.ts` (one word: `KEPT_AWAY` exported), `admin/trust/common.ts` (`lockRow` accepts `"SponsoredSurvey"`), `media.controller.ts` (allowed purpose), `storage-purge.service.ts` (one list entry), `deletion.service.ts` (clear survey event user ids), `config-catalogue.ts`, `mail-templates.ts`, `mail.service.ts`, `mail-events.ts`, `app.module.ts`.

## Checks run (all on a local PostgreSQL 16 and Redis, ports 14001 and 14002)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (before and after the last two commits) |
| `npx eslint "{src,test}/**/*.ts"` | exit 0, 0 errors, 40 warnings (none in files I wrote: `grep surveys` over the log is empty) |
| `npm run build` | exit 0 |
| `src/surveys/survey-report.spec.ts` (8 unit specs: the floor, consent, scrubbing, no ids, key) | pass |
| `test/admin/surveys.spec.ts` (23 specs, see below) | pass |
| `test/mail`, `test/admin`, `test/feed`, `src` | pass after restoring the footer address line (see choices) |
| Full `npm test` (98 suites) | one failure on the first run: `test/privacy/purge-safety.spec.ts` (`Brand.logoFileId` not in the purge check). Fixed by adding the entry, not by touching the spec. Re-run of `test/privacy`, the survey specs: 59 pass. The full suite was not re-run end to end after that last fix. |
| Rollback on a scratch database | refuses with data, drops clean when empty |

What `surveys.spec.ts` attacks: every new admin route with no token (401), a signed-in person (403) and a moderator (403), table untouched after refusals; price from config and null when unset; 9 bad payloads (0, 6 questions, 1 choice, repeated choices, choices on text, bad email, backwards dates, impossible date, unknown category); F01, F02, F03 once each, to the contact, no em-dash, no placeholder, support address; wording, political, kept-away category, no price, no dates refused at approval; pause, resume, reject, audit rows with actor and reason; paused edit re-queues; a draft, awaiting, rejected, paused, not-started, ended and over-target survey never shows and cannot be opened; a person outside the state or category targeting never sees it or answers it; sensitive question, sensitive topic and a kept-away category show nothing; frequency cap; two skips; a question not in the survey, an option of another question, a repeated question, text on a poll, 501 characters, an empty answer list; voice over 30 s, someone else's clip, wrong purpose, not ready; an answer changes no wallet, ledger, entries, free allowance, usage counter, answer or notification row; a second answer is 409; an anonymous answer keeps no state, age band, user id, handle or sub anywhere in the survey tables; consent stored only when given; the report below the floor returns nothing about people; above it, a group of one option, one state and one age band under the floor is absent, and no name, handle, id, sub, email, phone or clip id appears; F04 once, with "Fewer than N" logic; brand page content, labels, inactive brand 404, no contact address.

## Choices where the sources were silent

1. **Web repo blocked** (above). I stopped the web half rather than work around the refusal.
2. **No creator-cannot-approve rule**, because adverts have none.
3. **Consent for state and age band** did not exist anywhere (VOICES stores no age band and no sharing switch). I made it per answer: the person ticks "share my state" and picks an age band; both are stored on the response only then, and never with `anonymous: true`. The Survey screen needs those two controls (not drawn on the boards: see below).
4. **Whole-report floor.** Below 20 answers the report shows no respondent count either, because a count of 3 is a group of 3. The admin list and detail still show the response count (an operations number for the team, not the brand report).
5. **Skips count across days; the frequency cap is per Lagos day** (views today under `frequencyCapPerDay`, default 1).
6. **Contact name:** a survey has a contact email, not a name, so F01 greets the brand name.
7. **F01 to F04 wording:** the owner's buttons point at a brand workspace that does not exist (no brand sign-in in this task). F01 "Open Voices", F02 "See it on Voices" (the brand page), F03 "Write to us" and F04 "Ask for the full report" are mailto links to `support@wawuafrica.com` with the survey reference. F03's two fixed bullets became the one reason the reviewer wrote. F04's "countries" tile became "days live". Recorded in the catalogue.
8. **Footer address.** I first removed the owner's line "5 Ikoyi Crescent, Lagos, Nigeria" (the earlier mails dropped a made-up company line). `test/mail/mail-images.spec.ts` requires it wherever "Voices by WAWU" appears, and I may not change a test, so F01 to F04 keep it. If the owner wants it gone, that spec changes with it (lead's call).
9. **Brand adverts** are matched by brand name text (additive: no foreign key on `Ad`).
10. **Free-text answers** are cleaned of contact details by pattern; a name someone types or says in words is not found by machine. Staff read the report before it goes to a brand.
11. **Survey voice limit** is `surveys.voice_max_seconds` (30), checked when the answer is sent. The clip upload itself keeps the existing 60-second cap.
12. **No CSV route**, per the task ("build the CSV in the browser").

## What does not match the boards, and why

No screen was built, so there are no pictures. Things the boards draw that the API does not carry or that need a decision:
- BrandPage draws "A voice note from the brand · plays only when you tap". `Brand` has no audio clip. Not built (needs a column and a player); follow-up.
- Survey and SurveyDone draw "About 1 min" (the web can compute it from the question count), "Why am I seeing this?" (copy only) and "Report this ad" (the report flow has no survey target; adverts have none either).
- SurveyDone recaps the person's own answers; the API does not return a person's past answers (the web holds them from the submit). "Visit Zobo Fresh" uses `brandWebsite`.
- The state and age band consent controls are not on any board.

## Follow-ups

- **The whole web half** (items 2 to 5 screens, `src/lib/api` calls, port of `Voices.SponsoredSurvey`, CSV in the browser, Playwright pictures at 390 and 1440 beside the boards, tsc, lint, vitest, `next build`, `sync:shared`). Needs the web repo attached to a session.
- Brand self-service accounts and online payment by brands.
- The AI summary of a survey.
- Invoices (F09). Advert emails F05 to F08. Brand workspace invites (F10).
- Brand voice note on the brand page.
- A survey target for the report flow ("Report this ad").
- The `weekly.min_group_size` rule is shared with the weekly report: changing it moves both.
- DECISIONS.md: V-10 should be updated by the lead (the owner asked for sponsored surveys and brand pages to be built).

## Could not prove

- Anything in a browser: no screen, no picture, no built web bundle.
- F01 to F04 inside a real mail client: rendered and checked as text and HTML against the stand-in relay only.
- The ten-minute `sweepFinished` timer itself (off under test); the method is tested directly, and also runs straight after the answer that reaches a target.
- The full API suite end to end after the last two small commits (the touched suites were re-run).
