# V-DRAFT-OWNER: a kept recording belongs to the person the screen was opened for

Branch `v/draft-owner`, cut from origin/main c934e9b. No pull request opened.

## The fault
`saveDraft` stamped the kept recording with whoever was signed in at the moment of the save. A's open tab could keep A's take under B, and could show B's take.

## What changed
- `src/features/speak/draft.ts`
  - `saveDraft(input, owner)`, `loadDraft(owner)`, `clearDraft(owner)`, `saveDraftKeepingReply(input, owner)` now take the person (null = guest). If someone else is signed in (`signedInAsSomeoneElse`): nothing is written, nothing is returned, nothing is cleared. Same slot, same shape, so drafts already on devices still load. The guest claim rule is unchanged.
  - `OTHER_TAB_NOTE` is the one line: "You are signed in as someone else in another tab. Nothing was saved. Reload to carry on."
  - `openedFor()`: the person this TAB is for. Needed because "Say it in 60 seconds" opens the record screen inside A's tab after B has signed in; reading the token at that mount would give B. The browser tells a tab about token writes made by other tabs (`storage` event); the first one freezes the person the tab knew (from the event's old value). Sign-out lets go. With no other tab writing, it is simply who is signed in.
  - `wipeDraft()`: sign-out only (clears whoever's, as before). Sign out ends the session in every tab.
  - Removing someone else's recording when you load (the old rule) now removes only the very recording it read (`wipeIfStill`). Found by the proof: a recording B kept a moment later was swept away by it (a race that was already on main).
- `src/lib/api/auth.ts` line 124: `signOut` calls `wipeDraft()` (was `clearDraft()`). Sign-in untouched. `client.ts` untouched.
- `SpeakScreen.tsx`: owner read once at mount (`openedFor()`); every call passes it; the line is shown through the existing note banner (danger tone); Send from a stale screen sends nothing (checked at the start and again just before the post).
- `Outbox.tsx` / `outbox.ts`: see below. Sending a kept recording is refused when its owner is not who is signed in.
- `VoiceReply.tsx` + `VoiceBox.tsx`: the reply sheet remembers its person; its keep and its send refuse for someone else and show the line (VoiceBox got one more answer from `keep`, `other_tab`).

## Every call site (after the change)
SpeakScreen.tsx: loadDraft 155; clearDraft 160 (7 day stale), 342 (dropTake), 353 (close), 468 (after post); keepReply (saveDraftKeepingReply) 184 (tag), 223 (finish recording), 499 (new key), 510 (Get tokens), 516 (sign in again); loadDraft 395 and saveDraft 400 (keepForLater, offline); saveDraft 422 (guest asked to sign in).
Outbox.tsx: loadDraft/clearDraft in `look`, `send` (stillKept, onPosted, stillWaiting), `remove` (banner X).
outbox.ts: saveDraft (spent key renewed) with the draft's own owner.
VoiceReply.tsx: loadDraft + saveDraft in `keep`.
auth.ts 124: wipeDraft (sign-out).
Not changed, listed because asked: the typed draft (`units/draft.ts`, used by `WriteScreen`, `talk/lib` typed text) is a different store, keyed by question, with no owner and no one-slot shape. It is not the recording slot and has not been touched. It can show A's typed words to B on a shared browser: that is a separate fault and a call for the owner (adding an owner there changes what is stored).

Outbox note: the box lives across a sign-in in one tab, so reading the person once at mount would make a lone person's offline recording stop sending after they sign in. It reads the person at the start of each look and holds it for that pass (load, send, clear). A banner remembers who it was shown for, so its X only ever removes that person's recording.

Nobody signed in (session ended) is not "someone else": it behaves as before, so a recording made when a session ends is still kept and claimed on the next sign-in.

## Existing tests
Only the person argument was added to calls, passing `currentOwner()` so each test behaves as before. No assertion changed.
Files: w4-recorder.test.ts, w4-speak.test.tsx, wf6b-people.test.tsx, fixd-outbox.test.tsx, fixd-outbox-r2.test.tsx, fixd-round3.test.tsx, share-card-guest-return.test.tsx.

## New tests
`tests/draft-owner.test.tsx` (6): cases 1 to 4 at the draft and box level, the guest claim, and 20 save/load/refresh/clear rounds for one person (no refusal).
`e2e/draft-owner.e2e.mts`: built app (`next build`, `next start -p 3977`), fake microphone, API and sign-in stubbed in the page, two tabs in one context, 390x844 and 1440x900. Full log: below.

## Browser proof (22 of 22 ok, RUNS=10)
Cases 1 to 4 pass at both widths. Key lines (390):
- 1: draft after A's 1.3 s take: null; line shown: 1; Send on the stale screen: clips 0, answers 0; B's record screen: Send buttons 0, line 0, draft null.
- 2: A's kept take owner A; as B: clips 0, answers 0 (all clips 0, all answers 0); kept now null.
- 3: A's tab: Send buttons 0, line 1; draft still {key b-key, owner B}; B's tab: Send buttons 1.
- 4: after A taps X: draft still {key b-key, owner B}, line 1. (Repeated 6 more times at both widths: all ok.)
Hard rule, each at 390 and 1440:
- Screen has the question, Pick one word, ANGRY TIRED PROUD HOPEFUL, Say it in N seconds, Type it instead, Share my word.
- Voice 10 runs: every run clips 1, posts 1, line 0. Typed 10 runs: every run clips 0, posts 1, line 0.
- Token refresh in the middle, 10 runs (5 in the same tab, 5 from another tab of the same person): every run clips 1, posts 1, line 0. With the 20 rounds in the unit test, a person alone never saw the line.
- Offline Send kept (queued, owner A), reload shows it on the record screen, network back and Home: clips 1, posts 1, nothing left kept.
- Two tabs, same person, one kept recording: clips 1, posts 1, line 0.
- Guest records, asked to sign in (kept with owner null), signs in, comes back (claimed by A): clips 1, posts 1, line 0.

## What I could not prove
- Sign-in is stubbed by writing the token, as the brief said. The real sign-in screens were not driven.
- Real microphones on phones, Safari and a private window (IndexedDB blocked). Memory-only keeping is covered by unit tests only.
- The typed draft (above) is not covered.
- A tab opened before this release has none of this until reloaded.

## Totals
`npx tsc --noEmit` clean. `npx next lint` clean. `npx vitest run`: 136 files, 1391 tests, all pass (one earlier run had `tests/round4.test.tsx` fail once; it passed alone and on the next full run). `npx next build` compiled. Browser: 22 of 22.
