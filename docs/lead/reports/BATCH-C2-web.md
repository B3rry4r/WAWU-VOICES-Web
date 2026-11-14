# BATCH-C2 (web): lead record, 14 Nov 2026

Branch `v/batch-1114c2`. Base: origin/main 59a44d6.

## What was joined
- `v/prelaunch` (243f7a1), one conflict in `src/features/entry/Go.tsx` (both sides kept: the pre-launch conditional block, the hint without the old limit).
- `v/hotfix-1` (9398021), clean: no "also block" on a report of a post made without a name.
- CI workflow: tests run on a ready pull request only.
- The server's contract copied from the server batch (twice: after the pre-launch join and after the live-fault fix round 4); types regenerated; typecheck clean each time.

## Rounds built on this branch
- Round 3 (4abba15): the share page waits through API failures; the refused share sheet; the server clock from the `Date` header; a 5 second throttle on returning to the tab. Report: `V-PRELAUNCH-web-round3.md`.
- Round 4 (04baa60): the share page is drawn through `ShareGate` (no server render in the path while waiting; "Opening. One moment."); a new key after a refused post on the text answer and the reply. Report: `V-PRELAUNCH-web-round4.md`.
- Round 5 (639be42): a new key after a refused post on every writer, the voice post included; the opening is asked from the earlier of the device clock and the server-corrected clock; a stepped device clock is noticed. Report: `V-PRELAUNCH-web-round5.md`.

## Checks
- Lead, on the first join (before rounds 3 to 5): typecheck 0, lint 0, vitest 93 files and 927 tests passed, build 0.
- First release check, on 4abba15: `verify/batch-c2`, `docs/lead/reports/verify-BATCH-C2-web.md`.
- Second release check, on 639be42: `verify/batch-c2`, `docs/lead/reports/verify-BATCH-C2-web-2.md`.

## Deploy order
After the server batch (backend pull request 19).
