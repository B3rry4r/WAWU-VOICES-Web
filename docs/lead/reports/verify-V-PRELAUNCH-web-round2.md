VERDICT: FIX (first version, written early; the rest follows in the next commit)

Code under test: `v/prelaunch` 243f7a1 (this branch holds it plus reports and boards). Own stub API and own clock control; one `next build` served with `next start`; nothing live called.

## HIGH found so far

**H1 (new). A share page that is waiting for the opening breaks, and does not recover, if the API answers 500 at the instant.**
- Did: `/s/c1` (share page of the launch question, server drawn) open on the real clock; stub says SCHEDULED, then answers 500 from the instant for 20 s, then recovers. Sampled the page at T-5 s, +3, +8, +18, +24, +30, +45, +70 s, nobody touching it.
- Saw: T-5 and +3 s "Coming up / Opens ..."; from +8 s "We could not open that link. Something is not reachable right now. Wait a moment and open the link again. Go to VOICES". Still that at +70 s, 50 s after the API recovered. The page the visitor was sitting on is replaced by an error page and nothing retries (`ShareOpening` calls `router.refresh()`; when the server render fails the whole page is replaced and `ShareOpening` goes with it).
- Every other screen I ran the same way (Home, landing, `/join`, `/go`, question, `/speak`, `/q/q9/propose`, `/q/q9/mood`) kept "Coming up" through the 500 and turned live at the next retry (21 to 25 s). With a request that hangs 14 s instead of 500, the share page also recovered (24.8 s). So it is the 500 path of the share page only.
- Should be: on a failed refresh keep the coming-up page and try again at the next retry step.

## Opening (own clock control, 5 runs per lead, 20 screens, nobody touching the page)
300 of 300 loads turned live by themselves. Slowest 5.35 s. First request after the instant at 0.09 to 5.09 s (the random delay, as designed). Requests from load to 3 s before the instant: 0 on every screen in all 15 runs (30 s, 5 min and 6 h leads; the 6 h lead jumps the clock 5 h 54 min and then steps 6 min). Console errors: 0.
Hard cases (12 screens each): cached SCHEDULED for 4 s: live at 5.3 to 8.9 s; for 20 s: 20.4 to 24.5 s; for 90 s: 111 to 114 s (next retry after the answer changed, nothing gave up). API 500 or hang for 20 s: 21 to 25 s (share page: see H1). Tab in the background at the instant, forward after 1 min or 1 h: live 0.2 s after it comes forward; phone asleep 8 h: 0.2 s; offline at the instant, back online: 0.2 s (share page 9.05 s). 50 tabs on the real clock: first request 0.09 s, last 4.96 s, 30 distinct 100 ms slots, busiest slot 5 of 50, none before the instant, 50 of 50 live. Device clock 10 min fast: never live early, about 1 request round per minute (not hammering), live 49.4 s after the real instant (the 60 s retry step). Device clock 10 min slow: live 590 to 600 s after the real instant (the page waits for its own clock).
