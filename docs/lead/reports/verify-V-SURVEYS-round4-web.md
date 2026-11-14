VERDICT: FIX
INTERIM

# Verify V-SURVEYS round 4 (website): interim, one HIGH found

Code under test: `origin/v/surveys` 1487f90. It is 17 commits behind `origin/main` and does not merge clean (4 conflicts, see later). I tested a local merge of `origin/main` (conflicts resolved by keeping both sides, never pushed). One `next build`, `next start`, Chromium, every API and sign-in call stubbed, nothing live.

## HIGH

**H1. One person's answers can still go out under another person's token (token expiry race).**
- Where: `src/lib/api/client.ts:167` (token read when the request goes out), `:151-152` (refresh reads whatever refresh token is in storage now), `:190` (`if (ok) return raw(path, opts, true)` sends the SAME body again, reading the token from storage again). Survey side: `SurveyScreen.tsx:207` (`check()` runs once, before the call, not again before the retry). The builder's report names it ("A 401 refresh mid-write reads the token again from storage; not guarded").
- Steps (390x844, one browser, two tabs, API stubbed so the server accepts any valid refresh token):
  1. Tab 1: sign in as A, open the survey, answer Q1 and Q2, pick a choice on Q3. A's access token has run out (a tab left open for a while).
  2. Tab 1: tap Send answer. The server answers 401 after 1.5 s (a slow phone connection).
  3. Tab 2, during that wait: sign in as B (writes B's tokens to the shared local storage).
- What happened (request log): `userA POST /surveys/s1/responses idem=06c9ba {answers q1=h2,q2=o2,q3=f1}`, then `POST /auth/refresh {refreshToken: B's}` (tab 1 used B's refresh token), then `userB POST /surveys/s1/responses idem=06c9ba` with A's exact answers and A's Idempotency-Key. A's answers were saved as B's answer. Tab 1 then showed the stale-tab notice, but the request had already gone.
- Should happen: a survey send never carries a token that is not the person's it was made for. The fix belongs in the send path: pass the person's own token and refuse the retry when the stored subject changed (or have the survey write compare the subject again before the retry and drop it).
- Narrow in likelihood (two tabs, two people on one device, B signs in inside the 401 window), but it is exactly "A's answers sent as B", so HIGH under the rule.
- The refresh also clears B's session if the server refuses it (`client.ts:191`, `sessionStorage.clear()`), so A's old tab can sign B out.

(Full report follows in the next push.)
