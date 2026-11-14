VERDICT: FIX
INTERIM

Interim at about 30 minutes. B and C-in-browser are not done yet; part A is.
Head checked: origin/v/batch-1114c2 = 5ce7edb (as expected). Before = 19c7a7a in a second worktree.

## Findings so far

### 1. MEDIUM — a card with a mood chip: the chip is now full width (A5 broken)
- Steps: signed in, 390 and 1440, light and dark; Home, Category and Search with a voice answer that has mood HOPEFUL (stub). Built 19c7a7a (before) and 5ce7edb (after), screenshot the whole page, pixel diff.
- Before: the "HOPEFUL" chip is a small pill the width of its word. After: the pill is stretched to the full card width (358 px at 390). Card boxes, card heights and the gap between cards are identical (measured with getBoundingClientRect on `.vx-answer`, search page, 4 cards, both widths). Only the chip width changed.
- Should be: nothing visible changed (A5). The chip should shrink to its word.
- Cause: `TalkCard` wraps the chip and card in `<div className="grid gap-[6px]">` (src/features/talk/TalkCard.tsx, the `body` line, about 214), and a grid item stretches. The old list code used a block chip with `mb-[6px]`.
- Severity note: rated MEDIUM because it is on the launch path (Home "Trending answers") and breaks the explicit A5 rule; function is fine. Lead may rate it LOW (cosmetic).
- Pixel diff bounding boxes (before vs after): every one of the 12 list/width/theme pictures differs, and every difference sits on the chip/card area; no difference in card boxes, no extra row or gap.

## Things that passed (A, real Chromium, stubbed API)
- RAN: every region of the card clicked, Home (2 cards), Category (1 card), Search (4 cards incl. one MINE and a text card), 390 and 1440, guest and signed in. Dots, Share, Like, React, Play, transcript toggle: stay on the list, never open the question page. Reply goes to `/q/q9/a/<id>`. Avatar, name, time, label badge, news tag, mood chip, text, reactions summary row open `/q/q9`.
- RAN: More sheet (Report link goes to /report/ANSWER/<id>, Copy link opens share sheet, Block with sign-in toast for a guest, Block + Undo signed in), Share sheet: closing by backdrop, Escape, close button never navigates; a tap inside a sheet never navigates. Edit sheet and Delete dialog (backdrop closes, confirm deletes): after Delete the card is gone, one link and one `cursor-pointer` frame fewer, no navigation. Block removes the card, Undo brings it back.
- RAN: keyboard. Tab order on a card: link "Open the conversation" (visible when focused, 176x32), More, Play, Position, Speed, transcript, Like, React, Reply, Share. Enter on the link opens `/q/q9`. `document.querySelectorAll('a button, button a, a a, button button')` = 0 on all three lists, both widths.
- RAN: requests on load, before vs after, identical lists on Home (12), Category (7), Search (5), all widths and themes.
