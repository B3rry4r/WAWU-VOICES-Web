# V-PRELAUNCH web, round 4 (branch v/batch-1114c2)

Proof: one `next build`, served with `next start`, API stubbed (`e2e/round4.e2e.mts`, real clock, `PART=srv|fresh|h1|clock`; the server's own call and the browser's probe fail separately). Nothing live called. Servers stopped.
Check report (`verify/batch-c2`, fetched about every 10 minutes and last at the end): still the first version, one HIGH and one MEDIUM. Both closed below. No LOW listed.

## Findings and what closed them
| Finding | Closed by |
|---|---|
| HIGH: waiting share page replaced by the error page when the server render after the probe fails | The server render is no longer in the path. `src/features/share/ShareGate.tsx` is the one place that decides waiting, live or gone. A question that has not opened is drawn by the server (picture tags included) inside the gate (`src/app/s/[code]/page.tsx`, the `ShareGate` return at the end). At the instant (0 to 5 s spread, then 5, 15, 30, every 60 s) the gate asks the API from the browser (`probeSharePage`) and draws the live page itself from that answer (`SharePageView`, extras via `probeShareExtras` in `src/lib/api/reach.ts`). No `router.refresh()` any more. 500, 502, 503, hang, offline, still-closed: the screen stays. 404 or 400: `ShareGone` (the not-found words). Nothing is asked after the page is open. |
| Fresh open with a server fault (ruling) | `page.tsx`: a server fault (API error, busy, no connection) returns `<ShareGate code>` with no children: "Opening. One moment." (VOICES header, same frame as the other share pages), retried on the same steps, then the page; 404 or 400 from the browser shows not found. |
| Server render that throws | New `src/app/s/[code]/error.tsx` shows the same gate (waiting state that retries itself). |
| MEDIUM: 409 CONFLICT "Start again with a new key" never answered with a new key | `needsNewKey` in `src/features/talk/lib.tsx` (409 CONFLICT with "new key" in the message, or IDEMPOTENCY_KEY_REUSED); `WriteScreen.tsx` `send()` catch drops the key (and the held draft's key, for an answer) so the next tap carries a new one, and `failText` says "That did not post. Tap Post to try again." instead of the generic line. Proved by unit test only (no browser run). |

Removed: `ShareOpening.tsx`, `ShareUnavailable.tsx` (no longer reachable). New: `ShareGate.tsx`, `ShareGone.tsx` (the not-found markup, shared with `not-found.tsx`).

## Tests
Added `tests/round4.test.tsx` (8): gate at the instant with 503 then open (no refresh, no polling after); fresh waiting state asks at 5, 15, 30, 60 then draws the page; waiting state turns into the coming-up page then live; 404 from both entries; error boundary; page draws waiting state for 500, 503 and a lost connection, 404 still not-found; server-drawn coming-up page sits inside the gate; 409 answered with a new key on three taps. Added `tests/support/share-page.ts` (fixture).
Changed (new rule, old to new):
1. `tests/opening-gates.test.tsx` "the server page is drawn again at the opening": was `ShareOpening` expecting `router.refresh` once; now `ShareGate` expecting the live page drawn from the browser's answer, no refresh.
2. `tests/round3.test.tsx` H1 (6 modes): was "no refresh while failing, refresh once open"; now "coming-up stays and no page, then the live page is drawn", and no refresh ever. 404 test: was "handed to the server (refresh)"; now the not-found page shows. Offline then online: was refresh once; now page drawn.
3. `tests/lch-d-busy-share.test.tsx` (2) and `tests/walk-fix-share.test.tsx` (1): a busy, 5xx, 502, 504 or lost-connection server answer was the "We are busy." or "We could not open that link" page; now "Opening. One moment.".
4. `tests/polish-b.test.tsx` T7 (2): `share-unavailable` test id became `share-waiting`.
No assertion was loosened; each follows the ruling.

## Runs (one build, 390x844 and 1440x900, real clock)
Share page loaded before the instant; from the instant the probe is right and the server's call fails. Error page at any 100 ms sample: none in any run. Server calls after the instant: 0 (the 3 counted are the first load before it).
| server fault | live, seconds after the instant (390 / 1440) |
|---|---|
| 500 x1 | 1.56 / 3.19 |
| 500 x2 | 2.39 / 2.35 |
| 500 x5 | 4.51 / 3.81 |
| 500 x20 | 1.58 / 4.83 |
| hang | 1.20 / 3.56 |
| 503 x5 | 5.08 / 1.87 |
Link opened fresh at the instant +2 s, server failing for 20 s: states "Opening. One moment." then live; live at 5.51 / 5.39 s after the instant (500), 6.00 / 3.62 (503), while the server was still failing (the browser draws it). Link gone (404): coming-up then "We could not find that." at 3.59 / 2.48 s; never an error page.
Round 3 H1 (probe failing 20 s, both widths): no error page in 500, 502, 503, hang, offline (live after recovery 1.8, 5.1, 4.6, 11.8, 0.1 s at 390; 4.4, 3.5, 0.8, 13.9, 0.1 s at 1440); 404 shows the not-found page at 5.1 / 3.7 s.
Opening regression (Home, `/go`, question, `/speak`, share; device clock right, 10 minutes slow, 10 fast, 3 h slow; 5 runs per cell at each width = 10 values): every cell between 0.18 and 5.81 s, none early, requests before the instant 0 in every cell (40 cells), console errors 0. Per-cell values in the run output, kept summarised here: share cell ranges 1.03 to 5.45 s.
Pictures `docs/lead/prelaunch/shots-r5/` (about 70). Opened and looked at: waiting state at 390, live share page at 1440 after the 503 fresh run, not-found at 390 after the gone run, live page at 390 after 20 server failures. The rest were checked by text sampling.
Gates: `npm run lint` no warnings or errors; `npm run typecheck` exit 0; vitest 95 files, 951 tests passed; `npm run build` exit 0.

## Choices
- Any server fault on a share page (not only around the instant) draws "Opening. One moment." and retries; the server cannot know the opening time when its own call failed, so there is no window to test. The old "We are busy" and "We could not open that link" pages are gone from `/s`. A page that is down for hours would keep saying "Opening." and retrying every 60 s.
- A fresh waiting page asks first after a 0 to 5 s spread, like every other screen.
- The 409 message is our own plain line, not the server's words.
- Search engines: the server-drawn coming-up page (picture tags) is unchanged; on a failed draw they get the waiting page (metadata noindex as before).

## Not done
- The 409 fix is on the answer and reply writer only; other posters (voice, news) were not checked. The failure line still draws below the first phone screen (layout untouched).
- The check's LOW items: none listed.
