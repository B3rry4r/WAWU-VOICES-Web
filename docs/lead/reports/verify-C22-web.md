VERDICT: FIX

Checked head: origin/v/batch-1114c2 = 5ce7edb (as expected; my first local checkout was stale, a `git fetch` brought it). Before = 19c7a7a in a second worktree. Real Chromium (Playwright) against `next start` builds of both, API stubbed with `page.route`, no live service called. No HIGH found. Two MEDIUM findings.

## Findings (most severe first)

### 1. MEDIUM — C1 broken with a SLOW device clock: the page asks 40 s after the opening, not within 0–5 s
- Steps: Home `/` at 390 wide, guest. Stub: `/home` and `/questions/today` send status SCHEDULED until the real instant `opens` = (start + 20 s), then LIVE. `Date` header of every answer = real time. Device clock set 10 minutes SLOW by an init script that overrides `Date` (not `performance.now`). Watched 90 s.
- Happened: requests at -19.8 s (the page load) and then at **+40.2 s** after the opening. In a second run with the opening 5 s after load and 30 s of watching: no ask at all after the load (still "Coming up" 25 s after the opening).
- Should: ask within 0–5 s (+100 ms) of the real instant (C1).
- Why: `useStartWatch`: the server-corrected guess is the early one, the slow device guess is the late one (10 min away). `split` is true and `light` is true at the early guess, so line 153 counts the page load as the first ask (`tries = 1; lastAsk = now - age`) and the next ask is 60 s after it (`LIGHT_MS`). The code cannot tell that the header-corrected clock (`measured: true`) is the right one. File: `src/components/feed/useLoad.ts:147-165` (especially 153). Not changed by C22 (the diff only rounds the timers up), but it is rule C1.
- Way round: a reload or tab refocus; the page opens by itself within about 60 s of loading. Rated MEDIUM, not HIGH, for that reason.
- Clock right: first ask at +2.2 s (Home, 100 s lead) and +1.9 s (20 s lead). 10 min fast: asks at -59.8 s (the once-a-minute early ask) and at +0.2 s / +0.9 s. Fast clock never asked more than once a minute.

### 2. MEDIUM — A5 broken: on a card with a mood chip the chip is now the full width of the card
- Steps: signed in, Home, Category, Search; 390 and 1440, light and dark. Stub answers with mood HOPEFUL / TIRED. Full-page screenshots of before and after, pixel diff, plus getBoundingClientRect of `.vx-answer` and of the chip.
- Before: the chip is a small pill the width of its word (84 px "HOPEFUL", 61 px "TIRED"). After: stretched to the card (358 px at 390, 640 px at 1440). Card boxes, card heights and the gap between cards are identical (Search, 4 cards: `[16,193,358,376] [16,581,358,226] [16,851,358,163] [16,1026,358,196]` both before and after; same at 1440).
- Should: nothing visible changed (A5). The pill should stay the width of its word.
- Why: `TalkCard` draws the chip and card in `<div className="grid gap-[6px]">` and a grid item stretches (`src/features/talk/TalkCard.tsx:215`). The old list code used a block chip with `mb-[6px]`. If the conversation page shows the same full-width pill, then the page already has it and the list now matches the page; but A5 says the list must not change.
- Cosmetic, no click or data effect, but on the launch path (Home trending cards that carry a mood). Lead may rate LOW.
- The 12 pictures (3 lists x 2 widths x light/dark): the only visible difference is the chip width. With the chip rows masked, 0 pixels differ at 390; at 1440 31–49 pixels differ by at most 11 of 765 on the card's rounded bottom corners (sub-pixel anti-aliasing, not a layout change).

### 3. LOW — letting go of a mouse drag inside a text answer opens the question
- Steps: Search, 390 and 1440, guest and signed in: press at the start of the text of a text card, drag to its end, release.
- Happened: lands on `/q/q9`, selection gone. Should: a selection should not navigate. Phone long-press selection was NOT tested (no touch run), so I cannot say whether copy on a phone is broken.
- File: `src/components/feed/parts.tsx` `OpenOnTap` onClick (no `getSelection()` check).

### 4. LOW — the keyboard link has the same name on every card
- "Open the conversation" for each card, with no question text; a screen-reader link list is a row of identical links. READ (parts.tsx:49) and seen in the tab order. Works (visible when focused, 176x32, Enter opens `/q/q9`).

## What passed (A1–A6, B1, C1 except finding 1)

