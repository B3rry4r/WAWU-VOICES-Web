# V-SURVEYS report: sponsored surveys, results for the brand, brand pages

Builder: unattended Sonnet session. Do not merge until the web half is done (see "What is not done").

## Branch heads

- API, `B3rry4r/wawu-voices-backend` branch `v/surveys` (from `origin/main`, then `origin/v/records-design` merged for the briefs and design canvas): head is the commit that adds this file (see `git log -1 origin/v/surveys`); the code head before this report was `7c5bb3d`.
- Web, `B3rry4r/wawu-voices-web` branch `v/surveys`: **not created.** The `add_repo` call for the web repo was refused by the session's permission classifier ("Unauthorized Access"). I did not try to reach the repo any other way. Items 2 (admin screen), 3 (feed card, Survey and SurveyDone screens), 4 (report page and CSV in the browser), 5 (brand page screen) and all Playwright pictures are therefore **not built**. Everything they need from the API is built, tested and in the contract.

## What I built, per item

### 1. Data (API, done)
One additive migration `api/prisma/migrations/20261114190000_sponsored_surveys/` with `rollback.down.sql` (refuses while any survey, brand, response or survey voice clip exists; drops the 7 tables and 2 enums otherwise; checked on a scratch database: refuses with a Brand row, drops clean when empty; the one new enum value `VoiceClipPurpose.SURVEY_ANSWER` cannot be dropped in Postgres and is left, and the file says so).
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

## Round 1 (server side)

Head before this round: `3eb150c`. `origin/main` merged (subscriptions with VAT and charges, the launch calendar step in the deploy script, the guest-cache test fix); merge commit `494f463`. The head of this round is the commit that adds this section (`git log -1 origin/v/surveys`).

### 1. Merge
`git merge origin/main`: **no conflicts**, every file merged automatically (26 files, +2,467 −60). The files touched by both sides (`app.module`, `routes.py`, `schemas.py`, `openapi.yaml`, the units files) did not overlap in lines, so both sides are kept. `docs/contract/openapi.yaml` was regenerated anyway with `python3 docs/contract/src/build.py docs/contract/openapi.yaml` (output "admin 68, text-fix 1"): the file was byte-identical to the merged one, so the regeneration changed nothing.

### 2. Migration folder renamed
`20261114100000_sponsored_surveys` -> `20261114190000_sponsored_surveys` (`git mv`; `migration.sql` unchanged, no SQL change). Paths fixed: the first line of `rollback.down.sql` and the one path in this report. `grep` for `20261114100000` over the repo (outside `node_modules` and `.git`) now finds nothing. No spec named the folder. The migration order is now `...20261112100000_mail_notices`, `20261114120000_subscriptions`, `20261114190000_sponsored_surveys`.

### 3. Checks on the merged tree (own PostgreSQL 16.15 on port 15432, Redis on 15379, both stopped afterwards, data dir deleted)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint "{src,test}/**/*.ts"` (run without `--fix`, so nothing was rewritten) | exit 0, 0 errors, 40 warnings (same 40 as before the merge) |
| `npm run build` | exit 0 |
| Full `npm test` (`jest --runInBand`) | **100 suites passed of 100; 1,148 tests passed, 1 skipped, 0 failed** (1,149 total, 445 s) |
| `npm run test:audio` (the second half of `npm test`) | 13 of 13 passed |

No failure, so no fix was needed and no test was touched. Nothing failed on the merged tree that needs comparing with `origin/main`.

**Migrations on a production-shaped database.** A fresh database was first migrated with `origin/main`'s own `prisma/` (14 migrations, ending `20261114120000_subscriptions`), then `prisma migrate deploy` ran from this branch: it applied only `20261114190000_sponsored_surveys` (15 recorded, 0 unfinished) and `prisma migrate status` said "Database schema is up to date". The folder sorts after the subscriptions one.

**Survey rollback (`rollback.down.sql`), same database:**
- Empty: ran clean; the 7 survey tables and 2 enums are gone (79 -> 72 public tables, the 72 others untouched).
- Re-applied the migration, then filled with 1 Brand, 1 SponsoredSurvey, 1 SurveyResponse: rollback **refused** ("SponsoredSurvey has rows"), all 7 tables, 2 enums and the 3 rows still there.
- With the response and survey deleted but the Brand left: refused ("Brand has rows").
- With all rows deleted: ran clean (7 tables gone).
- Not exercised: a filled survey voice clip (`VoiceClip` purpose `SURVEY_ANSWER`) or answers/options/questions rows. The guard for them is in the file and was read, not run.

### 4. Not done / unchanged
The web half is still not built (see above); nothing in this round touches it. No pull request opened.

