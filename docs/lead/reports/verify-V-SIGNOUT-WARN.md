VERDICT: MERGE

# Check of "Sign out warns first" (branch v/signout-warn, head bfe4953)

Final, 15 Nov 2026.
Built app (`next build` + `next start`), Chromium, fake microphone, API and sign-in stubbed, 390x844 and 1440x900.
`origin/main` is inside the branch (merge-base check says so). No product code or existing test was changed.

## Findings (most severe first)

### HIGH 1. A person whose storage never answers can never sign out
`src/features/profile/useSignOutConfirm.tsx:15-18`, `src/features/speak/draft.ts:204-211`.
The Sign out tap waits for the storage read with no time limit. Steps: sign in, keep a recording, open Settings, make
IndexedDB `open` never call back, tap Sign out. After 6.5 s: no dialog, still signed in, no sign-out request. It stays like
that for good. Before this change, Sign out never waited on storage. Same at 390 and 1440.
Fix: stop waiting after about 1 second and sign out (or show the dialog, owner's call).

### HIGH 2. "Sign out anyway" can remove someone else's recording
Steps: Alice has a kept recording and taps Sign out, the dialog shows. In another tab Bob signs in on the same browser, and
Bob also has a kept recording. The dialog stays open. Tap "Sign out anyway" in Alice's tab. Result: Bob is signed out and
Bob's recording is gone; Alice's recording is still there (IndexedDB keys left: `rec:A` only). Same at both widths.
Cause: the confirm button calls `signOut()`, which acts on whoever holds the token now, not on the person the warning was
shown for (`useSignOutConfirm.tsx:30`, `src/lib/api/auth.ts:117-125`). Main does the same when Sign out is tapped with no
dialog, but the dialog makes the gap long enough to hit. Fix: remember who the warning was for; if someone else is signed in
when "Sign out anyway" is tapped, close the dialog and do nothing.

### MEDIUM 3. A take held only by the page is removed with no warning
`hasKeptRecording` reads IndexedDB only (`draft.ts:204-211`). When storage is blocked or full, the take lives in the in-page
`memory` map; `afterSignOut` removes it (`idbDel` clears `memory`). So that person gets no warning. Not proven in a browser
(needs a move to Settings without a page reload while storage is blocked). Read from the code.

### MEDIUM 4. Nothing shows while the check waits
With a store that answers after 5 s: tap Sign out, for 5 s there is no dialog and the button looks normal (not disabled,
no busy mark). The person will tap again. Double taps are safe (see below), but it looks dead.

## What held (proven)
- `git diff origin/main -- src/features/speak` is one hunk: the new `hasKeptRecording`, 11 lines. `git diff origin/main --stat -- tests` shows only `tests/signout-warn.test.tsx`.
- Sign out then Go back, with a kept recording, a guest recording claimed at page load, and a legacy `current` slot: IndexedDB (every key, value, blob hash) and localStorage identical before, during and after. The tap itself changed nothing.
  Note: the app's own start-up (guest claim, old-slot move, removing other people's and 8-day-old recordings) changes some of these before the tap. That is main's behaviour, so for "other person", "8 days old" my check cannot isolate the tap there (no dialog, signed out at once, as wanted).
- The sentence is exact: "You have a recording you have not sent. Sign out anyway?", buttons "Sign out anyway", "Go back". No em-dash.
- Go back, close button, tap outside, Escape: still signed in, no sign-out request, snapshot unchanged. Tab stays inside the dialog (3 stops). Focus returns to the Sign out button. No sideways scroll.
- No indexedDB / `open` throws / `get` throws / a string in the slot: signs out at once, lands on `/`.
- 10 fast taps: one dialog, one sign-out request (also with no recording). Three taps on "Sign out anyway": one request.
- Session ends while the dialog is open: dialog stays; Go back leaves a normal page.

## What I ran (totals)
- `npm ci` ok. `npx tsc --noEmit`: 0 errors. `npx next lint`: no warnings or errors. `npx next build`: ok.
- `npx vitest run` exit 0 three times: 154 files, 1572 tests each time.
- Main's tests untouched: `git diff origin/main --stat -- tests` shows only `tests/signout-warn.test.tsx` (new). `origin/main` is inside the branch.
- `e2e/draft-owner.e2e.mts` (unchanged, both widths): 38 ok, 0 FAIL (the two known timing misses did not occur). `e2e/surveys-r9.e2e.mts`: ALL PASSED 6. `e2e/signout-warn.e2e.mts`: all 2 ok.
- My own attack run (not committed): voice x5 and typed x5 with the word screen at 390 and 1440, each exactly 1 clip (voice) and 1 post: ok. Question, "Pick one word", ANGRY TIRED PROUD HOPEFUL, "Say it in N seconds", "Type it instead", "Share my word" all present.
- Kept recording kinds: a plain take, one waiting to be sent (queued), a voice reply (queued): the warning shows in each.
- Dialog at 360x740, light and dark: inside the screen, no sideways scroll.

