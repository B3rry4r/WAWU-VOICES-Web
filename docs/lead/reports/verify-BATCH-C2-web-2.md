VERDICT: FIX

Code under test: `verify/batch-c2` after `git merge origin/v/batch-1114c2` (clean, no conflict; head 639be42, merged as 176feea). One `next build` (57 of 57 pages, exit 0) served with `next start`; origin/main 59a44d6 built the same way in a separate worktree (57 pages, exit 0), same stub. Chromium through Playwright at 390x844 and 1440x900. API stub made from `contract/openapi.yaml` shapes: the browser's calls are answered by routes, the server's own calls by a node server, each with its own switches (500, 502, 503, hang, offline, 404, wrong or missing `Date`, `Age`) and a clock I control (`ctx.clock`). Nothing live was called. All servers stopped, the main worktree removed. My scripts are not in the commit. Pictures: `docs/lead/batch-c2/shots-2/` (33, added with `git add -f` because `shots` is in `.gitignore`).

Why FIX: the HIGH from the first check is closed and so are the three MEDIUMs on the main writers, and nothing main brought is broken. One rule you set is not met: "a refused post can always be sent again and never posts twice". The vote explanation in words and the proposal send their retry under a NEW key after a 500, a 429 or a plain 409, so a post that the API stored before a 502/504/500 can be posted a second time (MEDIUM-N1). A second MEDIUM (MEDIUM-N2) is the held draft after a purchase. Neither is a BLOCKER or HIGH by my reading; the verdict is FIX because of your "never posts twice" clause.

## First check's findings

| Finding | State | Run |
|---|---|---|
| HIGH-1 share page ends on the error page | **Closed** | See "1" below. 15 scenarios x 2 widths. Error page in any 100 ms sample: 0 in all runs (about 5,000 samples per width). |
| MEDIUM-1 409 "new key" | **Closed for the text answer, voice answer, text reply, voice reply (390 and 1440), vote explanation in words and by voice; open for the held draft after a purchase** (MEDIUM-N2) | See "2". |
| MEDIUM-2 device clock steps back | **Closed** | See "3". |
| MEDIUM-3 wrong or missing `Date` | **Closed whenever one clock is right** | See "4". |

## New findings

### BLOCKER
None.

### HIGH
None.

### MEDIUM

**MEDIUM-N1. The vote explanation in words and the proposal drop their Idempotency-Key on any HTTP answer, a 500 included.** `src/features/vote/ResultsPage.tsx:192` (`if (e instanceof ApiError && e.status > 0) key.current = null;`) and `src/features/vote/ProposePage.tsx:99` (same line). Run, signed in, 390: the server answered 500 once, then 201. Text answer: keys `4a8b2e26`, `4a8b2e26` (same). Voice answer `a9c8d65d`, `a9c8d65d`. Text reply `bdbf356a`, `bdbf356a`. Held draft `held-key`, `held-key`. Explanation in words: `98b3510b` then `2779f98e` (new). Proposal: `f470fa9f` then `7a9fff08` (new). A 429 (`d9be` then `ef21`) and a plain 409 "another request is still running" (`0de2` then `4774`) do the same for the explanation; the 402 gave a new key on each of three taps. The explanation creates a public answer (contract: "Creates an answer under the poll's question"), a proposal a public proposal; a gateway 502/504 after the API stored the post, then Post again, makes two. Pictures: `m1-500-propose-390.png`, `m1-500-explain-words-390.png` (both after the second tap, the post done). What should happen: drop the key only on a 4xx that refuses the post (and on the "new key" answer); keep it on 5xx, 429, a plain 409 and no answer, as `WriteScreen.tsx`/`ReplyComposer.tsx` do. The builder's table says "per tap, already dropped on any answer" for both; it was not changed in round 5. I read, and did not run, `PollCard.tsx:96` and `FlashPoll.tsx:76-81` (a vote is one per account on the server, so a repeat is refused, not doubled; a paid vote after the free ones is the case to check).

**MEDIUM-N2. A held draft refused with "Start again with a new key" after a purchase shows the server's raw words and keeps the spent key, so the person's first Post tap fails again.** `src/features/units/post-draft.ts:36-40` (`kept` with the server's message; the draft's key is not renewed), `PaymentDoneScreen.tsx:287-288`. Run (`/units/done?paymentId=<uuid>` with a held draft awaiting units, the post answered 409 new-key, 409 new-key, then 201): the return page says "Your draft is still saved / Start again with a new key" (`pay-held-draft-done-390.png`, the words mean nothing to a person); on the write screen the words are back, tap 1 sends `held-key-1` again (409), tap 2 sends a new key (201). One post at the end, so it recovers; it needs two taps and the first one cannot work. The builder listed this as not changed. What should happen: call `renewDraftKey` in `postDraftForPurchase` on `needsNewKey` and say the plain line.

