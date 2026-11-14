# V-PEOPLE-ON-POSTS web report (14 Nov 2026)
Branch v/people-on-posts. Commits: item 1 bf907ff, item 2 8f981f0, item 3 95980b2, layout fix and screenshots: see the last commit on the branch.
API branch: NOT readable (git clone of v/people-on-posts on the API repo said "Remote branch not found", tried at start and at the end). So contract/openapi.yaml and src/lib/api/types.ts are unchanged; `admin` is read as `(author as {admin?: boolean}).admin === true`, and the limit from costs.textMaxChars with a fallback. Re-run `npm run api:types` once the branch exists.

## Item 1: picture wherever the name shows
Fixed: answerCardProps (feed-format.ts, so Home, question list, thread parent, search voices, category, share via TalkCard), search People rows (SearchScreen), result comments (results/map.ts + ResultComment draws avatar), what-next proposals (ProposalCard new `avatarSrc`), admin results row, admin news row.
Already right: profile rows and reply rows (PostRow), profile header (ProfileCard), thread replies (ThreadScreen), share page, news card and news reply, question avatar stack, edit profile.
No picture exists in the API shape (left as initials): friends list, admin moderation author, notification actors, own-name preview on PostResultPage. No DM screens on this branch.
Fallback: `Avatar` (vx/identity.tsx) now swaps to the initials on an image error (and resets when src changes); the circle is a fixed CSS size so nothing moves; img is loading=lazy, decoding=async, alt="".
Nameless post: author is null, so the card gets { name: "Anonymous" } with no avatar; nothing fills one from the signed-in profile. The writer's "Posted without your name" row is unchanged.
CSP: none is set anywhere (next.config.js, middleware, layout), so there was nothing to allow and nothing was changed.
Upload (uploadAvatar, EditProfilePage): read the code and the existing tests (w1-entry, w6-media). Flow is POST /uploads, PUT bytes, POST /uploads/{id}/complete, PATCH avatarFileId, with plain error words. No fault found. I did NOT drive a real file choice in a browser.

## Item 2: Admin pill
New `AdminPill` (vx/labels.tsx, the neutral Badge, class vx-admin-pill). Drawn after the name (and after the sponsor tick) in AnswerCard (new `author.admin` prop, no fork), thread parent (same card), reply rows in ThreadScreen and PostRow, profile rows, ProfileHeader (new `admin` prop, fed from ProfileCard). Not drawn when the post has no name. No DM screens here.
Long name: the name sits in its own span (vx-answer__nm) that truncates; the tick and pill are flex-none, so the three dots stay inside the card. Measured in Chrome at 390 and 1440, light and dark: dots inside the card on every card.
Two layout faults found and fixed on the way (a long handle made the page scroll sideways at 390): grid lists now use minmax(0,1fr) columns (feed Answers, question Voices list, thread replies) and .vx-answer__who clips.

## Item 3: 2,500
Limits known: Write screen (WriteScreen), reply composer (ReplyComposer), edit sheet (OwnPost), question page line "write up to N characters" (QuestionScreen), proposals (ProposePage, left as it was: reads config only), held draft (no limit of its own; an over-long saved draft is shown with the counter at its limit and the server refuses it with its own words). No `5000` text limit existed in src.
One constant, TEXT_MAX_CHARS_FALLBACK = 2500 (features/talk/textLimit.ts). textLimit(costs) reads costs.textMaxChars (/me/allowance or /config/public); the edit sheet reads /config/public itself. Composer now shows "Keep it to 2,500 characters." at the limit; edit sheet has its own counter and the same words. failText shows the server's own field message on VALIDATION_FAILED. Free-post note untouched.

## Tests
New: tests/people-avatar (4), people-admin (3), people-limit (4). Assertions changed: none (fixtures with textMaxChars: 5000 are stub data, not asserted rules).
Commands: tsc --noEmit (only e2e/ files complain, as on main before node_modules were installed; src clean), next lint: no warnings, vitest run: 88 files, 842 tests pass, next build ok.
Browser: next build + next start, Playwright, API stubbed with page.route; Home, question, thread, profile at 390x844 and 1440x900, light and dark, deviceScaleFactor 2; no sideways scroll in any of 16 shots. Script: docs/lead/people-on-posts/shoot.mjs. Shots: docs/lead/people-on-posts/*.png.
Speak screens: not touched; they use none of the shared pieces I changed (Avatar, Composer, AnswerCard); their tests pass. No before/after screenshots taken.

## Not done or unsure
API contract not synced (branch missing). Upload not driven in a browser. The broken-picture case is covered by a unit test, and the stub routes it to a refused address in the shots.
