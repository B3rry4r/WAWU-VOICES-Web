# V-PRELAUNCH web, round 3 (branch v/batch-1114c2)

Proof: one `next build`, served with `next start`, API stubbed (`e2e/round3.e2e.mts`, real clock, `PART=h1|sheet|clock`). Nothing live called. Servers stopped.

## Findings and what closed them
| Finding | Closed by |
|---|---|
| H1 waiting share page replaced by the error page | `src/features/share/ShareOpening.tsx`: at the instant it asks the API from the browser first (`probeSharePage`, `src/lib/api/reach.ts`), the same call the server render makes, and calls `router.refresh()` only when the answer says the question is open, or 404/400 (link really gone). 500, 502, 503, hang (10 s abort), offline and "still SCHEDULED" leave the page as it is and the watch retries on 5, 15, 30, then every 60 s. |
| H1 side: ask in flight used up a retry step | `useLoad.ts` `ask()` returns false when one is in flight; a step is counted only when an ask is made. |
| M1 refused share sheet | `ShareSheet.tsx` `QuestionAddress` and the early return: for a QUESTION with `notOpen` and a failed link, only the message and one button copying `${origin}/q/<id>`. No "A card and a link go out.", no six buttons, no "Sharing is free." The sheet header "Share this question" stays (a sheet needs a title). Working case on the coming-up card unchanged (201 gives link and card). |
| L-a device clock | New `src/lib/api/server-clock.ts` (offset from the `Date` header, plus `Age` when a cache held it; newest kept; unreadable header changes nothing). Fed in `client.ts` `raw()` (browser, same-origin API calls only). `useStartWatch` compares the opening instant with `serverNow()`; waits between asks use the device clock. The share page, which has no API answer before the instant, is corrected from the server's own `now` that it was drawn with (`noteServerTime`). Header has whole seconds and arrives late, so the corrected time is never ahead of the server: never early. |
| L-g | `useLoad.ts`: `visibilitychange` and `focus` ask at most once per 5 s (`BACK_MIN_MS`); `online` and `pageshow` are not throttled (offline to online must be quick). |
| Words | `grep -rn "10 seconds" src`: remaining hits are comments, the proof script, and `EditProfilePage.tsx:53` "Your bio is your voice, up to 10 seconds". Left: `voiceCardUpload.ts` `VOICE_CARD_SECONDS = 10` is the recorder's real limit in this repo (the contract gives no bio limit, only a per-clip `maxDurationMs`). Question hints with "10 seconds" are API data. Free posts 2 / 1 minute: `SpeakScreen.tsx` already defaults 2 and 60. `src/features/speak/proof/phone.mjs:57` updated to main's hint words. Not done: scenarios B, G and the ExtraVoice dialog lines in that same script assert a dialog main removed; they cannot pass and need a rewrite (not run, no stub for it here). |

Left as they are: L-b, L-c, L-d, L-e, L-f, L-h.

## Tests
Added `tests/round3.test.tsx` (16): H1 (500, 502, 503, hang, offline, still-SCHEDULED: no refresh while failing, refresh once open; 404 handed to server; offline then online at once), Date header and Age, `apiFetch` keeps newest header, watch asks within 0 to 5 s and never early with the device right, 10 min slow, 10 min fast, 3 h slow; L-g throttle; refused sheet words, buttons and clipboard.
Changed in `tests/opening-gates.test.tsx` (new rule, assertions not loosened):
1. "the server page is drawn again at the opening": old `render(<ShareOpening opensAt/>)` expected `refresh` once; new passes `code` and `serverNow`, stubs the API to answer open, expects 0 asks and no refresh before the instant, one refresh after.
2. Refused sheet: old button "Copy this page" wrote `window.location.href`; new button "Copy the question’s address" writes `${origin}/q/q9`.

## Runs (one build, 390x844 and 1440x900)
Share page, H1 (seconds from recovery to live; error page at any sample: none except 404):
| | 390 | 1440 |
|---|---|---|
| 500 for 20 s | 1.3 | 2.3 |
| 502 for 20 s | 1.3 | 4.5 |
| 503 busy for 20 s | 4.4 | 3.1 |
| hang 14 s | 13.6 (live 27.6 s after the instant) | 0.9 |
| offline at the instant, online 30 s later | 0.1 | 0.1 |
| link gone (404) | server's own page "We could not find that." at 4.5 s | 1.5 s |
"Coming up" stayed on screen all samples (100 ms) in every failing case. For a gone link the page shown is the existing not-found page; "We could not open that link" is shown by the server only when the first load itself fails, and was never shown here.

Refused sheet from Home, landing (`/welcome`), `/go`, question page, both widths (8 runs): text is only the message and "Copy the question’s address"; buttons: Close and that one; no title line, no free line, 0 disabled; clipboard `http://127.0.0.1:3981/q/q9` every time. Working sheet (coming-up card, 201): card text, link, five targets, Copy link, "Sharing is free.".

Opening, seconds from the real instant to live, 5 runs per cell, both widths (10 values per cell), requests before the instant 0 in every cell:
| screen | device clock right | 10 min slow | 10 min fast | 3 h slow |
|---|---|---|---|---|
| Home | 1.06-5.21 | 1.88-5.61 | 0.93-5.71 | 1.18-5.25 |
| `/go` | 0.65-5.66 | 1.10-5.51 | 0.85-5.61 | 0.71-4.65 |
| question | 2.10-5.83 | 1.04-5.37 | 1.44-5.13 | 0.69-5.63 |
| `/speak` | 1.26-5.86 | 0.79-5.19 | 0.85-5.48 | 1.22-5.69 |
| share | 0.95-6.02 | 1.07-5.32 | 1.07-5.75 | 0.82-4.04 |
Same range for every clock. Values above 5 are the random 0-5 s plus about 1 s of polling and render with 20 pages open at once. None early. Console errors: 0.

Pictures: `docs/lead/prelaunch/shots-r4/` (48: sheets refused and ok, share page after each fault, live pages for right and 3 h slow clocks). I looked at: refused sheet Home 390, working sheet question 1440, share page after 500 at 390, Home live 1440 with a 3 h slow clock. The rest were checked by text dumps.

Gates: `npm run lint` no warnings or errors; `npm run typecheck` exit 0; vitest 94 files, 943 tests passed; `npm run build` exit 0.

## Choices
- Date header read only for same-origin browser calls (the server render and WAWU ID calls pass `baseUrl` and are skipped). If the API is on another origin and does not expose `Date`, behaviour is today's.
- Sheet keeps its title "Share this question" in the refused state.
- Non-question refused sheets keep the old error line.
- A refresh that succeeds in the probe but fails in the server render can still show the error page (a window of one request); not closed.
- Hang case lives up to the 10 s client timeout, so recovery shows at the next step.
