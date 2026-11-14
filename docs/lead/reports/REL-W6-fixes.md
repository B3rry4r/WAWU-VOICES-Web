# REL-W6 fixes

Branch `v/rel-w6`, pushed in pieces, H1 first. Head commit: see the last commit on the branch (the one without `[skip ci]`).

## What changed

- **H1, editing never cuts a post.** `src/features/talk/OwnPost.tsx:32-34,46-52`. An over-limit text stays whole in the box, the counter shows the real length ("4,003 / 2,500"), the line "This post is longer than 2,500 characters. Shorten it to save your changes." shows (number from the config), Save is off and `save()` returns early. Typing more is accepted, never chopped. A text that was under the limit and is pasted over it is still cut at the limit, as before (existing test `people-limit` unchanged and passing). A server refusal still shows its own words (`editFailText`). Tests: `tests/edit-never-cuts.test.tsx` (4,002 chars + 1 char: box holds 4,003, no PATCH, line shows; cut to 2,400: Save sends 2,400).
- **M1, Group ideas on a phone.** `src/features/admin/IdeasPage.tsx:52` (columns stack below 1024), tick boxes 44 px below 1024 (unchanged 20 px at 1440), "Split this group", "Confirm", "Split the group" and "Keep it" buttons now 48 px; group row stacks on a phone. 390, 360: no sideways scroll, nothing under 44 px, Split on screen.
- **M2, Admin pill and tick.** Added: `NewsCard.tsx:77` (tick and pill), `SharePageView.tsx:123` (pill), `SharePageView.tsx:147` (pill; its tick was already there), `WhatNextPage.tsx:103` with a new `admin` prop on `ProposalCard` (`src/components/vx/conversation.tsx:352,382`; same `AdminPill`). Also found and fixed: search "People" rows (`src/components/feed/SearchScreen.tsx:108`, tick showed, pill did not). Rule kept: pill only for `admin === true`, nameless shows "Anonymous" with neither. Test: `tests/admin-pill-everywhere.test.tsx`.
  - Looked at and left alone: Friends list (the API's `Friend` has no `admin` or `verified`), result comments (`polls.tsx` `ResultComment`, author is the person's own typed name, no flags in the data), DM inbox and conversation (DMs are off, `DMS_LIVE = false`; `DmPerson` does carry `admin`, so the pill is a gap to close if DMs open).
- **M3, "I have an account" on the phone intro.** `src/features/entry/Onboarding.tsx:181-187`. Shown under "Start" on the last slide (the only slide where Start shows), same words, same `/sign-in` link as the desktop one, 48 px tall. The held return (`holdReturn` on load) is stored by the page, so it survives the same way as on desktop; the browser run checked the share link's code and the word are still held after tapping it. `share-card-guest-return` passes.
- **L1.** `NewsPostPage.tsx:24`: a null `chosenBy` shows "Tag chosen <time>" and does not crash.
- **L3.** `OverridePage.tsx:163`: the four-way Text/Voice/Image/Link switch scrolls inside its own box. 320 and 390: no sideways scroll.
- **L4.** `src/features/profile/profile.css` (end): Settings switches are 72x44 below 1024 (all of them, the same look at 1440). "News tag alerts" measured 44 high at 390.
- **L2.** Left as it is (the write screen and reply box take the limit from the allowance costs; both are 2,500).

## Other places for H1
Searched `.slice(0, limit`, `maxLength` and the edit paths. Only `EditSheet` (used for own posts and own replies, profile and thread) loads existing text into a box with a limit. The other `maxLength` boxes (reasons, notes, headlines, appeal, report note) start empty or hold admin text and have no old text loaded. The profile bio has no limit box in `EditProfilePage` that cuts text. No proposal edit exists. The Composer in `src/components/vx/speak.tsx` cuts, but it only starts empty.

## Checks
- `npx tsc --noEmit`: clean. `npx next lint`: clean.
- `npx vitest run`: 133 files, 1,375 tests, all pass (was 131 / 1,371 at REL-W5; +2 files, +4 tests are mine). No existing assertion changed.
- `npx next build`: ok.
- Browser run `e2e/relw6.e2e.mts` (Playwright, every API call stubbed, `next start`): 19 of 19 pass. Screenshots in `docs/lead/rel-w6/`.

## What the browser run showed
- H1 from Profile (390, 360, 1440) and from a thread (all three): 4,002 opened, one "!" typed, box 4,003, line shown, Save off, zero PATCH; cut to 2,400, one PATCH of 2,400 (profile).
- Ideas page at the three sizes: no sideways scroll, nothing under 44 px below 1024, Split on screen.
- News list: admin+verified shows pill and tick, verified shows tick only, nameless shows "Anonymous" and neither, plain shows neither. What Next shows the pill (three sizes).
- Join intro at 390 and 360: no account link on slides 1 and 2, link on the last slide, 44+ px, goes to `/sign-in`, the share code and the picked word still held.
- L1 no crash; L4 switch 44 px.
- Home to the pick-one-word screen: question, "Pick one word", "Say it in 60 seconds", "Type it instead" (word kept on the write screen), at the three sizes. I did not change `src/features/speak/`.
- Override at 320 and 390: no sideways scroll.

## Could not prove
- The share page (`/s/<code>`) is drawn on the server, so the stubs in the browser do not reach it. Its pill is covered by reading the code and by the same `AdminPill` used elsewhere; I did not see it drawn. The full "share link, sign in, back to the same question" journey is covered by `share-card-guest-return` (passes) and I only checked the held values in the browser.
- No real microphone, no real recording through to Send in this run (the record screen was only opened, as asked).
- Nothing against the real API. The "₦NaN" on the intro screenshot is my stub missing the price tiers, not the site.