## Round 2 (server side)

Head before this round: `d84fc13`. Branch `v/surveys`. Written by an unattended session; the checker's findings B1, H1 to H3, M1 to M7 and the LOWs are answered one by one below. No web code was touched. No pull request opened.

### 0. Merge
`git merge origin/main`: **two** textual conflicts, both kept on both sides: `api/src/mail/mail.service.ts` (this branch's `BrandMailJob` and main's `PostResult` type, as the checker found) and `docs/mail/CATALOGUE.md` (main's new rows E13 and E14 beside this branch's F01 to F04 rows, which replace main's "kept unsent" F01 to F04 rows). Everything else merged by itself. `docs/contract/openapi.yaml` was regenerated with `python3 docs/contract/src/build.py docs/contract/openapi.yaml` (never by hand), once after the merge and again after the contract sources changed in this round.

### Items

| # | What changed | Where |
|---|---|---|
| B1 | `sendBrand` reads the relay's answer as `"ok" / "capped" / "failed"` exactly as `send()` does: anything but `"ok"` deletes the log row; `"capped"` for a 429. Every other place on this branch that talks to the relay or a provider was checked (`grep` for `this.post(`, `postJson(`, `if (!ok)`): `send` and `sendNotice` already compared with `"ok"`; the other `ok` variables are file-confirm booleans (not provider results). Nothing else on this branch reads a relay result. | `api/src/mail/mail.service.ts:369` |
| M5 | F04 is sent first, and `resultsMailedAt` is set only when the mail went (`sent`, or `limited` = this event is already in the send log); a failed, capped or over-budget mail leaves it empty and the ten-minute sweep tries again; the send log (once per survey) keeps it from going twice; an in-process guard stops two calls at once. Brand mails (F01 to F04 together) have their own daily limit `BRAND_MAIL_DAILY_MAX` (default 50 per UTC day), counted from `MailLog` rows of those templates the way the topic budget is counted; over it the outcome is `"budget"` and the relay is not asked. Documented in `api/.env.example`. | `mail.service.ts:313`, `:350`; `surveys-results.service.ts:449`; `mail-events.ts` `surveyResultsReady` (now awaited, answers the outcome) |
| H1 | `checkContent` takes the purposes the route accepts and refuses any other (422 "That recording was made for something else", the words `forPublish` uses), and refuses a clip on a `SurveyAnswer` whatever its purpose. Poll explanation accepts `ANSWER` and `VOTE_EXPLANATION` (the existing spec makes its clip `ANSWER`; the explanation is stored as an Answer), proposals accept `PROPOSAL`. Other routes that attach a clip: answers and replies (`forPublish`, already checked purpose), voice card (purpose `VOICE_CARD`, own clip), editor override note (`OVERRIDE_NOTE`), and **advert audio**, which checked nothing: it now refuses a `SURVEY_ANSWER` clip or one on a survey answer (422 "That audio is not available."). A request with a clip of the right purpose behaves as before. | `vote/post-content.ts:43`, `poll.service.ts`, `proposal.service.ts`, `admin/trust/ads.service.ts:397` |
| H3 | `GET /admin/surveys/{id}/report` works out nothing while the survey runs. A survey is **over** when it is APPROVED or PAUSED and its end date has passed (Lagos day) or its response target is reached. When it is over the counts are computed once under the survey row's lock and stored (`snapshotAt`, `reportSnapshot`, counts and breakdowns only, never free text). The answer that reaches the target takes the snapshot inside its own transaction; the first read, the ten-minute sweep, or the review routes take it after an end date. After the snapshot no answer, view, start or skip is accepted (`isLive` is false) and the survey cannot be edited or paused (409). Every read after release returns the stored report. | `surveys-results.service.ts:158` (`snapshotIn`), `surveys-admin.service.ts` `isLive`, `surveys-public.service.ts:427` |
| H2 | `suppressSmall`: hide every group under the floor; while the hidden total is above zero and under the floor, hide the next smallest shown group too; repeat. The hidden groups appear as one `other` line only when their sum is at least the floor. Applies to the choices of every poll question, to `byState` and to `byAgeBand`. A breakdown's shares are of the people who shared; if the people who did not share are a non-empty group under the floor, the breakdown is not shown at all (it would follow from the total). | `survey-report.ts:79` |
| M1 | After the snapshot, `GET /admin/surveys/{id}/free-answers` lists every free answer and transcript (scrubbed), `PATCH .../free-answers/{answerId}` hides or shows one, `POST /admin/surveys/{id}/release` releases once (audited: who, when, how many hidden). The released report (`released: true`), the data a CSV would be built from, and F04 exist only after that. Scrub widened to bare domains (a list of common endings), `t.me` and `wa.me` links, "name at provider dot com" (also `(at)` and `(dot)`), a handle after insta, instagram, ig, twitter, x, tiktok, snap, snapchat (with or without `@`, `:`, "is", "me at"...), and six or more number words in a row. The space after a removed phone number is no longer eaten. A name or address typed in plain words cannot be found by pattern, so a person reads them. | `surveys-results.service.ts:316`, `:334`, `:386`; `survey-rules.ts:36` |
| M2 | The COMPLETE event is written with no user id; the migration also clears it on COMPLETE rows the first round wrote (one `UPDATE` on `SurveyEvent` only). **What still links a voice answer to its owner:** `SurveyAnswer.clipId` points at a `VoiceClip` whose `ownerId` is the person. It must stay, because the person must be able to play and delete their own recording, account deletion and the storage purge find the clips to erase by `ownerId`, and the answer route checks the clip is theirs. No route returns a clip id or owner to staff or a brand (clip GET and play are owner-only). `SurveyEvent` rows of kind VIEW, START and SKIP keep the user id because the frequency cap and the two-skip rule need it; account deletion clears them. | `surveys-public.service.ts:419` |
| M3 | New nullable `Ad.brandId` (FK to `Brand`, on delete set null). The ad manager sets it in `POST` and `PATCH /admin/ads` (`brandId`, null clears it; an unknown id is 422; changing it on a paused advert sends it back to the queue like other content). The brand page lists only adverts with that id. A second brand whose name matches an existing one ignoring case and all spaces is **409** "A brand with that name already exists. Use it, or choose another name." on create and rename (under one advisory lock). | `ads.service.ts:308`, `:411`, `:423`; `brands.service.ts:83`, `:182` |
| M4 | `GET /brands/{slug}`: the slug is lower-cased and must match `^[a-z0-9-]{1,60}$` else 404. | `brands.service.ts:175` |
| M6 | `UserSettings.useMyStateForSurveys` (boolean, default false) in the settings DTO, `GET/PATCH /me/settings` and the contract. A survey with states is shown, opened and answered only by a person who turned it on and whose state matches (placement, `GET /surveys/{id}`, events, responses). A survey with no states is unaffected. **Age-band targeting is not built** (as the first round said); only reporting by a consented age band exists. | `surveys-public.service.ts:64`; `me.service.ts:65`, `:714` |
| M7 | Every read of a report (`survey.report.read`), of the free-answer list (`survey.free.read`), every hide or show (`survey.free.hide` / `survey.free.show`, the answer id only) and the release (`survey.release`, `{hiddenCount}`) writes an `AuditLog` row with actor, time and survey; never content. | `surveys-results.service.ts` |

### LOWs

- **L1** (inflated events): fixed. A person's START counts once per survey; VIEW at most `frequencyCapPerDay` a day; SKIP was already limited by the two-skip rule.
- **L2** (owner deletes the clip after answering): **not changed.** It is not a leak; the person has the right to delete their own recording. The released report then simply has one voice answer fewer than `answered`; a staff review list shows what exists at that time.
- **L3** (`POST /voice-clips` with `SURVEY_ANSWER` for anyone): **not changed.** Same as every other purpose; the route's own upload limits apply and a clip with no survey answer is never shown to anyone.
- **L4** (link and address checks): fixed. A brand website with a space is 422; a contact address (brand and survey) must be one plain address (no quotes, spaces, brackets, commas or semicolons); `"a b"@b.test`, `a@b.test, c@d.test` and `<a@b.test>` are 422. https-only stays (stricter than the source). Escaping `<b>` in a name stays the web's job.
- **L5** (export and privacy text): the account export now has a `surveys` part (the person's views, starts and skips, and their survey voice recordings with transcript) and says in plain words that choices and typed answers are stored without the account and cannot be listed. The privacy page wording belongs to the owner; suggested line: "Survey answers are stored without your account. Views, skips and a voice recording are tied to your account until you delete them or your account."
- **L6** (cap counted from posted VIEWs): **not changed**, same as adverts.
- **L7** (alcohol and finance extra checks, "never in the first 3 items", per-day packages, `skipped` never written): **not done.** Alcohol and finance "extra checks" need a lead ruling on what the check is; the feed position is the web's; packages are not modelled; `SurveyAnswer.skipped` stays unused.

### Routes and shapes the web builder needs

All under `/api/v1`. "AM" = `AD_MANAGER` or `ADMIN`. Errors use the one error shape (`{error:{code,message,...}}`); 401 no token, 403 other roles.

**`GET /admin/surveys/{surveyId}/report`** (AM). Audited. 404 unknown survey. Response always has `survey {id, brandName, title, status, startsOn, endsOn, responseTarget}`, `stage`, `ready`, `released`, `note`.
- Running (`stage "RUNNING"`, or `"NOT_LIVE"` for a draft, queued or rejected survey): `ready false, released false, answeredSoFar n`. No other field.
- Over, not released (`stage "REVIEW"`): `ready true, released false, answeredSoFar n`. No other field. Show the review screen.
- Released (`stage "RELEASED"`): `ready true, released true, releasedAt`, and the stored report: `minGroupSize, belowMinimum, totals {views, starts, skips, responses|null, completionRate|null}, questions[] {id, position, kind, prompt, answered|null, options[] {id, label, count|null, share|null, hidden}, other {label:"Other", count, share}|null, texts[], voices[] {transcript, seconds}}, byState[] {state, responses, share}, byStateOther {responses, share}|null, byAgeBand[], byAgeBandOther|null`. While `belowMinimum` is true there are no questions or breakdowns and `responses` is null. Build the CSV only from this body.

**`GET /admin/surveys/{surveyId}/free-answers`** (AM). Audited. 409 while the survey runs. `{released, items[] {id, questionId, prompt, kind "TEXT"|"VOICE", text, seconds|null, hidden}, total, hiddenCount}`. Scrubbed; alphabetical inside a question.

**`PATCH /admin/surveys/{surveyId}/free-answers/{answerId}`** (AM). Body `{hidden: boolean}` (422 otherwise). Response `{id, hidden}`. 404 unknown answer, 409 before the survey is over or after release.

**`POST /admin/surveys/{surveyId}/release`** (AM). No body. 200 `{released: true, releasedAt, hiddenCount, mailed}`; `mailed false` means F04 has not gone yet and will be retried. 409 while running or when already released.

**Admin survey** (`GET/POST/PATCH /admin/surveys...`): two new fields `snapshotAt`, `releasedAt` (time or null). `PATCH` and `decision` answer 409 once `snapshotAt` is set.

**`PATCH /admin/ads/{adId}`, `POST /admin/ads`** (AM): new optional `brandId` (uuid, or null to clear); the advert response has `brandId` (uuid or null).

**`GET /me/settings`, `PATCH /me/settings`**: new boolean `useMyStateForSurveys` (default false). Offer it as "Show me surveys for my state".

**`POST /admin/brands`, `PATCH /admin/brands/{id}`**: 409 for a duplicate name (message above).

**`GET /brands/{slug}`**: `ads` are only adverts tied to the brand by id; a bad slug is 404.

The config key and environment: `BRAND_MAIL_DAILY_MAX` (environment, default 50). No new price-list key.

### Migration
`api/prisma/migrations/20261114240000_sponsored_surveys_2/migration.sql` and `rollback.down.sql`. Additive: `SponsoredSurvey.snapshotAt, reportSnapshot, releasedAt, releasedById, releasedHiddenCount, releasedReport`; `SurveyAnswer.hidden (default false), hiddenById, hiddenAt`; `Ad.brandId` (+ FK, index); `UserSettings.useMyStateForSurveys (default false)`; one `UPDATE` that clears `SurveyEvent.userId` on COMPLETE rows. `20261114190000_sponsored_surveys` is untouched. Contract: `docs/contract/schema.prisma` has the same columns.

### Specs added
- `src/surveys/survey-report.spec.ts`: 5 for H2 (19, 20 and 21; 25 and 1; three choices with two small; two small groups reaching the floor; states) and 1 for the wider scrub.
- `test/admin/surveys-round2.spec.ts` (19 specs): relay 500 then healthy, 429, F01 retry, brand budget; F04 only after release, kept and retried, once; running report is a count only, before and after another answer; target fixes results with the last answer; end date fixes on first read and a row behind it changes nothing; 19, 20, 21, 20 and 1 through the API; review list scrubbed, hide, release once, audit; roles on the new routes; audit on reads; COMPLETE has no user id; event dedupe; adverts by brand id; bad slugs; link and address checks; the setting and state targeting.
- `test/vote/vote.spec.ts`: 2 (survey clip refused as explanation and as proposal, right purpose still 201).
- `test/admin/surveys.spec.ts`: setup gives the Lagos and Kano test people the new setting; the F04 spec and the report spec follow the new flow (below).

### Specs whose assertion changed because a rule changed
| Spec | Old | New |
|---|---|---|
| `src/surveys/survey-report.spec.ts` "at the minimum it shows totals..." | Rice (32 of 40) shown, count 32, hidden false | Rice and No both hidden, `other` = {Other, 40, 100} (8 hidden alone would follow from 40 minus 32) |
| `survey-report.spec.ts` "a state or age band group under the minimum..." | `byState` = Lagos 25, share 42; `byAgeBand` = ["25-34"] | `byState` [], `byStateOther` {40, 100}; `byAgeBand` [], `byAgeBandOther` {40, 100} (Kano 15 hidden would follow, so Lagos joins it; shares are of the people who shared) |
| `test/admin/surveys.spec.ts` "shows nothing about people while fewer than the minimum..." | report shows `belowMinimum true` on a running survey | replaced by "while the survey runs it returns only how many people answered so far" |
| `surveys.spec.ts` "lists combined answers..." (report part) | live report, Rice 4 shown, Lagos 3 shown, 5 texts | split: live report is only a count; after end, review, hide one, release: Rice and Beans hidden into Other 5, `byState` [] with Other 5, 4 texts |
| `surveys.spec.ts` "sends F04 once when the survey ends" | `sweepFinished()` sends F04 | F04 never before release; after release exactly one, `sweepFinished()` returns 0 |
| `surveys.spec.ts` "serves a brand ... " | second brand "Mama Nkechi Foods" is 201 with slug `-2`; advert matched by name | 409 for the same name in three spellings; the advert shows only with `brandId`, and an advert with the same name but no `brandId` is not on the page |
| `test/me/me.spec.ts` "GET and PATCH /me/settings" | settings body equals the list without the new field | same list plus `useMyStateForSurveys: false` |

### Runs (own PostgreSQL 16 on 16432 and Redis on 16379, both stopped at the end)
| Run | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint "{src,test}/**/*.ts"` (no `--fix` on the final run) | 0 errors, 41 warnings (the same 41 as before) |
| Survey specs (`src/surveys`, `test/admin/surveys.spec.ts`, `surveys-round2.spec.ts`), on a database created fresh from all 20 migrations | 3 suites, 57 tests passed |
| `test/admin`, `test/mail`, `test/vote`, `test/privacy`, `test/me`, `src/surveys` together (`--runInBand`) | 56 suites, 547 tests passed, 0 failed |
| Full `npm test` (jest `--runInBand`, then `test:audio`) | 106 suites passed, 1,272 tests passed, 1 skipped, 0 failed; audio 13 of 13 passed. (Run before the one-line `UPDATE` was added to the new migration; the survey specs were re-run after it on a fresh database, above.) |
| Migrations on a database migrated from `origin/main` (2 users, 7 clips, 1 advert, settings) | `migrate deploy` applied `sponsored_surveys` and `sponsored_surveys_2`; rows unchanged (2 / 7 / 1); second deploy "No pending migrations"; `migrate status` up to date |
| `rollback.down.sql` with rows | refuses, changes nothing (5 columns still there), for each of: an advert tied to a brand, a person with the setting on, a hidden answer, a frozen survey, a released survey |
| `rollback.down.sql` with old survey, answer, brand, advert and settings rows but none of the new values set | runs; the 5 probed columns gone; rows unchanged (1 answer, 1 advert, 1 settings, 2 users, 7 clips) |
| `rollback.down.sql` without the new columns (second run) | errors on the missing column, changes nothing |
| Re-apply after deleting the migration row | applies; up to date |
| The one `UPDATE` (COMPLETE rows lose the user id) | run by hand on a COMPLETE and a VIEW row: only COMPLETE cleared |

### Choices
1. A survey is "over" when it is APPROVED or PAUSED and its end date passed or its target is reached; a paused survey past its end date is over (dates end a survey). A rejected, draft or queued survey never has a report (`NOT_LIVE`).
2. Before release the admin report shows only the count (`answeredSoFar`); staff read free answers on the review route, not a preview of the brand's report. This keeps "brand-facing output only after release" literal.
3. The released report is stored once, built from the snapshot plus the free answers staff left in; later reads never recompute, so a transcript lost afterwards (a person deleting a recording) does not change it.
4. The poll explanation accepts both `ANSWER` and `VOTE_EXPLANATION` clips, because the existing spec and the answer table treat an explanation as an answer.
5. `limited` from the send log counts as "already mailed" for F04. Two server processes sending at the same instant is still stopped by the log row; the in-process guard covers one process.
6. A malformed percent escape in a slug (for example `%E0%A4%A`) is refused by the web framework with 400 before the route runs; every slug that reaches the route and is not valid is 404.

### Not done
Age-band targeting; alcohol and finance extra checks; the web half; a CSV route; the brand voice note; privacy page wording (suggested line above); a way to hide a survey's free answers after release (release is final by design).
