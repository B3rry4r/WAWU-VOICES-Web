VERDICT: FIX

# REL-W5 web check

Checked at main 79c7a9c. Built and run with `next start`; every API call stubbed in the browser, and the share page drawn by a local stub API. No live service was called. One HIGH (H1) was pushed early in an interim version of this file.

The record screen (A) and the share link (B) are fine. The fault that matters is H1: editing an old long post cuts it short and saves the cut version.

## HIGH

### H1. Editing an old long post silently cuts it to 2,500 characters and saves the cut version
- Steps: signed in, own text post of 4,002 characters (older than the 2,500 limit). Profile, "More", "Edit this post". Type two characters at the end (or fix a typo anywhere). Tap "Save changes".
- Happened: the box opens with all 4,002 characters and the line "Keep it to 2,500 characters." On the first keystroke the text is chopped to 2,500, the last 1,500 characters vanish from the box, and Save sends only the chopped text (PATCH body length 2500). The server accepts a shorter text, so the person's words are lost for good. The server never gets to refuse, so its own words are never shown.
- Should happen: the box keeps the whole old text. A too-long save goes to the server and the server's refusal line is shown, or a clear line says the edit is over the limit and nothing is cut.
- Where: `src/features/talk/OwnPost.tsx:48` (`onChange` slices to `limit`). The opening text is set at `:30-32` and is not cut.

## MEDIUM

### M1. Group ideas ("Split this group") does not fit a phone: sideways scroll, button off screen
- Steps: signed in as admin, open `/admin/ideas` at 390x844 (also 360x740) with one question, one confirmed group and one suggestion.
- Happened: page is 542 px wide at 390 (531 at 360). The two-column layout is squeezed, the "Confirm this group" button is cut off on the right, and "Split this group" sits at x=407, off screen at 390. The three tick boxes are 20x20.
- Should happen: no sideways scroll at 390 or 360, controls reachable and at least 44 px tall.
- Where: `src/features/admin/IdeasPage.tsx` around the two-column grid (`grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]`, line ~52) has no phone layout. Split itself works (dialog, then DELETE once).

### M2. Admin pill and green tick missing on several screens that should show them
The API sends `author.admin` and `author.verified` and its own contract text says the web shows the pill and the tick.
- News list (`/news`): a named verified admin author shows neither tick nor pill. `src/features/news/NewsCard.tsx:76`.
- Share page `/s/<code>` featured voice: tick shows, Admin pill does not (checked in the page source for an author with `admin: true`). `src/features/share/SharePageView.tsx:123`. Its "What Next" top proposal shows neither: `:147`.
- What Next proposals show a tick but never the pill: `src/features/vote/WhatNextPage.tsx:99-102` (no `admin` passed).
- Shown correctly: thread replies, the question page answer cards, profile rows, the news post page.
- Should happen: pill only when `author.admin === true`, tick when `verified`, on all of these.

### M3. A returning member on a phone has no sign-in link on the share path
- Steps: guest, open `/s/<open question>`, pick a word, Say it, record, tap Send.
- Happened: the join intro opens. On a phone its last slide offers only "Start" ("I have an account" exists only in the desktop layout, `src/features/entry/Onboarding.tsx:181`, hidden at 390). The header "Sign in" link is also hidden at 390. A person who already has an account must tap Start, then Continue on the country page, then "Sign in" under the join form. It works, and they return to the same question with the word and the share code kept, but it is easy to give up.
- Should happen: a visible "I have an account" on the phone intro (the owner decides the wording).

## LOW
- L1. `/news/<id>` crashes ("Application error") if the post's `news.chosenBy` is null: `src/features/news/NewsPostPage.tsx:24` calls `.startsWith` on it. The contract says it is always a string, so this only bites if the server ever sends null.
- L2. The write screen and the reply composer take `textMaxChars` from the allowance costs (`WriteScreen.tsx:80`, `ReplyComposer.tsx:35`), not from the public config as the brief says. With both set the same they agree (tested 2,500 and 300). If they ever differ, the counter follows the allowance.
- L3. `/admin/override` at 320 wide scrolls sideways (349 px). Not one of the sizes asked for.
- L4. Settings "News tag alerts" switch is 52x32. Not an admin page; noted only.