### LOW
- LOW-N1. After a browser-side fault of 120 s the share page is live 51.7 s (390) and 52.8 s (1440) after the fault ended: the probe retries every 60 s (steps 5, 15, 30, 60). 20 s faults: 0.3 to 7.6 s after the end. Never an error page.
- LOW-N2. The server-fault HTML of a share page ("Opening. One moment.") still carries `<title>Link not available | VOICES</title>` (noindex, generic card), a mismatch with the body. Same title as main on its fault page. A server that stays down for hours keeps saying "Opening." (disclosed by the builder).
- LOW-N3. A plain 409 on the text answer and text reply is shown as the generic "Something went wrong on our side. Try again in a moment." (key kept, retry gave one post). Acceptable; the voice paths show the server's words.
- LOW-N4. `vitest.config.ts` now fakes `performance` and runs a setup file for every test (not only the clock tests); a test of other code now runs on a faked monotonic clock.
- Earlier LOW-1 (cached SCHEDULED answers retry on 60 s steps) not re-run.

## Proved by runs

### 1. HIGH-1, the share page (`/s/<code>`)
Loaded 18 s before the instant, sampled every 100 ms. Seconds from the instant to live (390 / 1440); "server fails" means the server's own call; the page was already drawn, so the server is out of the path (server calls after the instant: 0 in every such run):

| case | 390 | 1440 |
|---|---|---|
| server fails 1x / 2x / 5x / 20 s | 0.1 / 1.8 / 1.4 / 3.6 (re-run srv5 4.3) | 0.6 / 3.9 / 1.8 / 3.2 (srv5 re-run 4.7) |
| server hangs 20 s | 2.0 | 4.8 |
| browser call 500 for 20 s | 23.0 (3.0 after the fault ended) | 20.3 (0.3) |
| browser 502 for 20 s | 24.0 (4.0) | 24.1 (4.1) |
| browser hangs 20 s (14 s per call) | 27.6 (7.6) | 25.8 (5.8) |
| both fail (503) 20 s | 21.7 (1.7) | 20.7 (0.7) |
| offline 20 s then online | 22.9 (2.9) | 21.6 (1.6) |
| browser 500 for 120 s | 171.7 (51.7, LOW-N1) | 172.8 (52.8) |
| fresh open at +2 s, server 500 for 20 s | "Opening. One moment." 2.2 s, page at 4.0 (re-run) / 5.6 | 3.5 |
| fresh open at +2 s, server 503 for 20 s | "Opening." then page 3.1 | 2.7 |
| link gone at the instant | "We could not find that." 0.6 (re-run) / 1.3 | 4.2 |
| link gone before the instant | 404 status, not-found page at once | same |

States seen at any sample: "coming" (before and while waiting), "opening" (fresh fault), then "live" or "gone"; "ERROR": 0. Console errors 0. Pictures: `share-opening-one-moment-390.png` (the fresh-open wait, header and two lines, no scroll), `h1-gone_at_instant-390-end.png`, `h1-srv5-390-end.png` and `h1-srv5-1440-end.png` (the page after 5 failures, live), `h1-fresh_2s_srv_fail_20-390-end.png` (the page drawn while the server was still failing).
**What a crawler gets** (HTML, no scripts, Twitterbot UA): before and after the instant: 200, `<title>How do you feel about Nigeria right now? | VOICES</title>`, `og:title`, `og:image`, `twitter:image`, `twitter:card summary_large_image`, `<h1>` the question, no error words (identical to main). Server fault: 200, "Opening." h1, noindex, title "Link not available" (LOW-N2; main says "We could not open that link" in the body there).
**JavaScript off**: before the instant "COMING UP / How do you feel about Nigeria right now? / Opens Saturday 14 November" (`nojs-before-390.png`), no change after the instant (nothing runs), a reload shows the live page (`nojs-after-reload-390.png`); on a server fault "Opening. One moment.".
**Live page drawn in the browser vs main's server draw (open question, 390 and 1440)**: text equal, controls equal (links and buttons by name and href), one `link_open` event each; the play button asked for the play URL, "Add your voice" went to `/speak?from=<code>`. Pictures `share-live-branch-390.png`, `share-live-main-390.png`, 1440 pair.

