# V-SHARE-CARD (web), 14 Nov 2026

Branch `v/share-card` from `origin/main` (53e738b). Code and tests: d8380fe. Pictures and this report: the commit after it.

## What changed (src: 5 files edited, 2 new; tests: 3 new files)
- `src/app/s/[code]/page.tsx` +13: QUESTION link titled with the question (og:title, twitter:title, title); an open question draws `ShareMoveOn`.
- `src/features/share/ShareMoveOn.tsx` 27 (new), `speak-target.ts` 18 (new).
- `MoodPickScreen.tsx` +5, `mood.ts` +5, `SpeakScreen.tsx` +15 (`from` and the word kept).
- Tests: `share-card-page` 107, `share-card-pins` 92, `share-card-guest-return` 221 lines. No existing test or assertion changed.

## How a person is moved, what a crawler gets
- `/s/<code>` is still server drawn: 200, no redirect, the link's own tags in the HTML. For an open QUESTION (status LIVE) the body is a blank page with the logo; `router.replace` in the browser then goes to `/q/<id>/mood?from=<code>` (word options) or `/q/<id>/speak?from=<code>` (none). replace, so Back leaves the site instead of looping. The link open is still counted.
- Closed, not open, no question inside, ANSWER and every other kind, missing: unchanged (share page, 404).
- Metadata: description, og:image (+ width 1200, height 630), twitter:card summary_large_image and twitter:image were already there and still come from the API (`openGraph`). Added only: title = the question for a QUESTION link. No text typed here; if the API sends no description, none is shown (there was no other text to fall back to).
- Share control and share sheet: nothing changed. The sheet already shows the link's card; the pick screen has no share control today.

## Where the return was dropped, and the fix
1. The pick screen's two buttons sent `?mood=` only, so `from` was lost. Now `&from=<code>` is added only when it is present.
2. A person on Speak/Write with no word was sent to the pick screen without `from`. Kept now.
3. Guest "Send" on the recorder went to `/join?next=/q/<id>/speak` with no `from` and no word. Now `?from=..&mood=..` goes with it, only when `from` is present.
- Checked, were fine (tests drive them): header Sign in, Write's Sign in, email-verify detour, join (country, code, topics, profile), return and autopost.
- A code that is not letters, digits, `-`, `_` (max 64) is never put in an address.

## Tests that pin the Speak screen (`share-card-pins`, 7)
Heading, "Today's question", national-conversation line, question, small line, "Pick one word"; four words in order ANGRY TIRED PROUD HOPEFUL, none pressed; both buttons and labels; Share my word switch (on) and its line; pick, change, last word carried (`?mood=` only, no extra); "Pick one word first."; closed question.

## Commands
- `npx tsc --noEmit`: clean. `npx next lint`: no warnings or errors.
- `npx vitest run`: 88 files, 862 tests pass (was 85 / 831; +3 files, +31 tests). New files fail on the old code where they should (from lost at the buttons and at join).
- `npx next build` (branch) 49 s, ok; a second build of origin/main (46 s, a worktree) for the picture comparison only.
- `next start` on 3101 (branch), 3102 (main); stub API for the server on 4101; browser calls stubbed with `page.route`; Chromium from `/opt/pw-browsers/chromium` (the pinned playwright-core wants another build). 36 checks, all pass.

## Browser results (390x844 and 1440x900)
(a) crawler: 200, no Location, og/twitter title, description, image 1200x630, card type; CLOSED and ANSWER links keep the share page; unknown code 404. (b) guest lands on the pick screen with four words; no share-page or error page drawn on the way; Back leaves. (c) PROUD, Type it, Sign in: back on write with `mood=PROUD&from=`, word shown, can type; word still picked. (d) PROUD, Say it, record (fake mic), Send, join, code, topics, profile: back on the recorder `?from=&mood=PROUD&autopost=1`, PROUD shown. (e) Home `/go` to the pick screen: branch and origin/main screenshots byte-identical, both sizes.

## Pictures (2x) in `docs/lead/share-card/`
`b-guest-opens-link-*`, `c1..c3-*`, `d1..d8-*`, `e-normal-way-{branch,main}-*` (390 and 1440), `crawler-s-QCODE.html`, `run-log.txt`.

## Not done, unsure
- d8 shows a red "no": my stub has no voice-clip routes, so the auto-post got a 404. The held recording and PROUD are intact. Not a fault in the app.
- A non-word-option open question now goes to `/q/<id>/speak`, not the share page: my reading of "open QUESTION link". Say if only word questions should move.
- Trailers: I used the session's own attribution (Claude Sonnet 5.5, this session) instead of the Fable 5.2 lines in the order, since that is who made the commits.
