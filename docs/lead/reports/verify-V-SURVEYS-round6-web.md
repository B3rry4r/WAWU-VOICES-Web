VERDICT: FIX

# Verify V-SURVEYS round 6 (website)

Code under test: `origin/v/surveys` ba16240, branch `verify/surveys-6`. Built with `next build`, run with `next start`, Chromium (Playwright, fake microphone), 390x844 and 1440x900. The API and the sign-in host were answered by my own stub inside the browser. No live service, no `.env`. I changed no product code and no existing test. My scripts and my attack tests are not committed (they sit in my scratch folder). Only this report is pushed.

## Round 5 findings, from my own runs

| Round 5 | Now | Basis |
|---|---|---|
| H1 voice clip goes up under person B | **CLOSED** for the record screen, the survey voice answer and the voice box clip calls. **OPEN in a new place**: the offline outbox post (new H1 below). | Record screen: B signs in when each of create, upload, complete, ready, post arrives, A's token valid or run out: 9 cases, nothing as B, B's tokens untouched. Survey voice: 7 cases (create, upload, complete, ready) clean. Outbox: create, complete, ready clean (3 cases); the post is not (below). |
| H2 refresh overwrites another tab's sign-in | **CLOSED** | 35-case attack matrix (below) and the browser runs above. |
| L1 small rows drawn on results | **Half closed.** State and age rows: closed. Choice rows and the choice "Other": still drawn (M1 below). | Own vitest attack. |
| L2 control heights at 1440 | **Not measured by me.** | See "Could not prove". |

## Findings, most severe first

### HIGH

**H1. The offline outbox posts A's saved voice as B.** `src/features/speak/outbox.ts:90` (`createVoiceReply`) and `:93` (`createVoiceAnswer`) are plain calls with no `expectSubject`. The builder said they kept those two calls as they were. The check at `:87` runs before the post, but a 401 on the post is refreshed and retried with whatever sign-in is in storage.
- Steps (390x844, one browser, two tabs): tab 1 signed in as A, free posts left. Record, drop the network, tap Send: the recording is kept as waiting. Network back, open Home in tab 1: the outbox sends it by itself. Clip create, upload, complete and the ready check go out as A. A's token runs out at the post. During the 401 wait, tab 2 signs in as B.
- Log:
  - `userA:1 POST /questions/q1/answers key=b37598 ->401`
  - `POST /auth/refresh {ruserB-1}` (A's tab spends B's refresh token)
  - `userB:2 POST /questions/q1/answers key=b37598` (A's voice clip posted as B)
  - Storage afterwards: B's pair rotated by A's tab.
- Same on the merged build (key bf8778, `userB:2`). When the token runs out at create, complete or the ready check instead, nothing goes out as B.
- The voice-reply variant (`:90`) is the same code shape; I read it, I did not run it.
- Should: pass the subject to both post calls in `sendHere`, as `SpeakScreen.tsx:455` and `VoiceBox` do (the post functions already take it). Then a refresh retry fails as "wrong person" and the recording stays.

### MEDIUM

**M1. The results page and the CSV draw a choice row or an "Other" under the floor when the server sends one.** `SurveyResultsPage.tsx:258-276` draws `count · share` for every option the server did not mark `hidden`, and draws `q.other` with no floor check; `survey-csv.ts` the same. My test (floor 20): option "Maybe" 3 answers `hidden:false` is drawn as "Maybe 3 · 3%" and written to the CSV as `Choice,Do you?,Maybe,3,3`; "Other" with 5 answers is drawn as "Other 5 · 5%" and exported. The round 6 fix (`survey-floor.ts underFloor`) covers state and age rows only. The contract says the server hides small rows, so this only shows if the server is wrong; but the brief says a small group shown is the worst class. Treat it as HIGH if you hold that rule whatever the cause. Should: a choice with 0 answers is drawn as 0 (owner ruling, held); a choice with 1 to floor-1 and an "Other" under the floor are not drawn, in the page and in the CSV.

**M2. Opening a page as B deletes A's kept recording.** `draft.ts:118` `loadDraft`: another person's kept recording is removed (`clearDraft`) as soon as any page in the same browser asks for the draft as B. A recording kept offline by A is gone before A can send it. This is old, documented behaviour ("another person's is never shown and is removed"), not new in this round, and I read it without running it. It counts under "loses a recording" only when two people share one browser. Should: leave A's recording until A is back, or say so.

### LOW

- **L1. A reload in the middle of a send makes a second clip.** Record screen, voice: Send, reload while complete is pending, Send again: 2 clips, 1 post (same key). The first clip is an orphan. Same for a lost create-clip reply (clip made, answer lost, retry makes another): 2 clips, 1 post.
- **L2. A stale tab spends another person's refresh token.** Three tabs (A, A, B), B signs in during the refresh: the second A tab's 401 refreshes with B's refresh token (B1 to B2). B's pair stays whole and valid, and no A token goes out, but A's tab rotates B's session. By design now (a plain call retries as whoever is signed in).
- **L3. After a stale-person stop, the posted page of A's answer can create a share link as B** (`POST /share/links` under B's token) if A's tab lands on the posted page after B signed in. Share link only; no post.

## What held

1. **Record screen, one person, one tab** (hard rule). Question, "Pick one word", ANGRY, TIRED, PROUD, HOPEFUL, "Say it in 60 seconds", "Type it instead", "Share my word" all present at 390 and 1440. Voice: 10 plain runs at each width, each exactly 1 clip, 1 post, 0 refresh. Typed: 10 plain runs at each width, each 1 post.
   - Token runs out at create, complete, ready, post (voice) and the typed post: one refresh, one post, same Idempotency-Key, ends on the posted screen, every time.
   - Network dropped, reply lost or 500 at create, upload, complete, ready, post: ends posted after one more tap, 1 post each, same key on the retried post (the reply lost at the post: 2 post requests, same key, server keeps 1).
   - Offline then back, two tabs of A both open: 1 clip, 1 post, 1 post request.
   - No sideways scroll, no "signed in as someone else" line in any one-person run.
