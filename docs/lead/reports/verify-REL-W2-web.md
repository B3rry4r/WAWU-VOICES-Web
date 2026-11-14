VERDICT: FIX

# Check of the REL-W2 release (website, main at 8fa75a3)

I changed no product code and no tests. Every API call was stubbed in the browser. I used the built app (`next build`, `next start`) and Playwright, at 390x844, 768x1024, 320 wide and 1440x900.

## D. Record screen: PASSED (reported first)
Home at 390x844, signed in and as a guest, today's question open. The question, "Pick one word" with ANGRY, TIRED, PROUD, HOPEFUL, "Say it in 60 seconds" and "Type it instead" are all there.
- Tapping "Say it in 60 seconds" with no word shows "Pick one word first."
- Picking PROUD marks it pressed.
- "Type it instead" goes to `/q/q9/write?mood=PROUD`; "Say it in 60 seconds" goes to `/q/q9/speak?mood=PROUD` (record button, 1:00).
- No page errors, no `/dm/` calls.
- A guest sees "Sign in to continue" on the write screen. That is how it already worked.
- The microphone itself was not driven (see "Not proved").

## Findings, most severe first
No HIGH. Nobody is harmed, shown anything private, or blocked on the launch path.

### MEDIUM 1. `/admin/users` scrolls sideways on a phone once a count reaches six digits
Steps: open `/admin/users` at 390 wide with a total of 123,456 (or any of the three numbers 100,000 or more). The three number cards are in a fixed 3-column grid with no room for big numbers.
Happened: page width is 392 at 390 wide, 373 at 360, 345 at 320. The digits are cut off ("1,234,5"). With 5-digit counts it fits, even at 320.
Should: no sideways page scroll, whole numbers visible.
Where: `src/features/admin/UsersPage.tsx:~101` (`grid grid-cols-3 gap-4`, `Figure` with `px-5 py-4`).

### MEDIUM 2. Controls shorter than 44 px on phones
- `/admin/override`: the three switches ("Keep the weekly theme and poll", "Emergency: apply now", "Send an in-app alert") are 56x32 at 390, 768 and 320.
- `/admin/calendar`, after opening a week: the "Day for ..." pickers are 82x26 at 390, 768 and 320.
- `/admin/verification`, after opening a person: "Get a new link" is 83x18.
- `/admin/users`: the row link (name and handle) is 36 px tall.
Should: at least 44 px tall.
Where: `OverridePage.tsx`, `CalendarPage.tsx`, `VerificationPage.tsx`, `UsersPage.tsx:~156`. The builders' own check skips switches and runs only before a detail is opened, which is why it missed these.

### MEDIUM 3. At 320 wide the calendar table is cut off with no way to scroll
Steps: open `/admin/calendar` at 320 wide.
Happened: the box has `overflow-hidden`, so the Status column is clipped and cannot be reached (table 337 wide in a 286 box). 390 and 768 are fine.
Should: scroll inside the box, or fit.
Where: the `TableFrame` wrapper in `src/features/admin/money/parts.tsx` (the `overflow-hidden rounded-xl` div).

### LOW
1. `/admin/money/prices` at 320 wide: after "Change" opens, the page is 336 wide (sideways scroll). 390 is fine.
2. `/admin/users` at 390: a very long email wraps and its end is cut off ("...@sub"), so an admin cannot read the whole address. Extreme data (79 characters).
3. Profile: all my posts' three-dot buttons have the same name, "More: edit, delete, copy link". A screen-reader user cannot tell which post. Add the first words or the time. `src/features/profile/PostRow.tsx:~64`.
4. Profile: a refused delete (409 or 500) shows only the generic "Something went wrong on our side. Try again in a moment." in a toast that disappears. The server's own words are not shown. The row stays and nothing is lost. `OwnVoiceFlow` in `src/features/talk/TalkCard.tsx` uses `failText`.
5. Profile: after a delete, keyboard focus falls to the page body (the row it was on is gone).
6. `/p/<my own id>` (my own profile opened by link) offers "Report" and "Block" on myself, and my nameless posts have no delete there (only `/profile` has it). This was already so before this release.

