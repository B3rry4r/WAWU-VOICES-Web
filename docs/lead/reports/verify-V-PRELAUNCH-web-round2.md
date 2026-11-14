VERDICT: FIX

Code under test: `v/prelaunch` 243f7a1 (this branch holds it, plus reports, boards, first check's pictures). Own stub API (virtual clock, cache lag, 500, hang) in front of one `next build` served with `next start`; origin/main 59a44d6 built the same way against the same stub. Nothing live called. All servers stopped. My scripts are in the verifier's scratchpad, uncommitted.

Why FIX: one HIGH (share page does not recover from a 500 at the opening) and one MEDIUM that every visitor who presses Share before opening will meet (disabled share buttons and a false line under the refusal message). Everything else the round promised held up. The HIGH is a small fix; the opening itself works.

## First check's findings

| Finding | State | Evidence |
|---|---|---|
| B1 nothing turns live at the opening | **Closed** | 15 runs x 20 screens: 300/300 live by themselves, slowest 5.35 s; table below |
| H1 Speak / Add your voice land on a false page | **Closed** | `shots-r3/before/speak-390.png`, `q-write/speak/mood/propose/vote/results/posted/next-390.png` and 1440: all "Coming up / Opens Sunday 15 November", no "closed", no form. Opens by itself at the instant (table) |
| H2 calls that say it has started | **Closed** | `welcome-390.png`, `welcome-1440.png`, `go-390.png`: no "Listen as a guest", no "Add your voice" (text and control dumps); "Join VOICES" and "Sign in" stay; Home has no "Listening is free" banner and no Weekly report row without a report (with a report the row shows: run `leak.mjs`) |
| H3 deploy order, API must be live first | **Open (API side)** | Stub that answers like today's production (a voice before opening): Home still draws "Trending answers" with the voice; category draws top voices. Landing page is now clean. Needs the API branch deployed first |
| M1 empty boxes and headings | **Closed on Home, left on purpose elsewhere** | Home: "New conversations" not drawn (diff below). Discover "Money 0 voices", category "Open 0 / Closed 0 / Polls 0" over "No open questions": noted, LOW, as agreed |
| M2 fake player on `/join` | **Closed** | `join-1-390.png`, `join-2-390.png`, `join-1440.png`: coming-up card only, no player, waveform, 0:06, chips or Open poll |
| M3 bell count vs empty list | **Open (API side)** | Not touched by the round; not retested |
| M4 deep links to action screens | **Closed** | Eight action addresses, 390 and 1440, all coming-up; each turns live by itself |
| M5 cache serves "Coming up" after the instant | **Closed** | Cached SCHEDULED for 4, 20 and 90 s: page goes live at the next retry and never gives up (below) |
| L1 no Share on coming-up | **Closed** | Share on Home, landing, `/go`, question page; sheet opens (`sharesheet-*-390.png`). New problem with the refused sheet: M1 below |
| L2 search topic rail | **Open, not proved** | Stub returned a topic in search; page still said "Nothing found for fine" (`search-390.png`). Unchanged from before |
| L3 `/q/<id>/next` crash | **Closed** | Was my stub: with the right shape (`what-next`) it draws coming-up before and the page after opening, no error |
| L4 `/weekly` 404 console errors | **Closed against a stub that answers 200 null** | No console errors on `/weekly` |
| L5 date without year | **Closed** | `longDay("2027-09-27T12:00:00+01:00")` = "Monday 27 September 2027"; a day in 2026 has no year |

## The opening (seconds from the instant to live; 5 runs per lead, 20 screens each; clock control: fake clock per page, aligned to the stub; nobody touches the page)

| Screen | 30 s before | 5 min before | 6 h before | Requests from load to the instant |
|---|---|---|---|---|
| Home guest / signed in | 0.8-5.1 / 0.9-4.8 | 0.8-4.4 / 1.3-5.1 | 0.4-4.2 / 0.3-4.4 | 0 |
| Landing 390 / 1440 | 0.4-2.7 / 1.3-4.9 | 1.0-4.6 / 0.9-2.3 | 1.1-4.9 / 0.7-4.6 | 0 |
| `/join` slide 1 / slide 2 / 1440 | 1.6-4.1 / 0.4-4.8 / 0.3-4.5 | 0.4-3.5 / 0.5-4.8 / 0.7-3.5 | 2.2-4.7 / 0.3-4.8 / 1.6-4.1 | 0 |
| `/join` slide 3 | no difference between coming up and live (decorative slide, no question on it) | | | 0 |
| `/go` | 0.5-4.3 | 0.3-3.6 | 2.0-4.5 | 0 |
| Question page | 0.5-5.1 | 0.2-4.6 | 0.9-3.3 | 0 |
| `/speak` | 0.8-3.4 | 2.5-5.0 | 2.1-5.2 | 0 |
| Share page `/s/c1` | 1.5-4.2 | 3.5-4.5 | 0.5-5.0 | 0 (server drawn) |
| write / speak / mood / propose / vote / results / posted / next | each 0.2-5.4 | each 0.5-5.3 | each 0.3-5.4 | 0 |

Spread: first request after the instant 0.09 to 5.09 s, as the random 0 to 5 s promises; slowest to live 5.35 s (limit 10). Console errors in all 15 runs: 0. The 6 h lead jumped the clock 5 h 54 min, then stepped 6 min. Median per screen 1.1 to 4.5 s.

Hard cases (12 screens each):
- Cached SCHEDULED 4 s: live 5.3-8.9 s. 20 s: 20.4-24.5 s. 90 s: 111-114 s (retries 5, 15, 30, then every 60 s; it did not give up).
- API 500 for 20 s at the instant, or request hangs: all screens stayed "Coming up" (no error flash), live 21-25 s. **Share page: H1.**
- Tab hidden at the instant, forward after 1 min or after 1 h: live 0.2 s after coming forward. Phone asleep 8 h (clock jump, then `visibilitychange` and `focus`): 0.2 s. Nothing was requested while hidden.
- Offline at the instant, online 30 s later: 0.2 s (share page 9.05 s).
- 50 tabs, real clock, `/go`: first request 0.09 s, last 4.96 s, 30 distinct 100 ms slots, busiest slot 5 of 50, none before the instant, 50/50 live. (A first attempt on the fake clock showed clumps of 12; the real clock does not, so that was the fake clock.)
- Device clock 10 min fast: never live early; about one request round per minute for the 10 minutes (no hammering); live 49.4 s after the real instant (the 60 s retry step). Device clock 10 min slow: live 590-600 s after the real instant.
- After the question is open: 0 requests in 10 minutes on all 20 screens, topic scheduled or live (`afterOpen.mjs` written, not run: the matrix runs gave the before-instant half; see Not proved).

## New findings

### BLOCKER
None.

### HIGH
**H1. A waiting share page breaks and does not recover when the API answers 500 at the opening.** Real clock, `/s/c1`, SCHEDULED, then 500 for 20 s from the instant, nobody touching: T-5 s and +3 s "Coming up"; from +8 s "We could not open that link. Something is not reachable right now. Wait a moment and open the link again. Go to VOICES"; still so at +70 s. `ShareOpening` calls `router.refresh()`; a failed server render replaces the page and the watcher goes with it. Every other screen survived the same 500 and recovered (21-25 s). Share links are what people send each other tonight. Should be: keep the coming-up page and retry at the next step.

### MEDIUM
**M1. Share sheet when the API refuses the link (the state the builder says every coming-up question is in).** `shots-r3/before/sharesheet-refused-390.png`: the title says "A card and a link go out." (false), then the message and "Copy this page's address", then six greyed buttons that do nothing (WhatsApp, Facebook, X, Telegram, SMS, "Copy link", all `disabled`) and "Sharing is free." Should be: only the message and the copy button. The copy button copies `window.location`, which on Home is the Home address, not the question.

### LOW
- L-a. Device clock 10 min slow: page waits for its own clock, live ~10 min late (a focus or return to the tab after 30 s fetches again, so it fixes itself when touched). Device 10 min fast: live up to 60 s late. Fix: correct the clock with the API's `Date` header.
- L-b. Home heading "What is Nigeria saying today?" and, signed in, "Hi Ada, what is your take today?" read as if it has started (`home-390.png`, `home-in-390.png`).
- L-c. Desktop sidebar and landing header carry "Weekly report" (goes to a page saying no report yet); mic "Speak" in the bottom bar goes to the coming-up page. Not false, but controls to nothing yet.
- L-d. `/join` slide 2 copy "see where people lean in open polls" while no poll exists.
- L-e. M1 items on Discover and category ("0 voices", "Open 0 / Closed 0 / Polls 0", "Nothing trending yet"): left as they are on purpose, LOW.
- L-f. Share page 9.05 s to live after an offline period (others 0.2 s): inside the limit, slowest case.
- L-g. `focus`/`visibilitychange` ask again every time once past the instant, with no throttle (harmless, only on user action).
- L-h. Console shows a browser "Failed to load resource 404" when the share link is refused (expected).

## Open state against origin/main (same stub; 51 screens, 390 and 1440, light, dpr 2; Home dark; sheets)
Identical in 31 screens (text, controls, pixels). Differences, 20 screens:
1. Home 390, Home signed in 390, Discover 390, Home dark: no "Weekly report" row (no report in stub) and no "New conversations / Nothing new yet" block. **Right**, as the builder said for every state. On Home 1440 the "Nothing new yet" block is gone too: right.
2. Landing, `/go`, `/join`, question page, share page, share sheets: words "10 seconds" on the branch against "a minute or less" / "60" on main. **Not the builder's change**: origin/main moved on after 53e738b (batch 14 Nov: "owner's launch words follow the new limit"); the branch does not hold it. It will come with the merge; check the words after merging.
3. Two 14x14 px and 160x88 px pixel differences with identical text and controls (song icon / sheet animation): noise.
`/q/<id>/next` open state: no difference. No console errors on either.

## Dates in five time zones
Africa/Lagos, Europe/London, America/New_York, Asia/Tokyo (ja-JP locale), Pacific/Kiritimati; clock fixed 22:30 UTC; 9 screens x 2 widths x 5 = 90 loads; every date string ever drawn (mutation observer): "Opens Sunday 15 November" (70), "Starts Monday 16 November" (25); no other date, no flash, 0 console errors or hydration warnings.

## Tests the builder changed
`tests/prelaunch.test.tsx` diff read in full: two assertions removed and replaced. (a) old: SCHEDULED question at/after `startsAt` is not coming-up (device clock); new: SCHEDULED is coming-up whatever the clock. (b) old: topic with `startsOn` passed is not "not started" (device clock); new: SCHEDULED is not started, LIVE is. The three-line `comingUp` signature change follows. Nothing else was loosened: `opening.test.tsx` and `opening-gates.test.tsx` are new, and the previously passing lines are intact. Cost of the rule: a SCHEDULED answer stays "Coming up" for ever if the API never flips it (by design). Vitest on my run: 88 files, 870 tests passed.

## Words
No em-dash or en-dash and no "Rant" on any of the 102 text dumps (before and after); no sideways scroll at 390 (scrollWidth = clientWidth on all).

## Proved by runs
Gates: `npx tsc --noEmit` exit 0; `next lint` no warnings or errors; `vitest run` 88 files / 870 tests passed (60 s); one `next build` exit 0, 50 pages. Everything in the tables above, H1, M1, the 51+51 screens, the five zones, the main comparison, `leak.mjs`.

## Read only
The first check, the builder's report, the diff 9c37bf8..243f7a1, the hook and the gates in source.

## Not proved
- Real API, real nginx/HTTP cache, real devices, a real hard reload.
- Pictures I opened and looked at: Home 390 and 1440 before, landing 390, share page 390, `/join` slide 2, refused share sheet. The rest were checked by text, control and pixel dumps, not by eye.
- "No polling after open": my after-open script was written but the stub was needed for the pictures; the evidence is the matrix (no requests load to instant) and the code (`pending` null stops the watcher). Not run as a 10-minute count after opening.
- `/join` slide 3 cannot show the opening (no difference on it).
- M3 (bell count) and L2 (search rail) not retested beyond what is above.
- Pictures from origin/main are not committed (scratchpad); only the branch's `before/` and `after/` are.
