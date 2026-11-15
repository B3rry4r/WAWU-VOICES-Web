VERDICT: FIX
INTERIM

# verify-V-DRAFT-OWNER-2 (interim)

Checked `v/draft-owner` at 3686987. Built with `next build`, served with `next start`, Chromium with a fake microphone, API and sign-in host stubbed in the browser (no live service, no `.env`). My attack scripts are not committed. Several tabs in one browser context, 390x844 and 1440x900. Sign-in went through the real sign-in screen against my stub.

This is the interim report. The verdict is FIX only because the first check's two faults are not yet proved closed by my own runs (see below). I have found no HIGH so far.

## Findings so far
None HIGH. One thing to know (not a finding, a test trap): in my first two-person run, tab 1 (A) was loaded fresh with `page.goto` while B was signed in. That tab is then B's tab, and it posted B's typed words as B. That is the rule ("Reload to carry on"), not a leak. In-app navigation keeps the tab A's.

## Two-person runs, both widths (all pass)
- A's tab open on the record screen. A signs out in tab 2 and B signs in on the real sign-in screen. B has a kept recording and typed words. Tab 1 records and taps Send: line shown (1), posts 0, clips 0. B's kept recording and words are byte-identical (SHA-256 prefix and JSON compared before and after). Nothing under B's key.
- B signs in and out, A signs back in on tab 2: tab 1 records and sends once as A, line 0.
- A records, A signs out in tab 2, B signs in and opens the record screen: B sees no Send, 0 posts. A's recording was removed at A's sign-out (as main).
- Guest tab records, A signs in on tab 2: A's tab 2 sees Send, sends once as A.
- Guest tab becomes A's, A records, A signs out and B signs in elsewhere: B sees nothing of A's.
- A types, A's session is gone (signed out elsewhere), A keeps typing, B signs in and opens the same question: B's box is empty; A's words stay under A (`voices-typing-v2`).
- B's page load removes A's kept recording: yes, when A has a kept recording and B loads any screen that loads the draft (record screen, Home through the Outbox). Same rule as main (one slot, removed when another person loads). Full detail in the final report.

## Gates
`npm ci` exit 0. `npx tsc --noEmit` exit 0. `npx next lint` exit 0 (no warnings). `npx next build` exit 0. `npx vitest run`: running.
Tests diff against main: I normalised every removed and added line in the existing test files: only `currentOwner()` person arguments, the import of it, and one `leaveTab()` setup line in `tests/share-card-guest-return.test.tsx`. No assertion changed.

## Not yet done (the full report will cover)
The first check's two HIGHs with 5 runs each at both widths, the one-person 40-run sweep, token refresh and network drops, sign-up with code, the payment pages, old data (main to this branch and back), storage errors, 50 concurrent 401s, `useSignedIn` on every screen.
