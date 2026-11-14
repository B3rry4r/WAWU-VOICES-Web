VERDICT: FIX
INTERIM

# Verify V-SURVEYS round 5 (website): interim, one HIGH found

Code under test: `origin/v/surveys` a259ee4. Chromium (Playwright), `next start`, every API call and the sign-in host stubbed, no live service. More checks are still running; the full report replaces this file.

## HIGH

**H1. A voice answer in a survey: A's recording is created and uploaded under B's sign-in, and A's tab spends B's refresh token.**
- Why: `expectSubject` is passed only for the survey answer, START and SKIP. The voice calls (`createVoiceClip`, `completeVoiceClip`, `getVoiceClip`, `deleteVoiceClip` in `src/lib/api/speak.ts:30-37`) are plain `authed` calls. They run from `src/features/speak/VoiceBox.tsx:195-262` (`send`, started by itself when the recording stops, line 277). `canWrite()` is checked once before the create (`:198`), and again before complete and before the post, but never after a 401 refresh, and not before the bytes go up (`putWithRetry`, `:229`). A plain call that gets a 401 refreshes with whatever refresh token is in shared storage (`client.ts:222-225`) and retries with the new token.
- Steps (390x844, one browser, two tabs, fake microphone, stub accepts any valid refresh token, survey with Q1 choice and Q2 voice):
  1. Tab 1: sign in as A, whose access token has run out. Open the survey, answer Q1, Q2 is the voice question.
  2. Tab 1: Start recording, wait 2.3 s, Stop recording. The clip is made and uploaded by itself.
  3. The create-clip call gets a 401 after 1.5 s (slow network). At 0.4 s after Stop, in tab 2: sign in as B.
- Request log (ms after Stop; Authorization subject, call):
  - `+52 userA:old POST /voice-clips {purpose SURVEY_ANSWER, audio/webm, sizeBytes 6670, durationMs 2345}`
  - `+1564 POST /auth/refresh {refreshToken: B's}` (tab 1 used B's refresh token)
  - `+1569 userB:2 POST /voice-clips` (same body: A's recording made as a clip of B)
  - `+1575 PUT /put/c-userB-2` (6670 bytes, A's audio, uploaded into B's clip)
  - Storage after: B's tokens rotated to `B2/rB-2` by A's tab. Tab 1 shows the stale notice only afterwards. No survey answer went out.
- Same cause, second case (V3): A's token runs out between upload and complete, B signs in during the 401 wait: `refresh {B's token}` then `userB:2 POST /voice-clips/<A's clip>/complete`. A's tab calls complete on A's clip as B.
- Should: nothing of A's recording (create, bytes, complete, delete) goes out with a token that is not A's, and A's tab never refreshes with B's refresh token. Pass `expectSubject` on the four voice-clip calls, and check `canWrite()` before the byte upload (or send the bytes only for a clip created in this check).
- What held in the same runs: if B is already in, or signs in while the bytes go up with A's valid token, nothing of A goes to B (V2); a held voice answer then Send under B sends nothing (V4). The real server may refuse clip routes by owner; I could not test that, and the bytes and metadata are sent anyway.

## Held so far (survey choice answers, `expectSubject`)
Cases (a) to (i) with slow and fast networks, all with no request carrying A's answers under a token that is not A's, B's sign-in never overwritten or cleared, B's refresh token never used: B signs in before Send; during the first request; between the 401 and the refresh (lock held by another tab); during the refresh call (slow and fast); around the refresh answer (offsets -60 to +20 ms); refresh refused while B signed in; B signs in then out; guest tab; three tabs. A alone: one refresh, one retry as A with the same Idempotency-Key, also when the network drops the retry.