## Not proven
- Finding 3 in a browser; whether real browsers ever leave IndexedDB `open` hanging (finding 1 uses a stub that never answers).
- "Tap Sign out during a send, then Go back": the record screen has no link to Settings, so I could not move there without a reload. Not tested.
- "Sign out anyway" was not diffed against a build of main (same landing page `/`, token removed, one sign-out request are seen; storage and request were not compared side by side).
- Deletion pending screen in a browser (the code change mirrors Settings; the builder's unit test covers it). Dark mode only at 360 and by the builder's screenshots.
- Two tabs of the same person, and a sign-out done in another tab: not covered (the order says that cannot be warned about).

# Re-check of round 2 (head 6a29c1e)

Final. Built app of the new head, Chromium, stubs for API and sign-in (nothing live), 390x844 and 1440x900.

## Diff
- `origin/main` (eefa0a4) is inside the branch. `git diff origin/main -- src` shows only 4 files: `useSignOutConfirm.tsx` (new, 53 lines), `SettingsPage.tsx`, `DeletionPending.tsx`, `speak/draft.ts` (the one function, 12 lines, read-only). `git diff origin/main --stat -- tests`: only `tests/signout-warn.test.tsx`. The surveys files come from main.
- Only the four rulings changed: 1 second limit (`CHECK_MS`), "same person" check on "Sign out anyway", page-held take counted, busy button (`loading`).

## Your four findings
- **HIGH 1: CLOSED (both widths).** `open` never answers: the button shows busy at 300 ms (disabled, aria-busy), no dialog, signed out at about 1.1 s, one sign-out request. Store answers late at 2 s and 5 s: nothing happens (no dialog, no second sign-out request, still on `/`).
  Answer at 900 ms with a kept recording: the dialog shows (about 1.0 s after the tap). Answer at 1100 ms with a kept recording: **signs out and the recording is removed with no warning.** That is the accepted cost of never blocking sign-out.
- **HIGH 2: CLOSED (both widths).** Alice's dialog open, Bob signs in in tab 2 with a kept recording, "Sign out anyway": dialog closes, Bob still signed in, 0 sign-out requests, IndexedDB (`rec:A`, `rec:B`) byte for byte unchanged. Nobody signed in when tapped: dialog closes, 0 requests, storage unchanged, page stays on Settings. Alice signs out and in again in tab 2 (new token, same person): "Sign out anyway" signs out, 1 request.
- **MEDIUM 3: CLOSED (both widths).** Put made to fail, take recorded, moved to Settings with the app's own router (no reload): dialog shows. Go back, tap again: dialog shows again, so the take is kept. (The record screen did not show that take again after I went back to it; the screen only reads the page-held copy when storage errors, which is not this branch's change. I did not compare with main.)
- **MEDIUM 4: CLOSED (both widths).** While waiting, the button is disabled and busy. 10 taps on every Sign out button in the page (desktop and phone together): 1 dialog, 0 sign-outs.

## New ways to break it
- Tap Sign out, move to another page within the second (storage never answers): no sign-out later, still signed in, no dialog on the next page.
- Desktop and phone buttons together: one hook per page, one dialog.
- Deletion pending (both widths): with a kept recording the dialog shows, Go back keeps the person signed in, "Sign out anyway" signs out to `/welcome` with 1 request. Without one it signs out at once.
- Read-only proof, tap then Go back, for a kept recording, a guest recording, another person's recording and the old `current` slot: every IndexedDB key, value and blob hash, and localStorage, identical before, during and after.
- Console: a "Cannot read properties of undefined (reading 'filter')" shows when Settings loads, with no tap at all (checked). It comes from my stub's answer to a Settings call, not from sign-out. Not compared with main.

## Gates and suites on the new head (6a29c1e)
- `npx tsc --noEmit` 0 errors. `npx next lint` no warnings or errors. `npx next build` ok.
- `npx vitest run` exit 0 three times on the head: 156 files, 1591 tests each time. (One earlier run showed 2 failed files; that was me switching branches under it. Rerun clean three times.)
- `origin/main` is inside the branch. Main's tests byte-identical: only `tests/signout-warn.test.tsx` differs.
- `e2e/draft-owner.e2e.mts` (main's, unchanged, both widths): 38 ok, 0 FAIL, neither known miss occurred.
- `e2e/surveys-r9.e2e.mts`: ALL PASSED 6, 0 FAIL.
- Builder's `e2e/signout-warn.e2e.mts`: 5 of 6 on the first run. The miss was "r2 HIGH 2 [390]" (Bob signs in in tab 2). I ran it again alone: 8 of 8 ok. Under load I made it fail again and looked: the miss is in the script's own set-up, not the code. Tab 2's own start-up (main's behaviour: a signed-in tab removes other people's recordings on load) removed Bob's recording before the tap, so "before" already lacked `rec:B`; after the tap the keys were the same as before, Bob still signed in, 0 sign-out requests. Where Bob's recording survived to the tap (2 of 3 loaded runs), the test passed.
- My own voice x5 and typed x5 with the word screen, both widths: each Send exactly 1 clip (voice) and 1 post. All ok.

## Not proven
- The record screen not showing a page-held take after an in-app return (see MEDIUM 3 note): not compared with main.
- The 1100 ms case is by design: the person is signed out and the recording removed with no warning.
- Two tabs of the same person, and a sign-out done in another tab: not covered (ruling).
