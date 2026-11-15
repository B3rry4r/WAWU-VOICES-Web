VERDICT: MERGE

# verify-V-DRAFT-OWNER-2

Checked `v/draft-owner` at 3686987 (branch `verify/draft-owner-2` cut from it). Built with `next build`, served with `next start`; Chromium with a fake microphone; API and sign-in host were stubs I control (no live service, no `.env`). 390x844 and 1440x900. Several tabs in one browser context. Sign-in was driven through the real sign-in screen against my stub wherever a sign-in is part of the case. My attack scripts are not committed.

I found no HIGH. Two things are not proved (see the last section); I did not find them broken either. The first check's two HIGHs are CLOSED by my own runs.

## First check's two HIGHs
1. HIGH 1, lone person, guest tab told "signed in as someone else": **CLOSED.**
   - Record screen, both widths, 5 runs each: guest tab open, the same person signs in in tab 2, tab 1 records and Sends. Every run: 1 clip, 1 post as that person, line 0.
   - Guest already had a take: both widths, 5 runs each, 1 clip, 1 post, no recording key left, line 0. After a reload of tab 1 the take is there as that person's and goes once.
   - Write screen, both widths, 5 runs each: the guest screen turns into the box when the session appears, types, Posts: 1 post as that person, line 0.
   - Guest tab mid-recording while the person signs in on tab 2: stop, Send: 1 post, line 0.
2. HIGH 2, shared phone, next person's words and held post lost: **CLOSED.**
   - Same tab, both widths: A types and goes out of posts (held post), A signs out, B signs in. B's box opens empty, B types, leaves, returns: "B words" is there; B goes through the buy page and back: still there; B posts. A signs in later: "A words" is there. Storage after: `voices-typing-v2` and `voices-held-v2` each hold A and B separately.
   - Not driven: the payment-done screen, and a full page load back from the payment page (see the end).

## Findings, most severe first
No HIGH. No MEDIUM that I could show.

### LOW 1: one extra clip create in one upgrade run (not reproduced)
Upgrade run from main's storage (item 4): A's recording kept by main was sent from Home on this branch: posts 1 (correct) but my counter saw 2 `POST /voice-clips` calls. Three later runs with a recording written straight to `rec:A` gave 1 clip, 1 post every time. I did not get to the cause. The post itself went once. Worth a look by the builder: `src/features/speak/outbox.ts` after `migrate()` in `src/features/speak/draft.ts:137-144`.

### LOW 2: going back to main and forward again can drop main's newer take
`src/features/speak/draft.ts:137-144` (`migrate`): main's slot `current` is moved to `rec:<owner>` only if that key is empty, and `current` is then deleted either way. So after a rollback to main, if A keeps a new take there while `rec:A` from this branch still exists, the next load of this branch deletes main's newer take. Read from the code, not run.

## The kept-from-main rule (B's page load removes A's kept recording)
Run: A has `rec:A`, B signs in on another tab and loads any screen that loads the draft (record screen, Home through the Outbox). Result: `rec:A` is gone (keys `[]`) both widths. When A loses a recording this way: A has a kept recording, A is not the signed-in person any more (signed out, or session ended, in that browser), and a different person signs in and a page loads in that browser. A's own tab being open does not save it. A's recording is also removed when A signs out in this browser (as main). On main the single slot `current` is removed the same way when another person loads (the existing test pins it), so this is the same loss as main, not a new one. It never leaks: B never sees, hears or sends it.

## Two people, two and three tabs (item 3), all pass, both widths
- A's tab open on the record screen; B signed in on tab 2 first with a kept recording, typed words and a held post. Tab 1 waits 3 s on the pick screen, then records and taps Send, and goes to the write screen. B's recording (SHA-256 prefix), typed words and held post: identical before and after in the cases where tab 1 stayed A's. Posts 0, clips 0, no key added under B.
  - Trap to avoid in the next check: a full `page.goto` in A's tab while B is signed in makes that tab B's (rule: reload carries on as the signed-in person). It then posts as B. That is by design.