## What passed
**A. DMs off: all proved.**
- `DMS_LIVE` is false.
- 26 pages checked, signed in and as a guest, at 390 and 1440: `/`, discover, profile, profile/edit, settings, help, notifications, search, friends, news, weekly, units, verify, q, mood, speak, a person page, admin, admin/users and more. None has a Messages icon, row, switch or "Message @x" link (links, labels and text all scanned).
- A person's More menu shows only Report and Block.
- The desktop top row and left nav have no Messages item, at 768 and 1440 too.
- Zero requests to any `/dm/` address, and zero outside requests.
- `/messages`, `/messages/abc`, `/messages/new/<id>` and `/messages/new` all answer 404 with the "Page not found | VOICES" title. A `/messages/` request redirects (308) to `/messages`.
- Notifications have no DM type in the contract, so there is no path in.

**B. Admin on phones.**
- Every page (`/admin`, users, calendar, pool, moderation, news, override, results, weekly, verification, ads, and money overview, payments, wallets, subscriptions, prices) has no sideways page scroll at 390 and 768, except the Users finding above. Tables become cards or scroll in their own box.
- The top bar is sticky, with the Menu button 44x44.
- The menu sheet matched the sidebar link for link for ADMIN, all four roles, EDITOR, MODERATOR, AD_MANAGER, and EDITOR+MODERATOR. With no role the page says "This account is not an admin" and there is no menu.
- Sign out is present and 48 px tall. Menu links are at least 44 px.
- Menu behaviour: Escape closes it, tapping a link goes there and closes it, back and forward work, reload mid-menu leaves it closed, a double tap does not wedge it.
- Detail screens and the override dialog fit the screen. The override dialog fits at 390, 768 and 320 with focus inside, Escape closes it and its buttons are at least 44 px.
- Users: search, status filter, "N people match", Clear, "No one found", a 500 with "Try again" (recovers), and Show more (25, 50, 60) all work at 390, 768 and 1440.
- At 1440 the admin is identical to commit 729c9a8, built and compared pixel by pixel on all 16 pages. Three pages differ only by one-minute clock noise from my stub.

**C. Profile edit and delete.**
- 390 and 1440 gave the same results.
- Every own post has a 44x44 three-dot button. The menu is Edit, Delete, Copy link for written posts and Delete, Copy link for voice posts (no Edit).
- Delete confirm then the row leaves. Voices went 4 to 3 and the tab "My voices 4" to 3, with no reload. A double tap sent one delete (the button is disabled while busy). After deleting all of them the "No voices yet" state shows and the count is 0.
- A refused delete (409, 500, or a dropped connection with "You are offline") leaves the row and shows a line.
- Edit: the box is prefilled with the line breaks. After saving, the row shows the new words with line breaks and gaps kept ("New first / New second / (gap) / After two blank lines"). A double click sent one PATCH. A refused edit (409, edit window passed) shows the server's words inside the sheet ("You can only edit a post for 10 minutes after you send it.").
- A very long post (6 x an unbroken 80-character word, plus long text) shows no sideways scroll at 320. The edit sheet's Save button stays visible.
- My nameless post shows "Posted without your name" and can be deleted from `/profile`. On another person's page the same kind of post shows only "Anonymous" and my name appears nowhere.
- Another person's page has no three dots for edit or delete.
- The dialog has a title name. Escape closes it and focus returns to the three-dot button. The toast has role=status.
- Reload mid-sheet closes the sheet and the list is intact.

## What I ran
- `npm ci`: ok.
- `tsc --noEmit`: clean.
- `next lint`: no warnings or errors.
- `vitest run`: first run 1190 of 1191 passed with 1 failed. Run again twice, 111 files and 1191 of 1191 passed both times. I did not find which test failed the first time, so I call it flaky (seen once).
- `next build`: ok.
- `next start` on private ports, Playwright, API stubbed by route. About 330 page loads and 12 interaction scripts.
- Also built 729c9a8 for the desktop comparison. I removed that extra copy and stopped my servers.

## Not proved
- The microphone and a real recording were not driven. I proved the screens and routes only.
- A real server's answers: what its delete or edit refusals look like, whether a nameless post leaks my name in a share link (the share-link text comes from the server), and that `/admin/users` always sends `counts`. With a stub that left out `counts` and `total`, the admin frame went blank, so the page relies on the server always sending them.
- Real phones and touch feel. I used emulated phones only.
- Slow-network behaviour beyond a 3-second delayed delete (the button stayed busy and one request was sent).
- `/s/<code>`, `/c`, `/go` and `/join` were not walked for DM traces. The API-down fallthrough means they were not exercised with data.
- Screen-reader speech was not tested, only the accessible names.
- The moderation queue in the admin may list direct-message reports from before DMs were turned off. I did not check.
