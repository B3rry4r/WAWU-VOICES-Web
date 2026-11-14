VERDICT: FIX

# Verify V-SURVEYS round 7 (website)

Code under test: `origin/v/surveys` 7540b72, built with `next build` + `next start`, Chromium (Playwright, fake microphone), 390x844 and 1440x900. API and sign-in were answered by a stub inside the browser (I reused the builder's `e2e/round7-stub.mts` as the fake server; the scenarios are mine). No live service, no `.env`. I changed no product code and no existing test. My attack scripts and tests were not committed and are deleted from the tree. Only this report is pushed.

## Round 6 findings, from my own runs

| Round 6 | Now | Basis |
|---|---|---|
| H1 outbox posts A's saved voice as B | **CLOSED** | 20 browser cases (answer and reply, in a real browser): B signs in when the create, upload, complete, ready or post request arrives, A's token valid or run out (401 wait). Posts as B 0, clips as B 0, B's refresh tokens spent 0, B's pair untouched in all 20. A's recording kept in 19 (see "posted but still kept" below). A alone with token run out at the post: sent once (builder's script, 3 of 3 alone; one run under load missed its 6 s wait). |
| M1 choice rows and "Other" under the floor | **CLOSED** | See section 4 below. |
| M2 B opening a page deletes A's recording | **CLOSED for reading**, but the new slots are **not safe for writing** (HIGH 1, HIGH 2) and sign-out still removes it (MEDIUM 2). | |
| L1 reload mid-send makes a second clip | **OPEN** | Voice, Send, reload while complete is pending, Send again: 2 clips, 1 post, same key. |
| L2 stale tab spends another person's refresh token | Not re-run. | |
| L3 posted page makes a share link as B | Not re-run. | |

## Findings, most severe first

### HIGH 1. A's recording is kept under B, and goes out as B
`src/features/speak/draft.ts:88-91` `saveDraft` chooses the slot from whoever is signed in at the moment of the save (`currentOwner()`), not from the person the screen was opened for (`owner.current`, `SpeakScreen.tsx:83`). Callers: `SpeakScreen.tsx:174, 213, 390, 409, 488, 505`. The send path checks the person; the keep path does not.
Steps (390x844, one browser, two tabs):
1. Tab 1 signed in as A, record screen, word PROUD, record 1 second.
2. Tab 2: B signs in (same browser storage).
3. Tab 1: network off, tap Send. The screen says the recording is saved.
4. Network back, open Home in tab 2 (the outbox runs as B).
Stub log: slots `u:A` and `u:B` both hold the same key; `clips by [B]`; `posts [["B","49def1"]]`. **A's voice was created and posted as B.** `u:A` still holds the same recording (key the same), so it can go a second time as A when A signs in (not run to the end). No "signed in as someone else" line is shown on this path.
Should: take the slot from the person the screen was opened for (or refuse to save and say so when `sessionSubject()` differs), as the send path already does.

### HIGH 2. A's stale tab writes A's recording into B's slot; B gets it on the record screen
Same cause. Steps: tab 1 as A on the record screen, tab 2 signs in as B, tab 1 records 1 second (no send). The save at `SpeakScreen.tsx:213` writes to `u:B` (slots before: none; after: `u:B`). Tab 2 (B) opens the record screen: it shows a take with a Send button. B hears A's voice and can post it as B. If B already had a kept recording, it is overwritten (code read; I did not run the overwrite).
Mirror case, run: B has a kept recording, A's open tab taps "Say it in 60 seconds": A's tab shows **B's** recording (play button, 4 seconds), because the restore reads the slot of whoever is signed in now.

### MEDIUM 1. A stale banner's X, and a finished send, clear the wrong person's slot
`Outbox.tsx` `remove()` and the `onPosted` callback call `clearDraft()` with no person, so it clears the current person's slot.
- Own vitest: A's "A recording is waiting" banner open, B signs in and has a kept recording, A taps the X: **B's recording is gone**, A's stays.
- Browser, "B signs in at the post" (answer and reply): the post went out as A (it was already in flight), but `u:A` is still kept afterwards, so A will be offered and re-send it on the next sign-in with the same key (server should answer with the first post; not run).
A's Send on the same stale banner sends nothing (right).

### MEDIUM 2. Signing out removes A's kept recording
`src/lib/api/auth.ts:125` `signOut` clears the signed-out person's slot. My run: A keeps a recording, signs out, signs in again: **GONE**. You said it should still be there. The builder wrote it as intended ("signing out still removes your own kept recording"), so this is a decision to confirm, not a certain fault. A person who tapped Send offline, was told "saved on this device", then signed out loses it with no warning.
Account deleted and "sign out everywhere" (password reset): nothing clears the slot (only `signOut` does). A deleted person's kept audio stays on the device (see LOW 1).

