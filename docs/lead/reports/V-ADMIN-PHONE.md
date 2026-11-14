# V-ADMIN-PHONE: the admin on a phone

Branch `v/admin-phone`, draft PR #22. All 15 admin pages done. Users: not on this branch (see below).
Commits: 79b3805 (frame, shared pieces, Money, Verification, Moderation), 26ef0eb (screenshots, first report), final commit is the branch head.
(Trailers follow the session's attribution lines: Claude Sonnet 5.5 and this session's id, not the names in the order.)

## What changed
- "Open the admin on a computer." is gone. Below 1024 px: top bar (VOICES admin mark, page name, Menu button). Menu = sheet with the same pages, counts and role rules as the sidebar, Sign out at the bottom. From 1024 px the frame is the same markup as before.
- Shared pieces made responsive in place (same names, same props): TableFrame (rows stack into cards below 1024 px; column names are read from the header, so any page, the Users page too, gets it free), PageHead, Card, Td/Th untouched. New: DetailPane, StackTable, useStackLabels. Icon `menu` added to the shared icon set.
- Below 1024 px: small buttons, icon buttons, segmented tabs, chips, selects are 44 px or more; switches have a 44 px hit area (same trick the chips already use).

## Per page on a phone (S = stacked rows, P = detail opens full screen with "Back to the list")
- Users: not on this branch. Shared table pieces are ready; nothing else to do here.
- Money overview S (Today, Last 7, Last 30 under each figure). Payments S, Subscriptions S. Wallet: form, confirm panel, ledger S, recent payments S. Prices: settings, pack and plan editors (one field group per pack or plan; the column headings above them are hidden on a phone, each field keeps its own label), change log S.
- Verification P (documents, Approve, Reject with reasons). Moderation P (post, appeal, action tabs, reason, buttons, audit trail).
- Today: tiles and lists one column. Calendar: week list stays a short table (3 columns fit), week panel is P, rows re-laid for a narrow screen. Pool: add box then list, row buttons wrap. Override: form one column, log S, Go live dialog fits. Results P, News P, Ads: list S, advert preview, review and form P. Weekly: one column.
- Nothing is hidden on a phone that a computer shows, except the pack and plan column headings above.
- Could not make fit: nothing known. Not tested: a real phone keyboard (Chromium cannot open one); forms scroll inside their pane and every field is reachable.

## Assertions changed
None. No existing test asserted the "computer" line. Added tests/admin-phone.test.tsx (10 tests).

## 1440 before and after
Build of origin/main (`git worktree add ../voices-main`), same stubbed API, 15 pages, full-page screenshots at 1440x900, compared pixel by pixel: 15 of 15 identical. Only the default state of each page was compared (no clicks).

## Commands and numbers
- `npx next build` (once per code change), `npx next start`, Chromium via Playwright: 15 pages x (390x844, 768x1024) = 30 runs: scrollWidth equals viewport width on all 30; menu opened (10+ links) on all 30; one pane, dialog or confirm opened and closed per page; no control under 44 px (switch hit areas count). Command: `ORIGIN=... node --experimental-strip-types e2e/admin-phone.e2e.mts phone|desk` (fixtures in `e2e/admin-phone-fixtures.mts`: 20 rows, long handles, large numbers).
- `npx tsc --noEmit` clean. `npx next lint` clean. `npx vitest run`: 103 files, 1124 tests passed.

## Screenshots
`docs/lead/admin-phone/`: `<page>-390.png`, `<page>-768.png`, `<page>-<width>-open.png`, `menu-390.png`; `desktop-1440/before` and `after`.

## Unsure
- Calendar and Pool phone layouts were checked by eye on screenshots at 390 only for the first screen of the open panel.
- The sheet for the menu is the shared Sheet (focus trap, Escape, tap outside).