### 2. MEDIUM-1, a refused post (signed in, free posts 2)
Server answers 409 `CONFLICT` "Start again with a new key" three times, then 201. Every writer: 4 requests, 4 different keys, one post at the end, words or recording kept, line "That did not post. Tap Post/Send to try again." in view (bounding box inside 390x844, no scroll by the person: the page scrolls it into view), never the generic line:
text answer (line at y=694, `m1-nk-text-answer-390.png`; 1440 y=592); voice answer (y=128, `m1-nk-voice-answer-390.png`); text reply (y=647); voice reply 390 (y=436, `m1-nk-voice-reply-390.png`) and 1440 (y=540, `m1-nk-voice-reply-1440.png`: the gap the builder left is closed); reply box on the thread at 1440; vote explanation in words and by voice (y=386/398, 390 and 1440); held draft after joining (key `held-key` then 3 new). Held draft after a purchase: MEDIUM-N2.
Other answers (390): plain 409: text answer key kept, 1 post; 429: key kept (text, voice, reply, draft), line "You are going fast. Wait a moment and try again."; 500: key kept (text, voice, reply, draft), line the generic one; 402: text answer and reply go to the buy page, voice answer shows "You need more tokens to post this.", same key. Explanation and proposal: MEDIUM-N1.

### 3. MEDIUM-2, the device clock steps while the page is open
7 pages x 2 runs per case, lead 60 s, step at 22 s, 390 / 1440, seconds to live after the real instant: back 10 min 0.7-5.0 / 0.5-5.3; back 3 h 2.2-5.3 / 0.4-5.6; forward 10 min 1.3-5.3 / 0.6-5.5; forward 3 h 1.5-5.1 / 0.7-5.5. 56 of 56 live, none early. Requests before the instant: 0 for the back steps; 1 ask per page for the forward steps (3 calls on Home, landing, `/join`). Return to the tab (hidden, step, shown 12 s after the instant; 390): back 10 min, back 3 h, forward 3 h, forward 8 h (a phone asleep 8 h): 0 API calls while hidden on all 7 pages, all still "coming" when shown, live 0.04 to 0.55 s later.

