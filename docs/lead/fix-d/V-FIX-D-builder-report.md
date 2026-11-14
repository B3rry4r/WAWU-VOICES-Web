# V-FIX-D report

Branch `v/fix-d` in both repos, pushed. API worktree `/home/user/wt/v-fixd` (commit cf3faed, from origin/main f336fc6). Web worktree `/home/user/wt/vw-fixd` (commit f9128e3, origin/main plus a clean merge of origin/v/fix-a). No PR, no merge. Scratch PostgreSQL (port 55480) and Redis (56480), the web server (3984) and the board server (8765) are stopped and removed.

## Per item

### 1. Story and square cards from every share sheet: DONE
- Finding: only the Posted screen offered them, and the API drew the square for a mood card only (any other link was a 404). So the API needed work too.
- API: the square now draws for every kind. `api/src/reach/card-renderer.ts:374` (`storySvg(spec, size)` takes `"story" | "square"`; the square is the same card with the safe zones, type and spacing scaled to 1080 x 1080, checked by eye on question, poll, voice, weekly, plain and fallback cards). `api/src/reach/share.service.ts:288` (the mood-only gate is gone), `:478` (`squareImageUrl` set for every non-failed card).
- Web: every sheet (question, voice, poll result, weekly report, profile, what-next, news, result thread) goes through the one `ShareSheet`, so one change covers them all. `src/features/share/ShareSheet.tsx:45` (targets and order as the board draws them: WhatsApp, Status, Stories, Facebook, X, TikTok, Telegram, SMS, Copy link, More; 5-column grid, 52px circles, 12px labels as in the board source). Status opens WhatsApp (lead ruling WF, as the Posted screen does). Stories and TikTok save the 1080x1920 card, show a short how-to, and "Save the square card instead (1080 x 1080)" is one tap away (`ShareSheet.tsx:174`, `src/features/share/save-card.ts`). Intents are recorded with the tapped target.
- Deviation to know about: the boards draw no square button and no how-to panel. I put both under the grid after a Stories or TikTok tap so the drawn grid is unchanged.
- Anonymous rule: the new square path uses the same card words as the 1200x630 card. Test `api/test/reach/fixd-cards.spec.ts` "an anonymous voice carries no name, handle, place or invite code on the 1200x630 card, the story or the square" (with and without "show my name on the card", handle, display name, place and the author's real invite code all absent from the spec and from all three SVGs, and all three routes return 200). A named voice test guards against an empty-card pass. The mood card's own rule is covered by the existing G7 test in `mood-card.spec.ts`.
- Existing tests changed on purpose (they asserted the old rule "square for a mood card only"): `api/test/reach/share.spec.ts:170`, `api/test/reach/mood-card.spec.ts` "serves the square for a plain answer too". Web `tests/w8b-reach.test.tsx` (asserted TikTok absent) now asserts Status, Stories and TikTok present.

### 2. Share measurement events: DONE (share links); /go links NOT measurable
- The route `POST /share/{code}/events` already accepted `recording_started` and `published_from_link` (`api/src/reach/share.controller.ts:46`); no API change needed. The web never sent them.
- Web: `src/features/share/share-visit.ts`. The link code is remembered for the tab when the share page opens (`LinkOpened`) or "Add your voice" is tapped (`AddVoice`), and on `/speak?from=` (`SpeakScreen.tsx`). `recording_started` is sent once when the microphone opens (`SpeakScreen.tsx:241`); `published_from_link` once after the first post, voice (`SpeakScreen.tsx:410`) or words (`WriteScreen.tsx:101`). Both are once per visit; nothing is sent in a visit with no share link; blocked storage sends nothing.
- Not done: a `/go/<code>` arrival. A /go code is a personal invite code, not a share link, and `ShareEvent` rows hang off a `ShortLink`, so there is nothing to count against. Measuring it needs a model change (nullable `linkId` plus an invite code column); left for the lead to decide. Recorded in the file header.
- Playwright proves the call order: `[recording_started, published_from_link]` once each across two recordings in one visit, none without a link.

### 3. Offline recordings send themselves: DONE
- A recording whose Send could not go (offline, or `navigator.onLine` false, or a network error on the direct upload) is kept on the device marked `queued`, with the anonymous choice and mood word as they were at that moment (`SpeakScreen.tsx:352` `keepForLater`; `src/features/speak/draft.ts`).
- `src/features/speak/Outbox.tsx` (mounted in `src/components/shell/AppShell.tsx`) looks when the app opens, on every navigation and on the `online` event:
  - free post covers it (`planFor`, same numbers as the record screen): sent by itself;
  - otherwise a banner "A recording is waiting" with the price on the button ("Send for 78 tokens"); nothing is sent or charged until the tap;
  - older than 7 days (counted from when it was recorded): removed with the note "A recording you saved more than 7 days ago was removed." (also on the record screen's restore, `SpeakScreen.tsx:140`);
  - a recording the person only listened to (never sent) is never touched; closed question: removed with a note; mood question without a word: asks the person to finish on the record screen.
- No double send: the recording's own key is the answer's Idempotency-Key (`outbox.ts:62`), one send per key at a time (`claimSend`, shared with the record screen's own Send), and the draft is cleared on success.
- Playwright (fake microphone, `context.setOffline`): Send offline sends nothing and marks the draft queued; back online the free one posts once with `Idempotency-Key` equal to the draft key, a reload posts nothing more; with no free post left the offer shows "Send for 78 tokens", no clip request before the tap, one post after it.

### 4. "Marked helpful": NOT BUILT, not drawn
- Ran: `grep -rli "helpful" docs/design docs/boards docs/launch docs/lead` in the API worktree (origin/main). Only hit: `docs/design/launch/support.js` (the canvas tooling's own string "helpful warnings"). `grep -rli "helpful" docs/design/first` returns nothing. The Thread and Reactions boards (390 and 1440) carry only I agree / I disagree / My experience, reactions and reply counts (read their text). The word appears in the brief and addendum (ranking input) and in CONVENTIONS, never in a board.
- So no control and no `iMarkedHelpful` field. Web `markHelpful` / `unmarkHelpful` stay unused. The lead can draw it first.

### 5. Anonymous replies: DONE (privacy-sensitive)
API (additive):
- Migration `api/prisma/migrations/20261114200000_fix_d/` (`ADD COLUMN "Reply"."anonymous" BOOLEAN NOT NULL DEFAULT false`) with `rollback.down.sql` that refuses while any unnamed reply exists (dropping the column would put names on replies people chose to keep unnamed). I ran the rollback and the forward migration on a scratch database.
- Body: `CreateReplyDto.anonymous` (`talk.controller.ts`), stored at `posts.service.ts:501`.
- Every read hides the author (null for everyone including the writer, `isMine` says it is theirs, exactly as an anonymous answer):
  - thread and any question page replies, POST receipt: `talk/views.ts:163`
  - profile reply list: `me/views.ts:323`; list shows unnamed replies to their writer only (`me/people.service.ts:144`); profile `replyCount` counts named replies only (create `posts.service.ts:513`, delete `:590`, moderation restore/remove `moderation.service.ts`), so the count cannot reveal one
  - notifications: stored title "Someone replied to your voice" (`posts.service.ts:532`) and the read-time wording (`reach/reach.service.ts:349`, also fixes old stored titles)
  - mail B03: `replier_name` is "Someone" so subject, heading, line and text carry no handle (`mail/mail-events.ts:362`, no template change)
  - moderation view: admin and moderator still see the author and `content.anonymous` (`moderation.service.ts:215`)
  - search, share pages and cards, weekly report: no reply author is read there (search returns answers, questions and people; share subjects carry answers/questions/polls only; weekly code reads reply transcripts for languages and counts, never authors). Covered by assertions on the share link and page; no admin CSV exports exist (only the owner's own data export, which is the writer's own data).
- Specs: `api/test/talk/anon-reply.spec.ts` (8 tests): receipt; `GET /answers/{id}/replies` as guest, another member, the answer's author and the writer (plus stance and page variants) with a leak scan for the handle and user id; `GET /people/{id}/replies` as guest, member, answer's author (empty) and the writer (one, author null, `isMine`); profile by id and by handle (replyCount 0); counts on create and delete; stored notification row and `GET /notifications` (including an old named stored title); share link and page; moderation detail as admin and moderator (author and flag visible); moderation removal moves no count. Mail: `api/test/mail/mail.spec.ts` new test renders the real B03 via the relay stand-in and checks subject, html and text for "Someone" and no "kemi" or "@a7b".
- Contract: `Reply.author` nullable, `CreateReplyRequest.anonymous`, share descriptions (`docs/contract/src/*.py`, `openapi.yaml`, `schema.prisma` rebuilt by `build.py`).

Web:
- Switch on the text reply composer (`ReplyComposer.tsx`), the reply write screen (`WriteScreen.tsx`) and the voice reply box (`VoiceBox.tsx` with `anonSlot`, used by `VoiceReply.tsx`). One hook `useReplyAnon` (`src/features/talk/reply-anon.ts`) over `src/lib/anon-pref.ts`; every send reads `ref.current` at the moment it sends. The text box and the voice sheet of one reply stay in step (small event added to `anon-pref.ts`).
- Stale-closure tests: `tests/fixd-anon-reply.test.tsx` flips the switch on, fails, off, fails, on, and asserts the three calls carried `true, false, true` with one Idempotency-Key; same for the voice box (`onSend` gets `anonymous` at Send time on a try again). A box with no switch (explain-my-vote) always sends false. Payload test in `tests/v-anon.test.tsx`: `anonymous` is sent only when on.
- Display: an unnamed reply shows "Anonymous" in the thread, news page and profile list; its writer alone sees "Posted without your name" (`ThreadScreen.tsx`, `NewsPostPage.tsx`, `profile/PostRow.tsx`). Types regenerated by applying only the contract diff to the web's `contract/openapi.yaml` (copying the whole API file broke `src/features/units/WalletScreen.tsx` on a new enum value, which I may not touch).
- Existing test changed on purpose: `tests/v-anon.test.tsx` "is not offered on a reply" now asserts the switch is offered and off.

## Routes changed
- `GET /share/{code}/square`: 200 for every kind (was mood only). `POST /share/links`: `squareImageUrl` set for every non-failed card.
- `POST /answers/{id}/replies`: body accepts `anonymous?: boolean`.
- Response shape: `Reply.author` may be null (`GET /answers/{id}/replies`, `POST /answers/{id}/replies`, `GET /people/{id}/replies`).
- `GET /people/{id}/replies`: includes unnamed replies for their writer only.
- `GET /notifications`, B03 mail: wording only.
- `POST /share/{code}/events`: unchanged (already accepted both kinds).
- Schema: one nullable-free additive column. Protected routes: no existing field renamed or retyped; `Reply.author` becoming nullable is the same widening Answer already has (the one thing for the lead to note).

## Checks and results
- tsc: API ok, web ok (API test dir has a pre-existing `harness.ts` type-portability error caused by the shared node_modules symlink).
- eslint: clean on every file I wrote or edited in web (src, tests, e2e) and on the API files I touched (after `--fix` on my own new files and `card-renderer.ts`).
- API jest (scratch Postgres 55480, Redis 56480, dropped after): `test/talk test/feed test/mail test/reach test/me test/admin/moderation* test/app.contract.spec.ts`: 43 of 45 suites passed on the first run. The two failures were load timeouts on a machine at load average 17 to 20 (`talk/rt-limits.spec.ts` RT2 hit its 30 s timeout; `feed/ranking.spec.ts` "2,000 answers" saw 405 ms against a 200 ms bar); both pass when run alone straight after. New: `anon-reply.spec.ts` 8, `fixd-cards.spec.ts` 4, mail +1 (mail suite 20 passed).
- Web vitest: the 30 suites that import anything I touched passed except one timing flake in `talk.test.tsx` (two taps on Like) that passed on rerun; new `fixd-share` 10, `fixd-share-visit` 6, `fixd-outbox` 10, `fixd-anon-reply` 9, plus `v-anon` 12 and `w8b-reach`. Full suite not run (CI does).
- `next build`: one build, passed.
- Playwright (`e2e/fixd.e2e.mts`, built app, API stubbed in the browser, fake microphone): 12 of 12 passed. Covers: share sheet at 390 and 1440 (order of targets, Stories saves `voices-story-card.png`, square saves `voices-square-card.png`, INSTAGRAM_STORIES intent, Status href); events once each; offline free and priced paths; text reply switch at 1440 (on sends `anonymous: true`, a following named reply sends none, switch resets); 390 write screen; voice reply at 390 and 1440 (`kind: VOICE`, `anonymous: true`); unnamed reply reads Anonymous with the tag for its writer only (390 and 1440).
- Screenshots in `/tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/fixd/` (`shot-*.png`; API cards in `fixd-cards/`). I looked at the share sheet at 390 and 1440, the saved-card panel, the offline offer and sent notice, the voice reply sheet with the switch, and the writer's view of an unnamed reply.
- Schema: migration applied from scratch by jest global setup on the scratch database; rollback tested (it refuses with an unnamed reply present, drops the column otherwise).

## What I could not prove
- The board files do not render offline here (the canvas runtime leaves them unstyled), so there is no side-by-side picture of the boards. I matched the board markup instead: order of the ten targets, 5-column grid, 52px circle, 12px label, the sheet title and fine print.
- After the one build I made three small edits that the build and Playwright did not see, all covered by vitest only: the Outbox banner width on desktop (`dt:w-[560px]`, it was too narrow at 1440 in the screenshot: the text wrapped in a thin column) and its wording ("You recorded 25 seconds while you were offline"), and the sync event between a reply's text switch and its voice sheet switch. Worth a look on the next build.
- `/go` arrivals are not measured (see item 2).
- A real reconnect on a phone, and two tabs sending the same kept recording at once: the same-tab lock and the answer's Idempotency-Key prevent a double post, but two tabs could each create a clip first (one orphan clip, one answer).
- The unnamed-reply leak check is by route and by code reading; a future route that returns replies must hide the author the same way (the check list is in `anon-reply.spec.ts`).
- Housekeeping: while setting up I ran two jest commands without my database variables, so they used the machine's default test database on port 5432 (voices_test) and applied my migration there. I ran the rollback and removed the migration row at once; its test rows were truncated by the specs as every run does. Nothing else was touched.

## Did not touch
Web `src/features/units/*`, verify, messages and inbox screens, admin money/verification/ads screens, join pages; API `units`, `verify`, `dm`. None was needed.

## Round 1
- Migration folder renamed to `api/prisma/migrations/20261114200000_fix_d` (SQL unchanged; rollback header and this report updated). No other file named the old path.
- API: `origin/main` was already contained (nothing to merge). Web: merged `origin/main` cleanly (subscriptions, Plans). Contract rebuilt with `build.py`; the web's `contract/openapi.yaml` and `npm run api:types` produced no change (already identical).
- Outbox banner pictures: `scratchpad/fixd/shot-offline-offer-390.png` and `-1440.png`. 1440 was fine. At 390 the long text was squeezed into a thin column beside the button; the body is now "Saved while you were offline, N seconds." and the title stays "A recording is waiting" (price on the button). The 390 picture was taken on `next dev` after that text-only change, because only one `next build` was allowed (the build ran before the edit); vitest covers the wording.
- Checks: tsc both repos ok; API jest (own scratch DB/Redis, dropped) `anon-reply`, `fixd-cards`, `share`, `mood-card`, `mail`: 5 suites, 65 tests passed; web vitest `fixd-*`, `v-anon`, `w8b-reach`, `subscriptions`: 7 files, 81 tests passed; eslint clean; one `next build` ok; Playwright offline cases pass.