## What passed
A. Record screen (390, 360, 1440; signed in and guest): question, "Pick one word" with ANGRY, TIRED, PROUD, HOPEFUL, "Say it in 60 seconds", "Type it instead", "Share my word"; "Pick one word first." with no word; `/q/q1/speak` goes to the pick screen. Pick, record, listen back, Send: exactly one VOICE post with the word. Tag left alone is "Not news" and the post has no `isNews`/`newsTag`. Unverified News and Gossip send `isNews` with `UNVERIFIED_NEWS` / `GOSSIP`. "Request Verified News" says it posts as Unverified and asks for a source name; Send stays off until a source is named, then sends `requestVerified` with `newsSourceName`. "Post without my name" sends `anonymous: true`. Type it instead keeps the word. Free posts used up: "Send for 78 tokens" shown, no POST until the tap. Double tap: one POST. 500 then retry: same Idempotency-Key, one post. 409 "start again with a new key": new key, one post. Offline then back: the saved voice sent once, and not again after reload. Two tabs: one POST. Another person signing in (different token subject): zero POSTs.
B. `/s/<open code>`: 200, og:title is the question, og:image 1200x630, twitter summary_large_image. In a browser it lands on `/q/q1/mood?from=<code>` (or `/speak?from=` for a question with no words); Back goes to the page before, no loop. Guest picks a word, records, Send: the join path; via "Sign in" the person comes back to `/q/q1/speak?from=<code>&mood=HOPEFUL` with the voice and posts once. Via sign UP (form, email code, topics, profile) the held voice posts once with the word. Type it instead then sign in: back on `/q/q1/write?mood=TIRED&from=<code>`. Closed, not-yet-open, ANSWER, PROFILE links and an unknown code (404 with the not-found page) are unchanged. Odd-character codes are 404 and never put in an address (the code filter is `speak-target.ts:5`).
C. Thread: named reply shows picture (a 404 picture falls back to initials), tick, and the Admin pill only for `admin: true` (not for `"true"`, not for `false`). Nameless reply and parent: "Anonymous", no handle, no picture, no tick, no pill; page source, aria labels and links searched for the writer's handle and name: none. Only the writer sees "Posted without your name". Profile: own nameless row shows that line and delete works. Reply composer: name switch sends `anonymous: true`; after a failed send a changed stance uses a new key and the new stance; an unchanged retry keeps the key. Voice reply saved offline: kept, sent once as the same reply (same parent, stance and key).
D. Write screen at 2,500 and 300: counter follows the config, paste of 10,000 stops at the limit with "Keep it to N characters."; typing past the limit adds nothing. Same in the reply composer (300). The edit of an old 4,000-character post is H1.
E. Admin news: approve and decline each remove the decided row. Summary panel: an AI draft is carried (`aiDrafted: true`, AI note shown); a 422 about "[removed]" shows the server's own words and nothing is saved. Audio advert on Home: one clip at a time (a voice pauses the advert and the advert pauses a voice), one IMPRESSION and one LISTEN. News tag alerts switch sends `notifyTagFollows`. People and roles: no sideways scroll, no control under 44 px at 390 and 360. Calendar and news admin: same.
F. DMs off: no Messages entry on seven pages, zero `/dm/` requests, `/messages`, `/messages/abc`, `/messages/new/u2` all 404, signed in and out, 390 and 1440. A guest who opened `/admin/money`, left, then signs in the ordinary way lands on Home; the same after sign up and the join steps. Unknown `/admin/...` addresses show the admin sign-in to a guest. Profile edit (short post) and delete work. Admin Users at 320: six/seven-digit counts fit, no sideways scroll.

## What I ran
- `npm ci`, `npx tsc --noEmit` (clean), `npx next lint` (clean), `npx vitest run` (131 files, 1,371 tests, all pass), `npx next build` (ok), `npx next start` on port 3977 with a local stub API for the server-drawn share page.
- About 45 browser checks of my own (Playwright, fake microphone) across A to F, listed above.
- The repo's own `e2e/relw5.e2e.mts` (7 of 7 pass) and `e2e/admin-phone-2.e2e.mts` phone mode (no sideways scroll on 390; only finding is the override page at 320, L3; its other "small" items are 1x1 hidden file inputs).

## What I could not prove
- Anything against the real API or the live site: server answers (422 wording, 409 text, price numbers) are my stubs. My stub prices are made up (78 tokens for a voice).
- A real microphone, real upload to storage, real payment, real email code.
- Web Locks fallback (storage flag) for two tabs: the browser used has Web Locks.
- Blocked IndexedDB (saved voice kept in memory only).
- Admin pages for ads, money, weekly, results and verification were only measured by the repo's own harness; I did not open their dialogs by hand. The audio advert with a real long clip was not played.
- The first-tap theme song was not tested against the advert (the song button was not on the Home I drew).
- Whether a sign-up that ends in the join steps for a person with a held admin return is covered for a person who actually has an admin role.
