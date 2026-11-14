# V-DM report

Branches: API v/dm head abcf326 (base 537ec96, merged origin/v/subscriptions 6a71fdd), web v/dm head 51a1b20 (origin/main and origin/v/subscriptions merged). Both pushed. No PR, no merge to main.

## Built (API)
- Migration 20261114140000_direct_messages (+ rollback.down.sql): tables DmConversation, DmMessage, DmMute; UserSettings.dmOpen (default true); enum values VoiceClipPurpose DM, ReportTargetType DM_MESSAGE, ChargeAction DM_TEXT and DM_VOICE.
- Gate in ONE function: api/src/dm/dm-access.ts canSendDm (today: a running subscription). Refusal 403 verification_required.
- Routes under /api/v1/dm: POST messages (Idempotency-Key), GET conversations, GET conversations/{id}/messages, POST conversations/{id}/read, PUT/DELETE conversations/{id}/mute, GET unread, GET with/{userId}, GET limits. Reports go through POST /reports with targetType DM_MESSAGE into the REPORTED moderation queue (moderation service reads, removes and restores them).
- Per the design rulings: prices from config dm.text_price_milli (per 150 chars, proportional) and dm.voice_price_milli, both default 0 (free); dm.voice_max_seconds default 60; own cap dm.messages_per_day default 100, not counted in the 20 posts a day. Charged via the existing ledger (new actions DM_TEXT/DM_VOICE), only when stored, reversed if the store fails.
- Block (blocked), dmOpen off (dm_closed), suspended/banned/deleted receiver (recipient_unavailable), suspended sender (ACCOUNT_SUSPENDED), no self-message. Account deletion blanks the sent messages and removes clips; ledger/charge rows stay. Voice clips use purpose DM and play only for the two people.
- Contract (routes.py, schemas.py, build.py, CONVENTIONS.md, openapi.yaml regenerated) updated.

## Built (web)
Messages inbox and chat per the boards (tabs All/Unread, rows, mint unread, voice preview, privacy line, New message people search, More menu Mute/Report/Block, day divider, bubbles with time, transcript when present, mic/send round button, caption with the configured seconds), messages icon with unread dot polled every 30 s, Messages row on Me, "Message @handle" in the profile More menu, "Let people message me" switch in settings, 403 verification_required prompt linking to /units/buy (plans).

## Checks
- tsc API and web: clean. eslint on my files: clean.
- API jest on a fresh scratch DB after the subscriptions merge: test/dm 43/43, units, talk, me, shared, launch, app.contract, admin 220/220: all pass. The dm spec covers: no subscription, blocked, dmOpen off, suspended sender and receiver, double send with the same key (sequential and parallel, charged once), two sends racing on a balance for one, a send that fails to store (reversed, count given back), a block landing mid-send, 101st message, own cap not the 20, 5,001 chars, 61 s voice, someone else's conversation (404), mute, report and moderation removal, deletion, free (0) and priced cases.
- Web vitest tests/dm.test.tsx 25/25 and tests/subscriptions.test.tsx 20/20.
- One existing test edited: api/test/me/me.spec.ts pins the whole settings object; added dmOpen: true (additive field). Verifier please look.

## Not proven / open
- Pictures (before/after against the boards): not made; the machine was overloaded and I did not run a build. Screens are matched to the board markup by reading it, not by comparison.
- Desktop (1440) layout follows the 390 boards plus the described desktop header; not compared visually.
- The verify merge: v/verify has no "Round 1" head yet, so I did NOT merge it. Still to do when told: merge origin/v/verify, replace the body of canSendDm with isVerifiedNow (api/src/verify/verified.ts; select verifiedUntil and verificationStatus), update the three spec cases (subscriber not yet approved cannot send, approved can, lapsed cannot; helper `subscribe` in api/test/dm/dm.spec.ts is the one place to change), and restore the DM sentence on /verify and in mail E13.
- ConfigReader caches dm.* values for 5 s (limits and voice max); the ledger reads config uncached.
- Send uses the existing "post" rate bucket (20 per 10 minutes), which is stricter than the 100-a-day cap.
- Web contract/types were regenerated from the merged backend contract. Data export does not include DMs.
- Mistake to note: one early full jest run used the shared voices_test database and applied then rolled back my migration there (rollback.down.sql run, _prisma_migrations row deleted); other builders' runs in that window could have seen it. Scratch DB voices_dm_scratch dropped; my processes stopped.

# Round 1

