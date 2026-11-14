# REL-W4 join

Branch `v/rel-w4`. Head commit: see the last commit on the branch (the one that adds this file).
Joined, in order: `origin/v/rel-w3` (c82caca), `origin/v/fix-c` (a2b0af1), `origin/v/fix-b` (6d9f776), on top of `origin/main` (8fa75a3).
rel-w3 was not inside main, so it was a real merge, with no conflicts.

## Conflicts and how they were settled

- `src/features/admin/roles.ts` (page ids, `ADMIN_PAGES`): main's Users, Verification and Money pages kept, fix-c's Group ideas and People and roles added.
- `src/components/feed/HomeScreen.tsx` (about line 60 and 139): kept main's timed refresh and the "no heading over nothing" New conversations check, added fix-b's audio advert between the posts.
- `src/features/admin/NewsPage.tsx` (about lines 127, 140, 159): kept main's phone detail pane and line-break rendering, added fix-b's hidden decided rows, the "Source given" line and the `onGone` handler.
- `src/features/speak/draft.ts` (line 16): kept all of main's draft fields (recordedAt, queued, anonymous, mood, shareCode, reply) and added fix-b's `tag`.
- `src/features/speak/SpeakScreen.tsx` (about lines 145, 166, 218, 500, 510): kept main's rules (a kept voice reply is never touched, 7 day stale draft, offline choices, "back online" note, `saveDraftKeepingReply`) and added the tag to every save and to the restore. fix-b's own save call was replaced by `saveDraftKeepingReply` so a waiting voice reply is never overwritten. Nothing else on the record screen changed.
- Not a git conflict but a clash: `src/lib/api/admin.ts` ended up with two `AdminUserPage` types and two `findPeople` functions (main's Users screen and fix-c's People page). One of each is kept (main's `findPeople`; the People page already strips the "@").
- Own fix: `TagPicker` crashed when a profile had no `roles` (4 unhandled errors in the suite). It now reads `roles ?? []`.
- Own fix (nameless rule): the admin news queue and its detail pane showed `@removed` for a post with no writer. They now say "Posted without a name" and show no avatar.

## Contract

- `v/rel-d2` does not exist in the server repo. `contract/openapi.yaml` is the server's `main` (18704b8), and `src/lib/api/types.ts` was regenerated from it with `npm run api:types`. Nothing hand-merged.
- The screens from fix-b and fix-c call things `main` does not have. To keep the build green without hand-merging, their own contract (as the branches wrote it, joined by git) is kept as `contract/pending-fix-bc.yaml` and generated to `src/lib/api/types-pending.ts` (the same `npm run api:types`). Only the API files under `src/lib/api/` (admin, feed, polls, profile, reach, units, vote) read it. When the server release carries these, delete both files, point those seven imports back to `./types`, and run `npm run api:types`.
- **Not on server `main`; these screens go out only after the server release that carries them:**
  - Routes: `GET /admin/proposal-questions`, `GET /admin/proposals`, `DELETE /admin/proposal-groups/{groupId}` (Group ideas, Split this group); `POST /admin/topics/{topicId}/summary/draft` (data and AI drafts); `POST /news/{answerId}/request-verified` (Verified News request); `GET /admin/topics/{topicId}/summary` (the GET method; the route exists for PUT); `POST /ads/{adId}/events` has a changed body.
  - Fields: `AdPlacement.audioDurationMs`; `AdminOverride.audioClipId`; `OverrideContent.audioClipId` and `audioDurationMs`; `AdminWeeklyReport.regions` and `WeeklyReport.regions`; `CreateAnswerRequest.requestVerified`; `EditorialSummary.aiDrafted` and `SummaryEditRequest.aiDrafted`; `Settings.notifyTagFollows` and `UpdateSettingsRequest.notifyTagFollows`; `Emotion.change` may be null.
  - Schemas: AdminGroupRemoved, AdminGroupSuggestion, AdminProposalGroup, AdminProposalItem, AdminProposalQuestion, AdminProposalQuestionRef, AdminProposalQuestions, AdminProposals, AdminSummary, DraftSummaryRequest, RegionShare, RequestVerifiedRequest, SavedSummary, SummaryDraft, SummaryDraftCategory, SummaryDraftFields, SummaryDraftMood, SummaryDraftQuote, VerifiedRequestReceipt.
- Until the server release, a live screen that calls one of the missing routes gets a 404 and shows its own "could not load" line. The tag picker on the record and write screens still works: the tag goes in the existing `isNews` and `newsTag` fields, and only a Verified News request needs the new field.

## Rules, each with a test

- Direct messages off: `DMS_LIVE = false`, plus a scan that no file outside `src/features/dm/` and `src/lib/api/dm.ts` names a `/dm/` route without the switch (`tests/rel-w4-rules.test.tsx`; `dm-off*.test.tsx` still pass).
- Record screen: take on main/rel-w3's behaviour; the fixb, round3, fixd, outbox and speak tests all pass unchanged. Posting stays one tap with "Not news" chosen (fixb tests and the browser run below).
- Nameless: `tests/rel-w4-rules.test.tsx` (admin news row) and the browser run (news post page). The summary and Group ideas screens show no names (quotes are excerpts only).
- Edit and delete from Profile, admin on phones, admin Users, admin sign-in: their tests pass unchanged.
- No inline styles or colours added, no em-dashes or "Rant" in added text (checked on the diff).

## Checks

- `npx tsc --noEmit`: clean. `npx next lint`: clean. `npx next build`: compiled.
- `npx vitest run`: 125 files, 1337 tests, all passed, no unhandled errors. No existing assertion was changed.

## Browser run (built app, API stubbed, Chromium)

`e2e/relw4.e2e.mts`, pictures in `docs/lead/rel-w4/` (`relw4-*.png`; fixb and fixc script pictures too).
- Home to the record flow at 390x844 and 1440x900: tap Speak, Pick one word, "Say it in 10 seconds", "Type it instead" is there, record, Send. Tag left alone: Send is ready, "Not news" is chosen, one tap posts the voice with the word and no tag. Tag picked (Gossip): posts with `isNews` and `newsTag: GOSSIP`.
- News post page at both sizes: tag shown, nameless post shows no writer.
- Admin news queue at 390: fits, no sideways scroll, the nameless row says "Posted without a name"; the detail pane too.
- Admin calendar with the summary panel (list and editing), Group ideas and People and roles at 390: fit, no sideways scroll.
- The older `fixb.e2e.mts` (24 checks) and `fixc.e2e.mts` (8 checks) were also run against the joined build: all passed.

## Not proven

- Nothing was run against the live server or real recording hardware; the microphone is Chromium's fake device.
- The summary, Group ideas, Verified News request and notify-on-tag screens are proven against stubs only, because the server on `main` does not serve them yet.
- No pull request was opened (as asked).