### 4. MEDIUM-3, `Date` header and device clock (7 pages x 2 runs, lead 150 s; 390 / 1440 min-max seconds to live; asks before the instant)
| case | 390 | 1440 | calls before the instant |
|---|---|---|---|
| header right, device 10 min slow | 0.8-5.6 | 0.8-4.8 | 0 |
| header right, device 10 min fast | 1.0-5.3 | 0.6-4.7 | 52 over 2.4 min: one ask a minute (3 calls on Home, landing, `/join`) |
| device right, header 10 min slow | 0.6-5.5 | 0.6-4.5 | 0 |
| device right, header 10 min fast | 0.7-4.8 | 0.1-4.8 | 52, same |
| header missing, device right | 1.1-4.9 | 1.3-5.0 | 0 |
| header missing, device 10 min slow | 12 of 14 not live in 60 s (share 4.3-5.9) | same | 0 |
| both wrong the same way, slow | 12 of 14 not live (share 2.2-4.7) | same | 0 |
| both wrong the same way, fast | 20.9-33.1 (not early) | 20.6-33.7 | 80 |
| `Age: 90`, device right / 10 min slow | 0.2-4.9 / 0.4-6.0 | 0.2-4.6 / 0.6-5.2 | 0 |
Never early in any cell. With at least one clock right every page is live within 6.0 s. The two slow rows have no right clock (late by design, the builder's own ruling); the share page is live there because the server draws it with its own time.

### 5. Regression, both clocks right (12 pages: Home, landing, `/join`, `/go`, question, `/speak`, write, mood, propose, vote, results, share)
Lead 30 s, 5 runs x 12 pages: 390 0.67-4.90 s, 1440 0.09-4.85 s; lead 5 min, 5 runs x 12 pages (390): 0.22-5.07 s; 0 early; requests before the instant 0 after the load had settled (a first attempt counted the loads themselves with 60 pages starting at once and showed 1-2 calls on a few pages; with a 60 s settle: 0 on all 60). No polling after opening: 10 minutes on 11 pages: 0 browser calls and 0 server calls on every one. 50 tabs of `/go`: 0 requests between settle and the instant, first request 0.08 s after it, last 4.94 s, 31 distinct 100 ms slots, busiest slot 5, 50 of 50 live. Hidden tab through the instant, shown later: live 0.04-0.55 s, 0 requests while hidden (item 3).

### 6. Main's features (branch vs main, same stub, 39 text dumps each: all equal)
`/verify` in 7 states (READY: "Your plan: Verified, 3 months, until 1 Feb 2027 ... Send for checking", `verify-READY-branch-390.png`); `/units/buy` (Price ₦100, VAT (7.5%) ₦7.50, Payment charge ₦1.40, Total ₦108.90, `units-buy-branch-390.png`); record screen `/q/q9/speak`, `/speak`, `/q/q9/write` with 2, 1 and 0 free posts left ("2 free posts left", "Last free post", "Free posts used ... Up to 30 seconds is 78 tokens ..."), and a verified person; Settings switch "Topic of the week" sends `{"notifyWeeklyTopic":false}` then `true`; admin gates by role on `/admin/money`, `/prices`, `/payments`, `/verification`: no role "We could not find that / Go to Home"; MODERATOR and AD_MANAGER "We could not find that / Go back to Today." inside their frame; EDITOR and ADMIN as on main. Whole screens: 48 routes x 4 people (guest, 2 free, 0 free, ADMIN) x 2 widths = 384 dumps on each build: 334 equal; the 50 that differ are all Home or a screen that shows Home, in the topic card ("Starts Monday 16 November" on the branch, "Week 1 · 10 questions · Poll open" and the empty Weekly report and "Nothing new yet" blocks on main), the first check's finding with the branch right. No "10 seconds" or "10 posts" about free posts anywhere (0 hits in 384 dumps).

### 7. Words and layout
No em-dash or en-dash, no "Rant", in 384 dumps and in the added lines of `git diff 4abba15 HEAD -- src content` (the one dash in `src` is the sanitiser in `features/entry/ui.tsx:79`). No sideways scroll at 390 on any of 192 loads. New files (`ShareGate.tsx`, `ShareGone.tsx`, `InView.tsx`, `keys.ts`): no `style=`, only token classes (`bg-bg`, `text-ink-2`, `font-display text-display-l`, `scroll-my-4`; `max-w-[480px]` copied from the old not-found page). The failure line is the existing danger Banner. The three `style=` hits in `src` are old (progress and bar widths).

### 8. Gates
`npm run lint`: "No ESLint warnings or errors". `npm run typecheck`: exit 0. `npx vitest run`: 96 files, 966 tests, all passed (61 s). `npm run build`: exit 0, 57 of 57 pages.
Assertions changed since 4abba15 (`git diff 4abba15 HEAD -- tests`, read in full; 13 `expect` lines removed, no `skip`/`todo` added): `lch-d-busy-share` and `walk-fix-share` (busy, 5xx, 502, 504, lost connection: "We are busy." / "We could not open that link" became "Opening. One moment."), `polish-b` (`share-unavailable` became `share-waiting`), `opening-gates` and `round3` (`ShareOpening` plus `router.refresh` became `ShareGate` drawing the page, no refresh; the 404 case shows the not-found page), `round3` fast-clock test (no ask before the instant became at most 1 ask in 19 s for a fast clock, 0 for right and slow). Each is the new rule and nothing else; the last one is a deliberate loosening the round 5 ruling asks for.

## Read only
Both builders' reports; `git diff 4abba15 HEAD -- src tests`; `useLoad.ts` (`useStartWatch`), `server-clock.ts`, `ShareGate.tsx`, `s/[code]/page.tsx`, `error.tsx`, `middleware.ts`, `keys.ts`, `WriteScreen.tsx`, `draft.ts`, `post-draft.ts`, `PaymentDoneScreen.tsx`, `ResultsPage.tsx`, `ProposePage.tsx`, `PollCard.tsx`, `FlashPoll.tsx`, `SpeakScreen.tsx`/`VoiceBox.tsx` (key handling), `ShareActions.tsx`, `SharePageView.tsx`; contract schemas for the stub.

## Not proved
- The real API, a real reverse proxy or CDN (`Date`/`Age` simulated), real phones, a real clock step or sleep (the clock was stepped with Playwright's `clock.setSystemTime`; the 8 h sleep is that plus a hidden tab).
- Fixtures are my own from the contract shapes; the voice recorder is Chromium's fake microphone. The admin Money overview page crashes on my stub's empty answer on both builds (needs the full MoneyOverview shape), so an ADMIN's Money content was not compared; the gates and the other three admin pages were.
- Paid vote and Flash poll vote after a 500 (read only); the voice explanation after a 500; "Fix my text" after a 502/504.
- Lead 6 h and 8 h waits; clocks in other time zones (first check did them); 1440 for the 5 min lead, the held-draft flows and the purchase return.
- Pictures I opened: `m1-nk-text-answer-390`, `m1-nk-voice-answer-390`, `m1-nk-voice-reply-390`, `m1-nk-voice-reply-1440`, `m1-500-explain-words-390`, `pay-held-draft-done-390`, `share-live-branch-390`, `nojs-before-390`, `h1-gone_at_instant-390-end`, `share-opening-one-moment-390`; the rest were checked by text, bounding-box and request-count dumps.
