# V-PEOPLE-ON-POSTS web join report (14 Nov 2026)
Head commit: see `git log -1` on origin/v/people-on-posts (the last commit, the one without [skip ci]).

## What was joined
Step 1 done: `origin/main` (8fa75a3) merged with --no-ff. Step 2 NOT done: `origin/v/rel-w3` does not exist on origin (checked with ls-remote; only v/rel-w2, v/share-card and v/anon exist). I did not guess and merge other branches. The share card return path (v/share-card) and nameless replies with offline sending (v/anon) are therefore NOT in this join. The contract (below) already carries the nameless reply fields, so the pieces still to come fit.

## Contract
Taken from the server repo: `v/rel-d2` does not exist there, so `docs/contract/openapi.yaml` from its `main` (18704b8), then `npm run api:types`. It still has no `admin` field on an author, so the pill reads `author.admin === true` defensively (nothing shows until the server sends it). avatarUrl is present. textMaxChars exists.
Side effect: this contract makes a reply's `author` nullable (nameless replies). main's code did not handle that, so tsc failed in three places. Fixed with a minimal null path (a nameless reply shows "Anonymous", no handle, picture or pill): `ThreadScreen.tsx` ReplyRow, `PostRow.tsx` ReplyRow, `NewsPostPage.tsx` ReplyCard. This is a small start on the v/anon work, not the whole of it (no "anonymous" switch on the reply composer, no offline sending).

## Conflicts (all resolved, both sides kept)
- contract/openapi.yaml: whole file from the server main (see above).
- src/lib/api/types.ts: regenerated.
- components/vx/helpers.ts (AnswerCard author): both `admin` and `verified` fields.
- components/vx/conversation.tsx: name in `.vx-answer__nm` span, then sponsor tick or verified tick, then the Admin pill only when there is a handle (nameless: no pill); ProposalCard keeps `avatarSrc` and `verified`.
- components/vx/profile.tsx: handle plus verified tick in the h2, Admin pill beside it.
- components/vx/vx.css: kept my `.vx-answer__who` clipping and `.vx-answer__nm` rule, plus main's `.vx-tick` rules.
- features/admin/ResultsPage.tsx: main's wrapping/min-w-0 layout plus my avatar src.
- features/profile/PostRow.tsx: imports `useEffect`, AdminPill, IconButton, OwnVoiceFlow (edit and delete kept); reply row has name, VerifiedTick, Admin pill.
- features/talk/QuestionScreen.tsx: imports of textLimit and ComingUpQuestion.
- features/talk/ReplyComposer.tsx: InView, needsNewKey and textLimit all kept.
- features/talk/ThreadScreen.tsx: name, VerifiedTick, Admin pill.
- features/talk/WriteScreen.tsx: needsNewKey and textLimit both kept.
- features/vote/WhatNextPage.tsx: `avatarSrc` and `verified` both passed.
- lib/feed-format.ts: author carries avatar, verified and admin; a nameless post stays `{ name: "Anonymous" }`.
(Line numbers are gone with the markers; the list above is every file git reported as conflicted.)

## Checks
- tsc --noEmit: clean. next lint: no warnings. next build: ok.
- vitest run (whole suite): 114 files, 1,202 tests, all pass. No existing assertion changed. New: tests/people-nameless-reply.test.tsx (2). Nameless post tests (people-admin, people-avatar), 2,500 tests (people-limit), edit/delete, admin phone and Users tests all pass.
- DMS_LIVE is still `false` (src/features/dm/live.ts). The browser run made no /dm/ call.
- src/features/speak/ is byte-identical to origin/main (git diff empty), so the record screen is main's.

## Browser run (Chromium, API stubbed, 390x844 and 1440x900)
Script docs/lead/people-on-posts/join-check.mjs, shots join-*.png in the same folder.
- Thread and question page: admin with picture (picture + Admin pill), plain person (initials), picture that fails (falls back to initials, no broken image), nameless (Anonymous, no picture, no pill). Same at both sizes.
- Write screen: 2,499 shows the counter 2,499 / 2,500 and no limit line; 2,500 and 2,501 both stop at 2,500 with "Keep it to 2,500 characters."
- /speak?q=: opens with "Tap to record", the seconds, "Write instead".

## Could not prove
- v/rel-w3 and its record flow changes (Pick one word, Say it in N seconds, Type it instead) are not on this branch because the branch is missing; only main's Speak screen was loaded in the browser, not driven through a recording.
- The Home screen record link was not found by my selector, so I opened /speak directly.
- Share card return path and offline nameless replies: absent (see top).
- Admin pill from a real server: the server does not send `admin` yet.
