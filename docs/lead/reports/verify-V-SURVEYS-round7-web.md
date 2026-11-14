VERDICT: FIX
INTERIM

# Verify V-SURVEYS round 7 (website), interim

Code: `origin/v/surveys` 7540b72, built with `next build` + `next start`, Chromium (Playwright, fake microphone), 390x844, my own browser stub for the API and sign-in. No live service, no `.env`. I changed no product code and no existing test. My attack scripts are not committed. (I reused the builder's stub file `e2e/round7-stub.mts` as the fake server; the scenarios are mine.)

## Findings so far, most severe first

### HIGH 1. A's recording is kept under B, and goes out as B
`src/features/speak/draft.ts:90` `saveDraft` and `SpeakScreen.tsx:174, 213, 390` (and the save calls at `:409, :488, :505`) pick the slot from whoever is signed in **at the moment of the save** (`currentOwner()`), not from the person the screen was opened for (`owner.current`, `SpeakScreen.tsx:83`). The send path checks the person; the keep path does not.
Steps (390x844, one browser, two tabs of one profile):
1. Tab 1 signed in as A, record screen, word PROUD, record 1 second (take shown).
2. Tab 2: B signs in (same browser storage).
3. Tab 1: go offline, tap Send. The screen says it is saved.
4. Back online, open Home in tab 2 (the outbox runs as B).
Result, from the stub log: slots `u:A` and `u:B` both hold the same recording key; `clips by [B]`; `posts [["B","49def1"]]`. **A's voice was created and posted as B.** `u:A` still holds the same recording, so when A signs in again it can go a second time, as A, with the same key (not run to the end).
No "signed in as someone else" line was shown: the offline path has no person check.

### HIGH 2. A's stale tab writes A's recording into B's slot, and B gets it on the record screen
Same cause. Steps: tab 1 as A on the record screen, tab 2 signs in as B, tab 1 records (no send). The 300 ms autosave (`SpeakScreen.tsx:213`) writes A's recording to `u:B`. Tab 2 (B) opens the record screen: it shows a take with a Send button. B hears A's voice and can post it. If B already had a kept recording in `u:B`, it is overwritten (the overwrite I saw only by reading the code; the restore I ran: slot list after: `[{"slot":"u:B","key":"2338fb23..."}]`, `before: []`).
Related, seen while testing: with B's kept recording in `u:B`, A's open tab shows **B's** recording (play button, 4 seconds) after A taps "Say it in 60 seconds", because the restore reads the slot of whoever is signed in now.

### MEDIUM 1. A stale banner's X removes B's kept recording
`Outbox.tsx` `remove()` and the `onPosted` callback call `clearDraft()` with no person, so they clear the **current** person's slot. Own vitest (not committed): A's "A recording is waiting" banner open, B signs in and has a kept recording, A taps the X: B's recording is gone (`B undefined`), A's stays. A's Send on the same stale banner sent nothing (the `stillWaiting` check saw a different key), which is right.

## What held so far
- Main c934e9b is inside the branch (`git merge-base --is-ancestor origin/main HEAD` true). `docs`: contract file untouched by this check, to be confirmed in the final report.
- `npx tsc --noEmit` 0 errors. `npx next lint` clean. `npx vitest run` 1530 of 1530 passed (one run). `npx next build` ok.
- Test diff since ba16240: `fixd-outbox.test.tsx` and `fixd-round3.test.tsx` gained only the subject argument (one line each). `w4-recorder.test.ts` (last assertion flipped) and `voice-clip-subject.test.tsx` (cleanup) changed too, as the builder said.
- A stale A banner does not send A's recording as B (unit run).

## Not done yet (final report, within 70 minutes)
Record screen voice/typed 10 each, token and network faults, reload; outbox answer and reply as another person; three-person and 7-day and 20-recording runs; results page floors 5 and 20 and CSV; the rest of the site; round 6 H1 / M1 / M2 / L1-L3 status lines.
