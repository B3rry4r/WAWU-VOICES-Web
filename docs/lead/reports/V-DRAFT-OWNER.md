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

# Round 2

## 1. Signed out in another tab is not a guest
`src/features/speak/draft.ts` (`openedFor`, `leaveTab`, `signedInAsSomeoneElse`, `saveDraft`, `loadDraft`).
- A tab is for one person for the life of the page. It follows who is signed in until another tab writes the session (the `storage` event, sent only for other tabs' writes); that first event pins the person the tab had (from the event's old value). The session going away (a sign-out in another tab, or a session that ran out) never lets go of it.
- Only something done in THIS tab changes it: a sign-in here when no session was stored (`onOwnTokenWrite`, a small notice added to `src/lib/auth/session-storage.ts`; tokens are stored exactly as before; a refresh of someone else's stored session does not count), or `leaveTab()` from `signOut` in `src/lib/api/auth.ts`. A tab that was a guest at load stays a guest until a sign-in here, so the guest claim works as before.
- `saveDraft` now stamps the screen's person, never null for A. While nobody is signed in, A's tab keeps the take with owner A. `loadDraft(A)` returns it only for A; `loadDraft` claims a guest recording only when the person is signed in as that person. If another person signs in on the browser, the old rule still removes the recording when they open a screen (it was already so on main; the recording is lost, not leaked).
- A session that runs out in a lone person's one tab: kept for A, and A has it back after signing in again (browser R1c, unit 1c).

## 2. A remount must not change the tab's person
The person is module state, so a remount, going Home and back, or a new screen in the same tab gets the same person. It does not depend on timing.
(d) A tab that missed the event: it believes the last person it knew (A). That is safe because the event only decides who the tab is for; every write, restore and clear also compares that person with who is signed in right then (`signedInAsSomeoneElse`), so if B is signed in the tab is refused whatever it believes. Proved in the browser (R2d: this tab's `storage` listener switched off, B written into storage from inside this tab: nothing written, line shown) and in the unit test 2d. I did not use per-tab `sessionStorage`: the person is already kept per page and the comparison covers the rest; a reload reads the signed-in person again, which is what "Reload to carry on" says.
The Outbox now uses the tab's person too (`openedFor()`), so A's tab no longer shows or sends B's waiting recording from Home.

## 3. The typed draft
Additive; a draft stored without a person behaves exactly as today.
- Held words after "out of posts" (`src/features/units/draft.ts`): `HeldDraft.owner?`. Every function takes the person as an optional last argument. Given: another person's draft is never shown, overwritten or cleared, and nothing is read or written while someone else is signed in. Callers (`WriteScreen`, `OutOfPostsSheet`, `BuyUnitsScreen`, `PaymentDoneScreen`, `post-draft.ts`) pass `openedFor()`.
- Typed text in the box (`talk/lib.tsx` `typedDraft`/`saveTyped`, used by `WriteScreen` and `ReplyComposer`): the owner is kept beside it in `voices-typing-owners`, so the words keep their old shape.
- `WriteScreen` and `ReplyComposer` send nothing, and say the same line, when someone else is signed in.
- Consequence to know: if A left typed words for a question and B (same browser) opens that question, B's typing for that slot is not stored until A's words are sent or cleared by A. That follows "never overwritten".

## Tests and logs
- `tests/draft-owner-2.test.tsx` (10): cases 1, 1b, 1c, 1d, 2, 2d, 2e, the guest tab, held words, typed words.
- One existing test file got one setup line, not an assertion: `tests/share-card-guest-return.test.tsx` calls `leaveTab()` in `beforeEach`, because each test there is a new page load and the tab person is now module state.
- Browser (built app, two tabs in one context, 390 and 1440), `e2e/draft-owner.e2e.mts`: all of round 1 again, plus
  - R1a: A signed out in another tab, tab 1 records: `kept ... owner "A"`, line 0; B opens the record screen: Send 0, draft null.
  - R1b: A signs in again in a new tab: Send 1, draft owner A.
  - R1c: A's session ends in the one tab, records: kept owner A; sign in again, reload, Send: clips 1, posts 1.
  - R2a: pick screen 3 s, B signs in, "Say it in", record: draft null, line 1, Send sends 0.
  - R2b: B's recording: A's tab has no Send, no Play, no Delete, no Record again; SHA-256 of B's blob before and after `ba7816bf8f01cfea...` both, same true.
  - R2c: Home, then the record screen inside the app: take shown 0, line 1, B's recording same, clips 0.
  - R2d: as above, draft null, line 1.
  - R3: A types, leaves, comes back: "A typed this"; B opens it: ""; stored words stay `{"q:q1":"A typed this"}` with owner A (B's and A's new typing refused). Typed 10 runs at each width still post once (clips 0, posts 1, line 0 every run).
- Full run `/tmp/full4.log` (RUNS=10): everything ok except R2c at 390, where my test clicked a hidden link; fixed the test only (no app change) and re-ran R2c at 390 and 1440: ok. The R1a log line `Play 1` is the "Play the VOICES song" button, counted by an old regex; the assertion was on Send and the draft.
- The hard rule at both widths (voice 10, typed 10, refresh 10 each, offline kept and reload, two tabs, guest sign-in) ok again.

## Totals, round 2
`npx tsc --noEmit` clean. `npx next lint` clean. `npx vitest run` exit 0: 137 files, 1401 tests, no unhandled errors. `npx next build` compiled.

## Not proved, round 2
Real sign-in screens (stubbed), real phones and Safari, and a guest tab refreshing a token the other person's tab stored (a guest has no refresh token to use, so it should not happen).

# Round 3: one rule, per person

Both HIGH findings fixed. The one shared slot and "never overwritten" are gone.

## The rule as built (keys and shapes)
- **Recording** (`src/features/speak/draft.ts`): IndexedDB `voices-speak` / `drafts`, one key per person: `rec:<personId>` or `rec:guest`. Same `Draft` shape, `owner` inside. Nothing is written under another person's key.
- **Held posts** (`src/features/units/draft.ts`): `voices-held-v2` = `{ <personId>: { <questionId>: HeldDraft } }`. A guest's (and anyone's with no person) stay in main's table `voices-held-drafts`, so "guest" = main's table and old code and tests read it unchanged.
- **Typed words** (`src/features/talk/lib.tsx`): `voices-typing-v2` = `{ <personId>: { <slot>: { t, at } } }`; guest = main's `voices-typing-drafts`.
- **Tab person** (`openedFor()`): a real person A stays A for the life of the page whatever other tabs do; only a sign-in or sign-out done in this tab (`onOwnTokenWrite`, `leaveTab`) or a page load changes it. A GUEST tab follows: when a session appears, here or elsewhere, the tab becomes that person's. The `storage` event is no longer used.
- **R3**: before a write, restore or clear, if the tab's person is A and a different real person is signed in right now (`signedInAsSomeoneElse`), nothing touches storage, nothing is sent, and the line is shown. Nobody signed in: A's key. A guest is never "someone else".
- **R5**: sign-out in this tab removes that person's recording (`afterSignOut`); typed words and held posts stay under their key.
- **R6**: at app start (`Outbox` mount) `sweepOldRecordings`, `sweepOldHeld`, `sweepOldTyped` remove anything older than 7 days, any person's key (recordings without reading audio).
- **R7**: main's recording slot `current` goes to its owner's key on first access (owner null: guest). Main's typed words and held posts (no person) are taken, once, by the person or guest who first opens that question. The guest claim moves a guest recording to the person who is signed in (only when that person has none), and a question's guest words and held post on first open.
- **Deviation to rule on**: main (and the existing test "another account never sees a signed-in person's recording, and it is removed when they sign in", which I did not edit) removes other people's recordings when a signed-in person loads. I kept that for recordings only. Per-person keys mean it no longer blocks anything. If you want A's recording to survive B's sign-in, that one assertion must change; I did not touch it.
- Also changed for fault 1: `useSignedIn` (`talk/lib.tsx`) follows a session that appears in another tab, so a guest's write screen turns into the box; the record screen's Send checks `isSignedIn()` at send time. When this device cannot keep a recording or typed words (storage missing, full, throwing) the screen says so (`keepFailed()`, `saveTyped` returns false).

## Every call site (person = `openedFor()` read at use)
speak/SpeakScreen.tsx 144-145 (keepReply), 154-155 (restore), 159 (stale), 343, 354 (drop, close), 396, 401-402 (keep offline), 421-423 (guest asked to sign in), 465-469 (post, clear), 517 (sign in again). speak/Outbox.tsx 39, 73 (look, send, remove; sweeps at start). speak/outbox.ts (sendHere checks the draft's owner; renewed key saved under the draft's own owner). talk/VoiceReply.tsx 55, 71-75 (send, keep). talk/WriteScreen.tsx 63, 94-134, 162, 173 (typed words, held post, send guard). talk/ReplyComposer.tsx 34, 42, 53, 60, 76. units/BuyUnitsScreen.tsx 19, 66. units/OutOfPostsSheet.tsx 28, 62. units/post-draft.ts 25-43. units/PaymentDoneScreen.tsx 174, 322. lib/api/auth.ts `signOut` -> `afterSignOut`. lib/auth/session-storage.ts `onOwnTokenWrite` (a notice after the write; tokens stored as before). `client.ts` untouched.

## Tests touched
Vitest: only my own branch files changed in this round: `tests/draft-owner-2.test.tsx` (the guest-tab, held-words and typed-words tests rewritten to the new rule; the round 2 cases 1, 1b, 1c, 1d, 2, 2d, 2e stay) and new cases in it. `tests/draft-owner.test.tsx` unchanged. Tests from main: only the person argument and one `leaveTab()` setup line (`share-card-guest-return`), as in earlier rounds: w4-recorder, w4-speak, wf6b-people, fixd-outbox, fixd-outbox-r2, fixd-round3, share-card-guest-return. No assertion edited.
E2E scripts (not vitest): the three old browser scripts `fixd`, `fixd-round3`, `fixb` and my round 1 and 2 script read the recording from the old `current` slot; their read helper now reads any `rec:*` key. Their seeds still write the old `current` slot, which exercises the migration.

## Browser proof (built app, one context, several tabs, 390x844 and 1440x900)
Real sign-in screen driven against a stub of the sign-in host in the fault 1, S1, S2 and H1 cases.
- Fault 1 voice, 5 runs per width: tab 1 a guest on the record screen, the same person signs in on tab 2, tab 1 records and Sends: `clips 1, posts 1 (all 1), line 0` every run. Guest already HAS a take: `guest take kept: ["rec:guest"]`, after the sign-in elsewhere Send: clips 1, posts 1, recording keys left [], line 0.
- Fault 1 typed, 5 runs per width: guest write screen turns into the box when the session appears; types, Posts: posts 1, line 0 every run.
- Fault 2 S1: A types "A words here", signs out, B signs in on the same tab: B opens "" , types, leaves, comes back: "B words here"; A signs in later: "A words here"; stored `{A:{q:q1:...},B:{q:q1:...}}`.
- Fault 2 S2: out of posts (402) for A, then B: `voices-held-v2` holds both, A's "A held words" and B's "B held words"; B back in has "B held words". Paying and posting after payment, also as a full page load back from the payment page, is covered by the existing vitest (`units-checkout`, `c23-held-draft`, `talk`), which pass; I did not drive the payment pages in the browser.
- Rounds 1 and 2 again (`e2e/draft-owner.e2e.mts`, RUNS=10): 38 of 38 ok at both widths, including A signed out elsewhere keeps owner A, B's bytes SHA-256 same before and after, in-app navigation, a missed event, the hard rule (voice 10, typed 10, refresh 10, offline kept and reload, two tabs, guest sign-in).
- H1 sign out and in again in the same tab: keys before `["rec:A"]`, after `[]`; the new take sends once. H2 three tabs of the same person, one kept recording: clips 1, posts 1, line 0. H3 storage errors: IndexedDB missing, IndexedDB full, `localStorage` throwing for typed words: online recording and typing work, 1 post each, the screen says it could not keep it.
- Line count over the round 3 script: `LINE TOTAL over 32 sends: 0`. Over the 10-run hard rule of rounds 1 and 2 the line count was 0 as well (every run printed `line 0`).
- Old browser scripts on this build: `fixd-round3` all ok, `fixb` all passed, `fixd`: all ok except "two tabs with one kept recording", which fails the same way on `origin/main` (it expects both tabs to print the posted note; main prints it in one). `anon` could not start (hard-coded browser path).
- Upgrade (R7): built `origin/main`, served it on a port, kept a recording (owner A), typed words and a held post with a persistent profile; stopped it; served this branch on the same port and same profile. Result: recording moved to `rec:A` and shows Send on the record screen; typed words come back "old typed words" (taken once into `voices-typing-v2`); the held post was taken by A with the same key `545c84b4...` on the next out-of-posts, main's table left `{}`; Send then posted once. A alone lost nothing.

## Totals, round 3
`npx tsc --noEmit` clean. `npx next lint` clean. `npx vitest run` exit 0: 137 files, 1403 tests, no unhandled errors. `npx next build` compiled.

## Could not prove
Real sign-up with the emailed code in the browser (covered by the existing vitest `share-card-guest-return`); a voice reply and a typed reply as new e2e cases (covered by the old `fixd` and `fixd-round3` scripts, which pass); the payment pages as a full page load; real phones, Safari and private windows; a guest tab that refreshes a token stored for someone else (a guest has none).
