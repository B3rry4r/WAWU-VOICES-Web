VERDICT: FIX

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
