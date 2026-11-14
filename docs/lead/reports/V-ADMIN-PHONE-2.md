# V-ADMIN-PHONE-2

Branch `v/admin-phone-2`. Code head: `432cfdc` (the commit after it only adds this report). First fix commit: `bf18ca2`. No pull request opened, as asked.

## What changed

| # | Finding | Fix |
|---|---|---|
| 1 | Users numbers scroll sideways | `UsersPage.tsx:92` cards stack in one column below 1024 (`grid-cols-1 dt:grid-cols-3`); the number wraps anywhere, cards have `min-w-0` (`:35-36`). Row link is a 44 px flex box below 1024 (`:156`). |
| 2 | Controls under 44 px | Admin switch (`ui.tsx:104`): the button is 44 tall below 1024 and 32 at 1024 and up; the pill is drawn inside it, so the look at 1440 is the same. Day pickers (`CalendarPage.tsx:319`) and "Get a new link" (`VerificationPage.tsx:59`) get a 44 px minimum below 1024. The old rule that only grew the switch's hidden hit area is gone from `admin.css`. |
| 2b | Found by my own run: the Plans editor on Prices has the design-system switch ("On sale"), 52x32 | `admin.css:66-67`: 44 px tall below 1024 only. |
| 3 | Calendar table clipped at 320 | `CalendarPage.tsx:128` `overflow-hidden` is now `overflow-x-auto`. It scrolls in its own box, corners kept. (`TableFrame` in `money/parts.tsx` already scrolled on main; the clipping box was the one in the Calendar page.) |
| 4 | Prices at 320 after "Change" | The Review and Cancel buttons did not wrap. `PricesPage.tsx:41, 98, 154` now `flex-wrap`. |
| 5 | Long email at 390 | Cell wraps anywhere (it already had `overflow-wrap:anywhere`); with the cards stacked it now fits. Measured: whole cell inside the screen, nothing cut. |
| 6 | Three-dot names | `PostRow.tsx:41, 70`: "More: edit, delete, copy link. Post: <first 6 words>", else "Voice from <time>". |
| 7 | Refused delete | `TalkCard.tsx:67`: server's own words when it sends any, else the plain line. Row stays. |
| 8 | Focus after delete | `MePage.tsx:76-90, 132`: focus goes to the next row's three dots, else a "My voices" heading (hidden, `tabIndex=-1`). |
| 9 | Report and Block on myself | `PersonPage.tsx:155`: the menu shows only once `/me` has answered and the page is not mine. Before, it showed for a moment while `/me` loaded. |

Not touched: `src/features/speak/`, `src/features/entry/`, `src/app/admin/layout.tsx`. `DMS_LIVE` is still false. No existing test changed.

## Tests and checks
- `npx tsc --noEmit`: clean. `npx next lint`: no warnings or errors. `npx next build`: ok.
- `npx vitest run`: 121 files, 1305 of 1305 passed (1294 before; 11 new in `tests/admin-phone-2.test.tsx`: post names, 409 words, 500 plain line, focus to next row, focus to heading, no Report or Block on myself and still there for others, and class guards for 1, 2, 2b, 3, 4).
- Browser (Chromium, API stubbed): `e2e/admin-phone-2.e2e.mts` (admin) and `e2e/profile-phone-2.e2e.mts` (Profile). Screenshots in `docs/lead/admin-phone-2/`.

## Measured (admin, details opened; 16 pages incl. both Prices editors)
- Page width equals the screen at 320, 390 and 768, closed and open, on every page. Users with 9,999,999 in all three cards: figures not cut at 320, 390, 768.
- Users row link: 44 high at 320, 390, 768. Email cell inside the screen at all three (right edge 295 of 320).
- Override switches: 56x44 at 320, 390, 768 (were 56x32). Calendar "Day for" picker: 82x44 (was 82x26). "Get a new link": 83x44 (was 83x18). Prices "On sale" switch: 44 high.
- Calendar at 320: box scrolls (content 337 in a 286 box, `overflow-x:auto`, radius kept). At 390 and 768 it fits.
- Prices at 320 with each editor open: page 320 wide (was 336).
- Profile at 320, 390, 768, 1440: three-dot buttons 44x44 with different names; 409 words shown; 500 shows the plain line; rows stay; focus goes to the next row's dots, then to the heading; `/p/<my id>` has no Report or Block; no sideways scroll; no page errors.
- 1440 against a build of `origin/main`: same screenshots, except pixels in clock and "hours ago" text (override, prices, results, today, weekly, moderation, calendar, verification). I looked at the Override one by eye (only "3am" and "4am" differ). The rest I judged by where the pixels differ (change logs and clocks), not one by one.

## Could not prove
- Real phones and touch feel; emulated only.
- A real server's delete refusal words. The stub sends a message; if the server sends none, the plain line shows.
- Screen-reader speech; only the accessible names were read.
- At 1024 to 1279 the three Users cards are in a row; with seven digits they wrap inside the card instead of cutting. I did not run that width.