- A's tab open, A signs out and B signs in on tab 2 (real screens): tab 1 records, Send: line shown, 0 posts, 0 clips; B's recording and words unchanged.
- B in, out; A in again on tab 2: tab 1 records and sends once as A, line 0.
- Guest claim attempts, all closed: A records, signs out elsewhere, B signs in and opens the record screen: no Send, 0 posts. Guest tab becomes A's, A records, A signs out and B signs in elsewhere: B sees nothing. A types, A's session ends, A keeps typing, B signs in on the same question: B's box empty, A's words stay under A (`voices-typing-v2`), nothing in main's table.
- Guest records, A signs in on tab 2 and opens the record screen: A has the take (`rec:A`), sends once.

## One person (item 2): counts
Item-2 script, both widths: 68 sends, 68 counted runs, **the line appeared 0 times; posts per Send were 1 every time.** Plus the item-1 runs above (30 sends, line 0, 1 post each). Covered:
- voice 10 and typed 10 per width (40 runs), all 1 post.
- Token runs out before Send, voice and typed, 2 runs each per width: 1 refresh, 1 rejected call, 1 post. Token replaced by another tab: 1 post.
- Home load with a rejected token and 12 rejected calls: 1 refresh call (not 50 calls; see below).
- Network dropped once at the clip create, the upload, the answer: Send again is there, take kept (`rec:A`), 1 post. Dropped at "complete": the take was already gone after the first Send and 1 post went (no second post).
- Reload between record and Send: take kept, 1 post. Offline Send, reload, page closed, a new page in the same browser online: sent once (posts 1, no key left, line 0).
- Three tabs of one person (Home, record, record): 1 post, line 0.
- Typed words survive leaving, a reload, and sign-out plus sign-in of the same person.
- Guest records, signs in in the same tab through the real sign-in screen, returns: Send is there, 1 post, no key left.
- Session removed mid-recording: the take is kept as A's; after signing in again in the same tab Send works, 1 post, line 0.
Sign-in tokens: `session-storage.ts` diff read: `setTokens` writes the same keys and values as main, then only tells a listener; `clear()` is untouched.

## Storage and old data
- Item 4, main to this branch, same profile, same address: main kept A's recording (`current`, owner A, queued), typed words, held post; and a guest's recording (`current`, owner null) in a second profile. On this branch: A alone: the recording was sent once (posts 1) from Home, key gone; typed words moved to `voices-typing-v2` for A (`{"A":{"q:q1":...}}`, main's table emptied); the held post stayed in main's table until A opens that question's out-of-posts flow. No page error, line 0. Guest: no Send before sign-in (`rec:guest`), after signing in on the same tab Send was there, 1 post as A, no key left. See LOW 1.
- The write screen did not show the box within 7 s in the upgraded profile (A with a held post for that question). I did not find out whether this also happens on main with the same held post.
- Reverse (branch storage read by main): not run. By reading, main reads only `current`, `voices-typing-drafts`, `voices-held-drafts`; it would not see `rec:*`, `voices-typing-v2` or `voices-held-v2` and never touches them (see LOW 2).

## Gates (item 7)
- `npm ci` exit 0. `npx tsc --noEmit` exit 0. `npx next lint` exit 0, no warnings. `npx next build` exit 0.
- `npx vitest run` exit 0: 137 files, 1403 tests, all passed (no `opening` flake this run).
- `git diff origin/main...HEAD -- tests` for tests that exist on main: I normalised every removed and added line: only `currentOwner()` person arguments, the import of it, and one `leaveTab()` setup line in `tests/share-card-guest-return.test.tsx`. No assertion changed. New test files: `tests/draft-owner.test.tsx`, `tests/draft-owner-2.test.tsx`.

## What I could not prove
- Item 5 storage errors (IndexedDB missing, quota, `localStorage` throwing, corrupt entries): I did not run these. The builder's own run says it did; I did not check them.
- Real sign-up with the emailed code in the browser; the payment-done screen and a full page load back from the payment page; a voice reply and a typed reply in a thread (the box was not driven by me).
- 50 calls hitting 401 together: I drove a Home load with 12 rejected calls (1 refresh); not 50.
- A clock change run; the 7-day removal (6-day stays, 8-day goes) in the browser; counted only by the existing unit tests.
- The rollback run (branch storage read by main); LOW 2 is from code reading.
- `useSignedIn` on every screen (Home, a question, Profile, the shell bar): only the record screen, the write screen and Home were looked at.
- Real phones, Safari, private windows.
