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

## Round 2 (fixes for the check's 2 HIGH and 2 MEDIUM)
Merged `origin/main` (eefa0a4) first, as a merge commit.

1. HIGH 1, storage that never answers. The 1 second limit is one constant, `CHECK_MS`, in the hook (`useSignOutConfirm.tsx:8`, used in `ask`), not in `hasKeptRecording`: the hook owns how long the person waits, and the read stays a plain read. No answer in time counts as "no recording" and signs out as before. A late answer does nothing (it is settled once, and the hook ignores it after unmount).
2. HIGH 2, "Sign out anyway" on someone else. The hook remembers who the warning was for (`useSignOutConfirm.tsx:37`). On "Sign out anyway" it signs out only if that same person is still signed in (`useSignOutConfirm.tsx:49`); otherwise it closes the dialog and does nothing else. The no-dialog path is unchanged.
3. MEDIUM 3, a take held only by the page. `hasKeptRecording` now also says yes for this person's fresh take in the in-page `memory` map (`draft.ts:206`). Still read-only. `git diff origin/main -- src/features/speak` is only `hasKeptRecording` (12 lines).
4. MEDIUM 4, nothing shows while waiting. The hook returns `checking`; the three Sign out buttons use the `Button` `loading` prop (`SettingsPage.tsx:196`, `SettingsPage.tsx:257`, `DeletionPending.tsx:66`). That disables the button and shows the usual busy spinner, so a second tap does nothing.

Failures on bfe4953 (new tests a to d, same test file): a "expected token to be null" (still signed in after 2.5 s); b "expected null to be Bola's token" (the other person was signed out); d "expected false to be true" (button not disabled while waiting); c "Unable to find role=dialog". All four pass now.

Browser (built app, 390 and 1440), `e2e/signout-warn.e2e.mts`: all 6 ok. HIGH 1: IndexedDB `open` never answers, signed out after about 1050 ms, button busy while waiting, no dialog. HIGH 2: Alice's dialog open, Bob signs in in tab 2 with a kept recording, "Sign out anyway": Bob still signed in, no sign-out call, keys before and after both `rec:A`, `rec:B`. The everyday flow (record, Settings, Sign out, dialog, Go back, Send: 1 clip, 1 post; Sign out anyway: signed out; nothing recorded: at once) passes at both widths.
Other browser runs: `e2e/draft-owner.e2e.mts` 37 of 38 ok at both widths together; the one miss is case "4" at 1440, the known script-timing miss. `e2e/surveys-r9.e2e.mts`: ALL PASSED 6.

Gates: `tsc --noEmit` 0 errors; `next lint` no warnings or errors; `next build` ok; `vitest run` exit 0 three times (156 files, 1591 tests each time).

Could not prove: a real browser whose IndexedDB `open` hangs (a stub stands in); the page-held take (finding 3) is covered by a unit test only, not in a browser; Deletion pending in a browser (unit test only).
