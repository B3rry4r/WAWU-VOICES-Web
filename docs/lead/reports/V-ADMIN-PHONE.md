# V-ADMIN-PHONE (first four: Money, Verification, Moderation; Users not on this branch)

Branch `v/admin-phone`. Status: first four done and pushed; the other eight pages are next (see "Not done yet").

## What changed
- The line "Open the admin on a computer." is gone. Below 1024 px the frame is a top bar (VOICES admin mark, page name, Menu button). The Menu opens a sheet with the same pages, counts and role rules as the sidebar, and Sign out at the bottom. From 1024 px the frame is the same markup as before.
- Shared pieces made responsive in place, same names and props: `TableFrame` (below 1024 px each row is a stacked card, the column name above each value, read from the header so any page, including the Users page, gets it for free), `PageHead`, `Card`. One new shared piece, `DetailPane` (list pages: the detail opens full screen with "Back to the list"). Icon `menu` added to the shared icon set.
- Small buttons, segmented tabs, icon buttons and selects are 44 px or more below 1024 px (admin.css).

## Per page on a phone
- Users: not on this branch. The shared table pieces are ready for it (stacked rows with no change to the page).
- Money overview: figure tables become stacked rows (Today, Last 7 days, Last 30 days under each figure); headline tiles one column.
- Payments, Subscriptions: stacked rows (the main job is reading a list). Re-verify and its confirm panel reachable.
- A person's wallet: Find form, balance tiles one column, Change their balance form with confirm panel, Ledger and Recent payments as stacked rows.
- Prices and limits: each setting stacks its value and buttons; pack and plan editors are one field group per pack or plan (column headings hidden on a phone because each field has its own label); Change log stacked rows with Put back.
- Verification: queue is the page; tapping a person opens the documents full screen (Show the ID, Show the bill, Approve, Reject with reasons) with "Back to the list".
- Moderation: same pattern; the post, appeal, screening, action tabs, reason, buttons and audit trail are in the full screen pane.
- Nothing is hidden on a phone that a computer shows, except the pack and plan column headings above.

## Assertions changed
None. No existing test asserted the "computer" line. New: `tests/admin-phone.test.tsx` (9 tests).

## Proof so far (numbers in the final update)
- Real Chromium, `next build` and `next start`, API stubbed (20 rows, long handles, large numbers): 7 pages at 390x844 and 768x1024, `scrollWidth` equals the viewport width on all 14, menu opens, one pane or confirm panel opens and closes per page, no control under 44 px.
- Screenshots: `docs/lead/admin-phone/` (`<page>-390.png`, `-768.png`, `-open.png`, `menu-390.png`).
- Harness: `e2e/admin-phone.e2e.mts` with `e2e/admin-phone-fixtures.mts`.
- `npx tsc --noEmit` clean; `npx next lint` clean; `npx vitest run`: 103 files, 1123 tests passed.

## Not done yet
Today, Calendar, Pool, Override, Results, Weekly, News, Ads; the 1440 before/after comparison of every page.
