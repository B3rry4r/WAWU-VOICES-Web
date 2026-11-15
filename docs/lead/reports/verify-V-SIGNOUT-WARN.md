VERDICT: FIX
INTERIM

# Check of "Sign out warns first" (branch v/signout-warn, head bfe4953)

Interim, written 15 Nov 2026. Gates and the record-screen suites are still running. This is what is proven so far.
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

## Not yet run (interim)
Lint, build gate counts, vitest x3, draft-owner / surveys-r9 / signout-warn e2e suites, voice and typed send 5x at each width,
kinds of recording (offline-queued, reply, mid-send), dark mode, Deletion pending screen, 360x740, comparison build of main.

## Could not prove
Finding 3 in a browser. Whether real browsers ever leave IndexedDB `open` hanging (finding 1 uses a stub that never answers).
