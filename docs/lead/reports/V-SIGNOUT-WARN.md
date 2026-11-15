# V-SIGNOUT-WARN: Sign out warns first

Owner order, 15 Nov 2026 ("Warn first"). Branch `v/signout-warn`, cut from main 9ca43fb.

## What was built
- `src/features/speak/draft.ts`: one new read-only function, `hasKeptRecording(owner)` (11 lines). It reads only the person's own key. Writes, claims and removes nothing. A guest (null) gives false. A recording older than 7 days gives false. A storage error gives false. Nothing else in `src/features/speak/**` changed.
- `src/features/profile/useSignOutConfirm.tsx` (new, 35 lines): one shared hook. Sign out checks for a kept recording. With none, it signs out at once as today. With one, it shows the site's own `Dialog` from `src/components/vx` with exactly: "You have a recording you have not sent. Sign out anyway?" and the buttons "Sign out anyway" and "Go back". No new component, no inline styles, no colours. Escape and the close button are Go back. Focus goes into the dialog.
- `SettingsPage.tsx`: both Sign out buttons (desktop and phone) use the hook. `DeletionPending.tsx`: its Sign out uses it too.
- Source change: 4 files, 54 lines added, 4 removed (`git diff --stat origin/main -- src`).

## Which Sign out buttons got it
Settings desktop, Settings phone, Deletion pending. NOT admin (`AdminFrame.tsx`, two buttons). Its sign-out is a plain synchronous call that three existing admin tests click and check straight away (`tests/admin-login.test.tsx` line 89, `tests/admin-phone.test.tsx` line 115), and the warning needs a storage read first. Left as it is, as the order allows.

## Tests
`tests/signout-warn.test.tsx`: 10 tests, covering cases 1 to 8 of the order (plus Escape and focus, and queued and reply recordings). On a clean `origin/main` checkout, 7 of 10 fail:
- 1 (Settings kept recording): `Unable to find role="dialog"`
- 1b (Escape): `Unable to find role="dialog"`
- 2 (Sign out anyway): `Unable to find role="button" and name "Sign out anyway"`
- 2b (queued and reply): `Unable to find role="dialog"`
- 6 and 8: `hasKeptRecording is not a function`
- 7 (Deletion pending): `Unable to find role="dialog"`
The three "no dialog" cases (3, 4, 5) pass on main, as they should.

## Browser (built app, next start, stubbed API, fake microphone)
`e2e/signout-warn.e2e.mts`, 390x844 and 1440x900: all 2 ok. Record, do not send, Settings, Sign out: dialog with the exact sentence, focus inside. Escape and Go back: still signed in, recording still there. Record screen, Send: clips 1, posts 1. Sign out anyway: signed out, lands on `/`, recording gone. Sign in again: no recording. Nothing recorded: Sign out at once, no dialog.
Screenshots in `docs/lead/proof/signout-warn/`: `dialog-390-light`, `dialog-390-dark`, `dialog-1440-light`, `dialog-1440-dark`.
Record screen unchanged: `e2e/draft-owner.e2e.mts` (both widths) all 38 ok (the two known timing misses did not occur on this run). `e2e/surveys-r9.e2e.mts` no FAIL lines.

## Gates
`npx tsc --noEmit` 0 errors. `npx next lint` no warnings or errors. `npx next build` ok. `npx vitest run` exit 0 three times: 154 files, 1572 tests each time (before the report and e2e files were added; they add no test files).

## Could not prove / notes
- jsdom has no IndexedDB, so the unit tests use a small stand-in store; the real IndexedDB is covered by the browser run.
- The check is a quick storage read, so on a very slow device the tap takes a moment before signing out. A sign-out in another tab cannot be warned about (as ordered).
- The commit trailers use the session attribution given in this session's instructions, not the one in the order text.