Heads: API v/dm d3ea61c (merged origin/v/verify a222398), web v/dm e0a97cb (merged origin/v/verify 11f064c). Both pushed.

- Merge: conflicts only in schema.prisma, contract build.py and schemas.py (kept both sides, ErrorCode union). Contract regenerated with build.py, copied to web, `npm run api:types` run; no generated file edited by hand.
- canSendDm now calls isVerifiedNow (reads verifiedUntil and verificationStatus). 403 stays verification_required. Specs: approved and running can send; a subscriber with no status or PENDING cannot (and once approved the same person can); REJECTED, EXPIRED, lapsed plan, no plan cannot; a stored send still replays after lapse.
- Web 403 prompt now links "See how to get verified" to /verify.
- DM sentence: /verify "what you get" and the verified state say "you can message other people"; E13 html (preheader and box) and text say "message other people". The web test that said no screen mentions DMs now expects the line (and no dash); API spec checks E13 html and text.
- verified field on DmPerson (API contract and responses), the tick shows beside the name in inbox rows and the chat header (VerifiedTick).
- Own rate bucket "dm" (ratelimit.dm_per_min, default 30 a minute, in the admin catalogue); spec shows a DM burst does not block an answer and the reverse.
- Data export: directMessages section (sent and received text, times, other handle, voice length only, no file or clip id); spec reads the stored export.
- Checks: tsc both repos clean. API on a fresh scratch DB with all migrations: test/dm 46/46 (after adding the mail test: dm, admin ops, moderation, launch 123/123), test/verify 46/46, test/me 108/108, test/units 110/110. Web vitest dm + v-verify 52/52, plus tests/subscriptions earlier. `next build` passed.
- Not run: full suites, pictures against the boards. Scratch DB dropped, my processes stopped.

# Round 2

Heads: API v/dm b1a6afc, web v/dm 5fb4a50 (both pushed). Pictures: web branch, docs/lead/dm/r2/ (inbox-390, inbox-1440, chat-390, chat-menu-390, chat-1440, chat-menu-1440; built app, stub API through browser routes, boards in docs/lead/dm/boards/ on origin/verify/v-dm). Compared by eye with the boards: 1440 inbox (title, tabs pill, search, rounded list card, outlined New message, Trending rail) and chat (back row, bordered header card, menu, composer in a white card) now follow them; 390 rows edge to edge, compact tabs.

API: 1 one refusal dm_unavailable "This person is not taking messages." (blocked either way, messages off, suspended, banned, leaving; unknown or deleted 404). 2 acceptsMessages on the chat page and the inbox row. 3 notice "A message of yours was taken down", POST /appeals accepts DM_MESSAGE (sender only, once). 4 wallet history and CSV "Direct message" / "Voice message". 5 one audit row (moderation.read_dm, who, item, never the content) when a moderator opens a reported DM. 6 ADD VALUE IF NOT EXISTS on every enum value. 7 a DM clip refuses extraVoiceTokenId (422). Contract fixed and regenerated (a quoting slip in routes.py had made build.py fail silently earlier; now byte-identical, test/launch 7/7), web types regenerated.
Web: 8 shell-bar tests rewritten stricter (exactly one /notifications/unread-count and one /dm/unread per mount, shared by phone and desktop; guest none). 9 opens at the newest message and after my own send (scrollIntoView with margin for the composer); long unbroken text has min-width and overflow-wrap rules, not tried with 200 messages in a browser. 10 Retry button beside the error, focus back to the field (field is read-only while sending, not disabled). 11 Unread tab is the sum of unread messages. 12 closed chat: no Say hello, no composer, only the one line; deleted account and acceptsMessages false the same, history readable. 13 More menu: aria-expanded, focus in, Escape, click outside, focus back. 14 maxChars from /dm/limits. 15 boards matched (see pictures). 16 guest sees no search or plus; muted bell and "Muted"; recording line on one line; no tab highlighted and a plain messages icon; no More menu on your own profile; dir="auto" on bubbles.
Checks: tsc and eslint both repos clean. API (fresh scratch DB): test/dm, test/admin (whole), test/units, test/me, test/launch all pass (dm now covers the round 2 cases). Web: whole vitest suite 88 files, 894 tests, all pass; next build passed (twice).
Not proved: a 200-message chat and a long link in a real browser; the 1390 px band between phone and desktop; dark theme after the CSS changes; real API behaviour (stub only). Stopped: all my servers, jobs and the scratch DB.