A (RAN, Home 2 cards, Category 1, Search 4 incl. one MINE and a text card; 390 and 1440; guest and signed in):
- Dots, Share, Like, React, Play, speed, transcript toggle: never left the list. Reply goes to `/q/q9/a/<id>`. Avatar, name, time, label badge, news tag, mood chip, text, reaction summary open `/q/q9` (A2).
- More sheet: Report link (`/report/ANSWER/<id>`), Copy link (opens share sheet), Block (guest: sign-in toast; signed in: card leaves, Undo brings it back), Edit, Delete + confirm (card gone, one link and one frame fewer, no navigation). Closing More, Share, Edit, Delete by backdrop, Escape and close button, and tapping inside a sheet: never navigated (A3).
- React tray: opens, a reaction is picked, closes on Escape and on outside click; no navigation. Guest React: sign-in toast, one toast in the DOM, on a second tap still one.
- Keyboard: tab order on a card: link, More, Play, Position, Speed, transcript, Like, React, Reply, Share. `document.querySelectorAll('a button, button a, a a, button button')` = 0 on all three lists at both widths; same for `[role=button]` nesting (A4).
- Requests on page load, before vs after: Home 12, Category 7, Search 5, identical lists in every width/theme.
- Signed in: Like = one `PUT /answers/<id>/like`, count 3 -> 4; with a 500 the count goes back and one toast shows. React = one `PUT .../reaction`; with a 500 it goes back to "React" and one toast.
- Category: the hidden list variant (`display:none`) holds 1–2 links that are not focusable and not exposed (tabbed ~58 stops, none on a hidden element); one toast, no extra requests on click.
- Home with `trending: []`: no card, no link, no "Trending" text, no page error (the one `role=alert` is Next's route announcer; READ, not isolated).
- A hidden card (deleted, blocked author) draws no frame (`TalkCard` returns null before the frame, `TalkCard.tsx` the `if (authorBlocked || gone) return null`); seen after Delete and Block.
- Two cards playing: RAN only that Play on a list card calls `GET /voice-clips/<id>/play` and `POST /answers/<id>/listen` and stays on the list; whether the first stops when the second starts was READ only (same `TalkCard` / `useClipPlayback` as the conversation page), not observed, because the stub audio does not play.

B (RAN, 390, signed in, both writers, stubs for the two POSTs): 500, 502, 504, 429, aborted request, then 201: both sends carry the SAME key. 409 CONFLICT "Start again with a new key", then 201: the keys differ, banner says "That did not post. Tap Post to try again.". 400, 403, 404, 422, plain 409, then edit text and send: same key on the second send; if the server answers IDEMPOTENCY_KEY_REUSED to that (contract: same key, other body) the third send carries a new key and succeeds, so at most two more taps. Double tap: 1 request for each writer. After success the page shows "Posted" / goes to `/q/q1/next`.

C (RAN): see finding 1 and the table.

## What I ran

| Item | Result |
|---|---|
| `npm ci` | ok |
| `npx tsc --noEmit` | exit 0 |
| `npx next lint` | no warnings or errors |
| `npx vitest run` (whole) | 98 files, 1023 tests, all pass, 45 s |
| `npx vitest run tests/round3.test.tsx` x30 | 30 pass, 0 fail (37 tests each) |
| `npx next build` (5ce7edb) and (19c7a7a) | both ok; `next start` on 4101 / 4102 |
| Region click run | Home/Category/Search x 390/1440 x guest/in, ~190 clicks, 0 control opens the question page, 0 body regions fail to open it |
| Sheets/dialog/tray run | 4 combos, see above, 0 navigations from a sheet |
| Nested interactive query | 0 on all lists, both widths |
| Load requests before/after | Home 12/12, Category 7/7, Search 5/5, identical |
| Pictures 12 (3 lists x 2 widths x light/dark) | boxes and gaps identical; chip wider (finding 2) |
| B matrix | 2 writers x (6 same/new-key cases + 5 plain cases x 2 server modes) + double tap, all as above |
| C right clock | first ask +1.9 s (20 s lead), +2.2 s (100 s lead, 110 s watch); 3 requests in 110 s; 0 timers under 1 s |
| C 10 min fast | asks at -59.8 s and +0.2 s (120 s lead), +0.9 s (20 s lead); 4 requests in 130 s |
| C 10 min slow | +40.2 s (20 s lead, 90 s watch); none in 30 s with 5 s lead — finding 1 |
| `/q/q9` (question page) with the clock test | right +3.8 s, fast +1.0 s, slow none in 32 s |

Not done: phone touch emulation (long-press select), a real two-voices-playing observation, Category/Search with a transcript still PENDING.
