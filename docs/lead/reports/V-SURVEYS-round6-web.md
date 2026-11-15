# V-SURVEYS round 6 (website)

Fixes for H1, H2, L1 and L2 from the independent check of round 5.

Head commit: see `git log -1` on `v/surveys` (the last commit of this round; the file cannot name its own hash).

## Join with main
- `origin/main` (79c7a9c) merged with `--no-ff` (5ddab3f). Five conflicts, both sides kept: `HomeScreen.tsx` (survey card and audio advert), `vx.css`, `AdsPage.tsx` (brand page picker and the picture and audio pickers), `roles.ts` (surveys, brands, users, ideas, people).
- Contract: I took the server repo's `docs/contract/openapi.yaml` from branch `v/surveys` whole. I compared it as parsed YAML first: it has every one of main's 179 paths, all their operations and every schema (194 paths in all). Then `npm run api:types`.
- `DMS_LIVE` stays `false`. `src/features/speak/` differs from main only in `VoiceBox.tsx`, `SpeakScreen.tsx` and `outbox.ts`, in the lines named below.

## H2: compare and set (`src/lib/api/client.ts`)
- `doRefresh` (about line 138): remembers `current`, the refresh token it started from. `moved()` says whether storage still holds it.
- Success: the new tokens are written only if storage still holds `current`. Otherwise the answer is dropped and the result is `true` (use what is in storage now) or `false` (storage is empty).
- Refused: if another tab rotated meanwhile, `true`. If storage moved on, nothing is cleared. Only if storage still holds `current` is the shared session cleared (the clearing is inside `doRefresh`, so nothing else clears it).
- No `expect` is passed to the refresh any more, so a plain call that joins a refresh started by a survey call no longer gets `WrongPersonError`.
- A call with `expectSubject` that lands on someone else's sign-in fails with `WrongPersonError` at the retry (the check in `raw`). A plain call retries once with whatever sign-in is in storage and never carries the old token.
- Two tabs of the same person: the second finds `current !== before` and picks up the winner's tokens from storage.
- Tests: `tests/refresh-compare-and-set.test.ts` (8): A refreshing while B signs in (`expectSubject` and plain), same person two tabs, refused while B is signed in, refused alone (signed out), plain GET 401, post with a run-out token (one refresh, one post, same Idempotency-Key), A signs out mid-refresh.

## H1: nothing of a recording goes out as another person
Every call path that now carries `expectSubject`:
- `createVoiceClip`, `completeVoiceClip`, `getVoiceClip`, `deleteVoiceClip` (`src/lib/api/speak.ts`), and the posts `createVoiceAnswer`, `createVoiceReply` (`talk.ts`), `explainMyVoteByVoice` (`vote.ts`) take an optional `expectSubject`.
- `VoiceBox.tsx` (survey voice answers, voice replies, explain my vote): the box keeps the subject it was opened with. All four clip calls pass it. `mayWrite()` (the caller's `canWrite` and the subject check) runs before the create, right before `putWithRetry`, before complete, before the ready check and before the post, so it also runs after any refresh. The clip's ready subject is handed to the post (`ReadyClip.subject`), so the reply and the vote post carry it too.
- `SpeakScreen.tsx` (record screen): the same subject kept when the screen opens; create, complete, ready check, delete and the answer post carry it, and the subject is checked right before the bytes go up. On a mismatch nothing more is sent and a line says so. The recording stays on the screen and in the draft that was already saved for A.
- `outbox.ts` (a recording kept offline and sent later): the subject at the start of the send goes to create, complete, ready check and delete, and is checked before the bytes and before the post. The post calls there keep their old arguments, because two existing tests fix them exactly; the subject check right before them is what guards them.
- On a mismatch: nothing more goes out, the recording stays, and the person sees the existing stale line (survey) or "You are signed in as someone else in another tab. Nothing was sent. Reload to carry on." (other boxes).
- Tests: `tests/voice-clip-subject.test.tsx` (6), for the voice box and for the record screen: the checker's two cases (B signs in during the create-clip 401 wait; A's token runs out at complete and B signs in then), B already signed in at Send, and A alone.

## L1, L2
- L1: `src/features/admin/survey-floor.ts` `underFloor`: rows under the floor are not drawn, their counts fold into "Other" if the server sent one, and "Other" shows only if it reaches the floor. Used by the page (`SurveyResultsPage.tsx`) and the CSV export (`survey-csv.ts`). Test: `tests/surveys-round6-floor.test.tsx` (3).
- L2: the two selects got `min-h-11` and "Add a choice" lost `size="s"` (`SurveysPage.tsx`). The classes give 44 and 48 px by the tokens; I did not measure them in the browser at 1440.

## Totals
- `npx tsc --noEmit`: 0 errors. `npx next lint`: clean. `npx next build`: ok.
- `npx vitest run`: 143 files, 1508 tests, all pass. One test in `tests/opening.test.tsx` ("asks again after 5, 15, 30") failed once in one full run and once when run on its own by name; it passes as a whole file and in two other full runs. I did not find the cause. No test that exists on main was changed.

## Browser proof (`e2e/surveys-round6.e2e.mts`, built app, API and sign-in host stubbed, 390x844, fake microphone, two tabs in one browser)
Subjects are the token's `sub:n`. Times are ms.

H1 case 1 (B signs in during the create-clip 401 wait; the stale line shows; B's tokens intact after):
```
+  729 userA:old POST /surveys/s1/events kind=START
+ 3605 userA:old POST /voice-clips
+ 3620 POST /auth/refresh {rA-old}
```
No `/voice-clips` call, upload or complete as B. No refresh with B's token.

H1 case 2 (A's token runs out at complete, B signs in then):
```
+ 3115 userA:old POST /voice-clips
+ 3128 PUT /__put
+ 3136 userA:old POST /voice-clips/c1/complete
+ 3144 POST /auth/refresh {rA-old}
```
Nothing as B afterwards; B's tokens intact.

H2 (profile GET 401 in A's tab, B signs in mid-refresh): one `POST /auth/refresh {rA-old}`; storage after is B's tokens, not A's.

Home record flow, open mood question (question, "Pick one word", ANGRY TIRED PROUD HOPEFUL, "Say it in 60 seconds", "Type it instead" all there): pick HOPEFUL, record, Send: one clip, one `POST /questions/q1/answers kind=VOICE mood=HOPEFUL`. With a run-out token at the post:
```
+ 3736 userA:old POST /questions/q1/answers key=ac481744 kind=VOICE mood=HOPEFUL
+ 3741 POST /auth/refresh {rA-old}
+ 3848 userA:new POST /questions/q1/answers key=ac481744 kind=VOICE mood=HOPEFUL
```
One refresh, one post, same Idempotency-Key.

Survey with a voice question, one person: clip, bytes, complete, ready, `POST /surveys/s1/responses`, "Thanks. Your answers are in."

## Could not prove
- A voice reply in the real browser: it is covered by the voice box tests (same component), not by a browser run this time.
- L2 heights at 1440 in a browser.
- What the real server does with a clip route under another person, or with refresh tokens used from two tabs.
- A recording kept for later (outbox) is not tied to who made it beyond the owner stamp the draft already had; the send now only goes out as the person signed in when it began.