### LOW 1. Another person's kept recording never expires or is cleaned up
`draft.ts:113-118`: another person's slot is removed only if it is in the old shared slot. Run: 20 people each keep a recording, all 30 days old; B opens pages: **20 of 20 still kept**; P3 comes back and it is flagged stale only then (removed when P3 opens a screen). Size is the recording itself (a 60 s clip is a few hundred KB), so 20 people is about 10 MB in IndexedDB. Nothing is sent for people who are not signed in (the outbox only reads the signed-in person's slot). A recording of a person who never returns stays forever, including a deleted account's.

### LOW 2. A reload in the middle of a send makes a second clip (round 6 L1, still open)
2 clips, 1 post, same key. The first clip is an orphan.

## What held
1. **Record screen, one person, one tab (hard rule).** Question, "Pick one word", ANGRY TIRED PROUD HOPEFUL, "Say it in 60 seconds", "Type it instead", "Share my word" present at 390 and 1440 in every run.
   - Voice, 10 plain runs at each width: 1 clip, 1 post, 0 refresh, no stale line, no sideways scroll. Typed, 10 plain runs at each width: 1 post, 0 clips. (Builder's `e2e/round7.e2e.mts`, run by me: 14 of 15 passed, the 15th passed 3 of 3 when run alone.)
   - Token runs out at create, complete, ready, post (voice) and the typed post: 1 refresh, 1 clip, 1 post each.
   - Network drops once at create, upload, complete, ready, post (my script, both widths, 10 cases): ends posted after one more tap; 1 clip, 1 post, 1 key every time.
   - Offline then back, two tabs of A: 1 clip, 1 post.
2. **Outbox as another person**: the 20 cases above. B's tokens are never spent, nothing as B, stored pair is B's own. A's kept recording stays in 19 and A alone sends once with a token run out at the post. No stale line shown to a person alone.
3. **Kept recordings of two people**: B opens Home and the record screen: sees nothing of A's; B records, keeps and sends their own (1 clip, 1 post as B); A signs in again: A's recording is there and sends once with its own key (builder's M2 browser test, run by me). Age limit: exactly 7 days is not stale, 7 days and 1 ms is stale (own vitest). Three people by unit test: each sees only their own.
4. **Small rows never drawn** (own vitest, page and CSV, floors 5 and 20, `hidden` true and false): choice rows with 1 and floor-1 answers and an "Other" under the floor are not drawn and not in the CSV (the choice names show "Fewer than N answers, not shown" and are `hidden` in the CSV); a choice with 0 is drawn "DDD 0 · 0%", CSV `DDD,0,0`; a row exactly at the floor is drawn (`EEE 5`/`20`); state and age rows under the floor are not drawn; dropped rows pooled with a server "Other" are drawn only if the sum reaches the floor. CSV columns: Section, Question, Answer, Count, Share (%), Seconds. ADMIN and AD_MANAGER on a running survey: "12 people have answered so far" and no question, choice or state text.
5. **Join**: main c934e9b is inside the branch (`merge-base --is-ancestor` true); nothing to merge. `contract/openapi.yaml` is the branch's (survey routes present: 9 `/admin/surveys` paths).
6. **Gates on the tree**: `npm ci` ok; `npx tsc --noEmit` 0 errors; `npx next lint` clean; `npx vitest run` 1530 of 1530 passed (one full run; opening test did not fail); `npx next build` ok.
7. **Test diff** `git diff ba16240..HEAD -- tests`: `fixd-outbox.test.tsx` and `fixd-round3.test.tsx` gained only the subject argument, one line each. Also changed, as the builder said: `w4-recorder.test.ts` (last assertion flipped to "A's recording is back") and `voice-clip-subject.test.tsx` (cleanup). The M2 ruling and the sign-out behaviour are not pinned together by any test.
8. DMs off: `DMS_LIVE = false` (`src/features/dm/live.ts:7`).

## Could not prove
- Section 5 in a browser (sign-in, sign-up, verify code, Home with admin posts first, question page, vote, like, reply, edit and delete from Profile, share buttons, admin sign-in and Users on a phone): not run in a browser by me. They pass in the repo's own tests (1530).
- Voice reply from a record-screen browser run, and "explain my vote" by voice. The saved voice reply through the outbox was run in the browser (20-case matrix above).
- Round 6 L2 and L3; what the real server does with a replayed key or a clip under another person; a real phone; the overwrite of B's kept recording by A's stale tab (HIGH 2, read in code and shown by slot list only).
- Only 3 people at unit level, not in a browser.
