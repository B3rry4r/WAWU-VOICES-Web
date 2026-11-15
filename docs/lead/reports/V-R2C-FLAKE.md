# V-R2C-FLAKE: why R2c lost B's recording, and the fix

Branch `v/r2c-flake`, merged with `origin/main` 61bcfd8 (merge commit, no rebase).

## Verdict
PRODUCT race (plus the script timing that lets it show). Fixed in `src/features/speak/draft.ts` (loadDraft removal loop). `e2e/draft-owner.e2e.mts` is back to exactly main's version.

## How it was reproduced
Traced copy of R2c (same steps as the script, with an init script logging every `drafts` put/delete with its stack, `storage` events, navigations/loads and the token in storage at each; options for CPU throttle via CDP and an IndexedDB open delay).
- Quiet, 12 runs: 0 failures. Plain script on a quiet machine, 3 runs: 0.
- 4x CPU throttle + 40 ms IndexedDB open delay, 1440 wide: 2 failures in about 120 runs (run 15 and run 22 of two batches), both "B's recording missing".
- I did not reach 200+ runs per condition. Not run: 4 busy loops, 390 wide before the fix, several copies at once without throttle. (Time.)

## What removed B's recording (one failing run, times in ms from one clock)
1. A's tab loads `/` with A's token. Its Outbox start-up pass `look()` calls `loadDraft("A")`, which reads `me = A` (draft.ts, `const me = currentOwner()`).
2. The pass is slow (throttle + slow IndexedDB); the script waits only 1.5 s, then opens tab 2.
3. t+0: tab 2 writes B's token; A's tab hears the `storage` event (token = B).
4. t+85: script puts `rec:B` (B's recording) in tab 2.
5. t+1150: A's tab, still on `/` (no navigation), runs `delete rec:B`. Stack = `idbDel` called from the loop in `loadDraft`. The old loop (draft.ts, "for (const k of await idbKeys()) ... await idbDel(k)") used the `me` read before the awaits. So a pass begun for A deleted B's key after B had signed in.
Only that loop can delete another person's key (`clearDraft` and `afterSignOut` touch the caller's own key; the 7 day sweep needs a stale recording).

## Can a real person hit it?
Only if B signs in and keeps a recording while one start-up pass of A's page is still running. On a normal device a pass takes a few ms, so this is very unlikely, but the code was wrong to use a stale `me`, and slow or blocked storage widens the window. The stated rule (a signed-in person's page load removes other people's recordings) is unchanged and was not the cause: here B's recording was created AFTER A's load began.

## Change (draft.ts, loadDraft, 2 lines)
The loop now breaks as soon as `currentOwner() !== me`, before each delete. Nothing else in the file changed (saveDraft, claimGuest, clearDraft, afterSignOut, sweeps, the rule itself).
Test `tests/draft-owner-stale-pass.test.tsx` (2 tests): (1) A's pass held on a slow store; B signs in and keeps a recording meanwhile; after the pass B's stored recording is the same object. FAILS on origin/main (`expected undefined to be {questionId:'q1', ... key:'b-key', owner:'B'}`: rec:B was removed), passes with the fix. (2) A signed in throughout: another person's old recording is still removed, a guest's is handed to A.
Same stale read elsewhere: `claimGuest` checks `currentOwner() === me` once at its start and then moves the guest's recording to `me`; it can in theory still run after a sign-in change. `sweepOldRecordings` is by age only. Not changed (no test shows a loss).
Small remaining window: the check happens right before `idbDel` opens the database; a sign-in in that gap is not stopped. 150 stressed runs did not hit it.

## Numbers after the fix
- R2c traced copy, same stress (4x throttle, 40 ms IndexedDB open delay): 150 runs (75 at 390 + 75 at 1440): 0 failures. An earlier, overloaded batch (12 browsers on 4 cores, 100 runs at 1440 before I stopped it) had 1 run fail by timeout waiting for "Start recording" (no delete of rec:B in its trace); I stopped that batch. The requested 300 runs were NOT completed.
- Whole `draft-owner.e2e.mts`, unchanged, quiet machine, 5 runs: 4 of 5 were 38 of 38. Run 1 had 1 FAIL: `5e [1440]` ("two tabs of the SAME person": clips 2, expected 1). In a separate set of runs one run had `4 [390]` fail and one `4 [1440]` (see below).
- `surveys-r9`: ALL PASSED 6. `paid-post-box`: ALL OK.
- Gates on the merged tree: `tsc --noEmit` 0, `next lint` 0 warnings, `next build` ok, `vitest run` 153 files / 1562 tests, exit 0 three times.

## Other flakes seen (not fixed, not caused by this change as far as I can tell)
1. Test 4 (`A's banner is open; B keeps a recording; A taps X`), seen failing at both widths on a busy machine. Trace: rec:B is never deleted. In passing runs tab 2's own start-up pass runs after B signed in and removes rec:A (the stated rule) before the script reads; in failing runs that pass ran earlier as A, rec:A stays, and the script's `read()` (first recording by key) returns A's instead of B's. So the script relies on when tab 2's page finishes starting. Needs a script fix (e.g. wait for rec:A to be gone, or read rec:B by key); I did not change it as the ruling was to keep the file as on main.
2. `5e [1440]` clips 2 (same person, two tabs loaded together, both uploaded a clip, one post). Seen once in 5 full runs. Not related to other people's recordings; not investigated.

## Could not prove
- That the guard alone gives 0 in 300 stressed runs (150 done, 0 failed).
- That main's own R2c fails at the same rate under the same stress with the same harness at 390.
- Which exact call site started the failing pass (names are minified); it is the only code that can delete another person's key.
- The record screen flows for one person were checked only through the full e2e file as run (4 of 5 clean runs, the failing ones listed above).