2. **Compare and set** (own vitest matrix, not committed, 35 cases, 34 pass): for a plain call and for an `expectSubject` call, A expired, B = other person / same person / signed out signs in at 4 points (before the request, during the request, during A's refresh, after the refresh answer arrives and before it is read). In every case storage ends as one valid pair of the person who acted last; nothing signed out who should not be; no request carries A's token after B signed in; no WrongPerson for a plain call. A refused refresh clears nothing when B is signed in or another tab already rotated; A alone refused is signed out. 50 calls in one tab, all 401: 1 refresh, all 50 succeed. Three tabs, same person, all 401 at once: nobody signed out. The one failing case was my own stub refusing a valid token of B (my test, not the product).
3. **A person alone never sees the stale line**: 10 refreshes in a row (profile load with an expired token each time), then the clock moved forward 2 hours, then Send on the record screen with the token run out once more: no stale line, one clip, posted. Survey voice alone: no stale line, 1 clip, 1 survey answer.
4. **DMs off**: `DMS_LIVE = false` (`src/features/dm/live.ts:7`); `/messages` is 404 at both widths; no Messages link on any page that rendered.
5. **Results page** (own vitest, with the builder's helpers): "Yes 60, No 40, Not sure 0" is drawn as 60, 40 and 0, and the CSV has `Not sure,0,0`; ADMIN and AD_MANAGER on a running survey see totals only (no choice, state or question text); below the floor (9 of 20) only Seen, Started, Skipped; a state row under the floor is not drawn.
6. **Client change is additive**: plain calls behave as before in every case I ran (see 2).
7. **Totals on the branch**: `npm ci` ok; `npx tsc --noEmit` 0 errors; `npx next lint` no warnings or errors; `npx vitest run` 143 files, 1508 tests pass; `npx next build` ok.

## Join with main

- Main is 1db90d5. It is **not** inside `v/surveys` (ba16240).
- Local merge (not pushed): **no conflicts**, git merged it by itself (51 files from main: HomeScreen, SearchScreen, conversation, home, vx.css, IdeasPage, OverridePage, Go, Landing, Onboarding, MoodPickScreen, NewsCard, NewsPostPage, profile.css, SharePageView, OwnPost, WhatNextPage, three new tests, e2e/relw6, docs). Nothing to resolve by hand. The round 6 merge of 79c7a9c already took the five earlier conflicts.
- On the merged tree: `tsc` 0 errors; `next lint` clean; `vitest` 146 files, 1518 tests pass; `next build` ok. Section 1 re-run on the merged build: voice 20 of 20 and typed 6 of 6 checks pass (same matrix). The outbox H1 reproduces on it.
- `contract/openapi.yaml`: **take the branch's file.** Compared as parsed YAML against main: all 179 paths, every operation and every schema of main are in the branch; the branch adds 15 paths (surveys, brands) and 37 schemas, and 5 schemas and one operation description change additively (VoiceClipPurpose, Settings, AdminAd, UpdateSettingsRequest, UpsertAdRequest, `/me/settings`). Main's 1db90d5 did not touch the contract. Main's file would lack the survey and brand routes, so the generated `types.ts` and the survey screens would not compile. The text diff against main is about 10,000 lines because the file was re-written by the server tool, so a later merge of any contract change on main will conflict as text; resolve it by parsing, not by hand. The server's surveys branch is not released: the web build calls routes that return 404 until it is.

## The opening test

`tests/opening.test.tsx` run alone 20 times: on the branch 1 failure in 20; on main (1db90d5) also 1 failure in 20 (same test, "asks again after 5, 15, 30 then every 60 seconds"). It is not the branch's fault. It also passed in both full runs of the whole suite I did. It is a flaky test already on main.

## What I ran (totals)
- Branch: tsc, lint, vitest (1508), build.
- Merged tree: tsc, lint, vitest (1518), build, section 1 re-run (26 checks), outbox attack (4 cases).
- Browser attacks: record screen voice plain 20, typed plain 20, step faults 22 voice and 4 typed, upload faults 2, B signs in at each step 9, survey voice B 7, alone cases 3, offline outbox cases 4 on branch and 4 on merge, offline two tabs 1, reload mid-send 1. About 90 checks; failures: the outbox post (branch and merge).
- Own vitest: 35 compare-and-set cases, 5 results-page cases.

## Could not prove
- **Voice reply and "explain my vote by voice" in a browser.** My stub for the thread page crashed on a field I did not know, so I did not run them. They use the same `VoiceBox` code as the survey voice answer (which passed), and pass `clip.subject` to the post in `VoiceReply.tsx` and `ResultsPage.tsx` (read, not run). The outbox voice reply post is the H1 shape.
- **Section 4 in a browser**: sign-in, sign-up, verify code, sign-out, Home, a question page, vote, like, text reply, edit and delete from Profile, share buttons, admin sign-in and the admin Users page. My simple stub made Home, the join page and the question page crash (empty data), so those runs say nothing about the product. They pass in the repo's own tests (all pass), which I did not re-read.
- **Section 5 in a browser**: the survey card on Home, each question kind, skip, "already answered", caps, admin create and approve pages, brand page. I ran choice and voice questions on the survey screen and the results page by vitest only.
- L2 of round 5 (control heights at 1440): not measured.
- 3 tabs and the "after the answer, before the write" point in a real browser: unit level only (the write has no await after the compare).
- What the real server does with a clip under another person, with reused refresh tokens, or with a replayed key.
- A real phone.
