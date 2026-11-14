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
