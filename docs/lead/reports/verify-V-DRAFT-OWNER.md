VERDICT: FIX

# verify-V-DRAFT-OWNER

Branch checked: `v/draft-owner` at 7ec4ea4. Built with `next build`, served with `next start`, Chromium with a fake microphone, API and sign-in host stubbed in the browser (no live service called, no `.env` opened). One browser context, several tabs, 390x844 and 1440x900. My attack tests are not committed. Sign-in here was driven through the real sign-in screen (Email or phone number, Password, "Sign in") against my stub.

## Findings, most severe first

### 1. HIGH: one person alone, a tab that was a guest, the same person signs in in another tab: the record and write screens say "You are signed in as someone else in another tab", nothing is kept, nothing is sent
Steps (both widths, every run):
1. One person, one browser. Tab 1 opens the record screen (or the pick-a-word screen) as a guest.
2. In tab 2 the same person signs in on the sign-in screen.
3. In tab 1: record a take, or type words, then Send or Post.
Result:
- Voice: the line is shown, kept recording is empty (`null`), Send sends 0 clips and 0 posts. Run at 390 and 1440.
- Typed: words are not stored (`voices-typing-drafts` is `null`), and Post shows the line.
- A fresh page load in tab 1 works. So does opening the record screen in a tab that was loaded after the sign-in (control: passes).
On main this works: the guest take is stamped with whoever is signed in and the person gets it.
Cause: `src/features/speak/draft.ts` lines 74-80. The first `storage` event pins the tab. For a guest tab the event's old value has no session, so `person` stays `null` and `pinned` stays true (line 78 only changes `person` when `before !== null`). From then on `signedInAsSomeoneElse(null)` is true (line 109: `me !== null && me !== owner`), so `saveDraft` (line 144), `loadDraft` (line 169) and `clearDraft` refuse, and `WriteScreen` refuses to send. Only a sign-in done in this tab un-pins it.
Likely real route: the code or the link opens in a new tab, or someone signs in in a second tab, while the first tab is still on the record screen.
Fix direction (not done here): a guest tab that sees a session appear elsewhere must not call that person "someone else". It should take the guest-claim route, or follow the new person.

### 2. HIGH: shared phone, same tab, next person: B's typed words and B's held post are silently not kept when A left words for the same question
Steps (S1, S2; S1 at both widths, S2 at 1440; S2 at 390 failed in my test's sign-out step, not in the app):
1. A signs in (sign-in screen), picks HOPEFUL, "Type it instead", types "A words here". `voices-typing-drafts` = `{"q:q1":"A words here"}`, owner `{"q:q1":"A"}`.
2. A signs out (Settings, Sign out). The typed words are NOT removed (sign-out clears only the recording).
3. B signs in in the same tab and opens the same question.
Measured, what B loses:
- B's box opens empty (good, B never sees A's words).
- B types "B words here", leaves, comes back: box is EMPTY. Stored words are still only A's. No line, no warning. B's typing for that question is never kept.
- B Posts: the post goes out once (answers 1), but A's words stay stored.
- Out of posts (402 FREE_POSTS_EXHAUSTED): A's held post is `{"q1":{"body":"A held words","owner":"A"}}`. B types "B held words", Post, the page goes to the buy screen. Held now: still only A's. B's words are NOT held. After B pays, nothing is there to post: B loses the typed post after paying.
- A signs in later: gets "A words here" back (good).
Cause: `src/features/talk/lib.tsx` `typedMine` and `src/features/units/draft.ts` `saveDraft` / `mine`: another person's slot is never overwritten, so the next person's words are dropped without a word shown. Builder's report called this out as a consequence; the loss is real and silent. It stays until A signs in and sends or clears. Nothing ever expires it.
Fix direction: give B their own slot (key by person), or tell B plainly it was not kept; and clear a person's typed words when they sign out, as the recording is cleared.

### 3. MEDIUM: same cause as 1 on the outbox and write screens for a guest tab
Not separately run. `WriteScreen`/`ReplyComposer` use the same `openedFor()` and compare. Covered by finding 1's fix.

## What held
- T1 (both widths): A's tab on the record screen; B signed in in tab 2, B signs out, A signs in again in tab 2. Tab 1 records and Sends for A with no reload: line 0, clips 1, posts 1, kept owner A. So it does not need a reload.
- T2 (both widths): A's tab; tab 2 goes A out, B in, out, C in (three people). Tab 1 records: line shown, kept `null`, posts 0. Nothing of A's written under B or C.
- T3 (both widths): one person, two tabs on the record screen, token refreshed twice from tab 2, tab 1 records and Sends: line 0, kept owner A, posts 1.
- Gates all pass (below).
- Existing tests: `git diff origin/main...HEAD -- tests`: only the person argument added to calls (`currentOwner()`) and one `leaveTab()` setup line; no assertion changed.
- `session-storage.ts` diff read: `setTokens` still writes `{accessToken, refreshToken}` to the same key; it only adds a notice after the write. `client.ts` is not changed, so refresh handling (50 calls at 401) is as on main by code reading.

## What I ran, with totals
- `npm ci` exit 0. `npx tsc --noEmit` exit 0. `npx next lint` exit 0.
- `npx vitest run` exit 0: 137 files, 1401 tests passed (no `opening.test.tsx` flake this run).
- `npx next build` exit 0.
- My browser attacks: G1/G2 (guest tab + sign-in elsewhere) 4 runs: 2 fail (finding 1), 2 control pass. S1/S2 4 runs: all show the loss (finding 2). T1-T3 6 runs: 6 pass. T4 (typed variant of finding 1) 1 run: fails.

## What I could not prove (run out of time, not tested)
- The 40-run sweep with clock change and refreshes through the real sign-in and sign-up screens, sign-up with the code, a voice reply and typed reply in a thread, network dropping at each step, offline recording across a new context, the buy and payment-done screens as a full page load, three tabs of one person all acting. The builder's own browser proof covered some of these with stubbed token writes.
- Old data: serving main and then this branch on the same storage (a main build was made, not run). The other person getting none, the guest draft claimed on sign-in.
- Storage errors (IndexedDB missing, quota, localStorage throwing, corrupt entries).
- 50 concurrent 401s in a browser.
- Real phones, Safari, private windows.

Until finding 1 (a lone person) and finding 2 (words lost on a shared phone) are fixed, do not merge.
