# V-R2C-FLAKE (interim note, not final)

Found: R2c failed in 2 of ~120 stressed runs (1440 wide, 4x CPU throttle, 40 ms IndexedDB open delay). Trace of one failure:
A's tab (on `/`, no navigation) deleted `rec:B` about 1.1 s after B's `put rec:B`, with B's token already in storage.
That delete is the "remove other people's recordings" loop in `loadDraft` (`src/features/speak/draft.ts`), run by A's start-up pass
(Outbox `look()`), which was still going when the script signed B in. Looks like a SCRIPT problem (fixed 1.5 s wait, not "A's start-up finished").
Working on: script waits until each tab's start-up IndexedDB pass is over before B signs in. Numbers and the final report follow.
