VERDICT: FIX
INTERIM

# V-FIX-D web, second check (interim)

Head checked: `origin/v/fix-d` = efb32fe (as stated). Branch `verify/fix-d-2`. origin/main is 38ec048, a squash of fde1253; `git diff fde1253 origin/main` is empty, so the join equals main plus the V-FIX-D work.

Nothing is confirmed HIGH yet. The verdict is FIX for now because the run is not finished (W1, W4 (voice/offline), W5, W6, W7, W8 not yet run). Do not treat this as final.

## Ran so far
| Line | How | Result |
|---|---|---|
| `npx tsc --noEmit` | RAN | exit 0 |
| `npx next lint` | RAN | no warnings or errors |
| `npx vitest run` | RAN | 106 files, 1169 tests, all passed |
| `next build` of this head and of origin/main (worktree) | RAN | both exit 0 |
| W2 text composer 1440, write screen 390 | RAN (Chromium, stubbed API) | switch off by default, says what it does, `anonymous:true` sent when on and absent when off; written reply shows "Anonymous" and the writer sees "Posted without your name" |
| W3 composer 1440, write screen 390 (own nameless answer) | RAN | no switch, the line shows, request carries `anonymous:true` |

## Suspected, being confirmed
- Reply write screen (`WriteScreen.tsx`): the Idempotency-Key is compared on text and the name switch only, not on the stance (`key.current.text !== body || key.current.anon !== anonNow`). Changing I agree to I disagree and tapping Post again would reuse the key (W4: a changed body gets a new key). To be run.
- Offline sending (W5): `Outbox.tsx` / `outbox.ts` handle recorded voice answers only. Whether an offline text answer, text reply or voice reply is kept and sent later is being run.
