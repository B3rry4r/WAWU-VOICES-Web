VERDICT: FIX

# Verify V-SURVEYS web, third check (first version, more runs follow)

Code under test: `origin/v/surveys` 174a63c merged cleanly into `verify/v-surveys` (merge 007134e). One `next build` (API and WAWU ID pointed at a real local HTTP stub), served with `next start`.

## Verdict-changing finding so far

### HIGH N6. Another person's answers can be sent under a person who signed in later (stale tab)
- Where: `src/features/surveys/SurveyScreen.tsx` (`Ask`: `given` lives in React state; `submit` posts with whatever token is in storage at that moment, `src/lib/api/client.ts` reads `voices-web-session` from `localStorage`, which all tabs share).
- Run (1440x900, one browser context, two tabs): tab 1: person A signs in, answers Q1 (choice) and Q2 (recorded voice) of a three question survey, picks Q3, does not press Send. Tab 2: Settings, Sign out, sign in as person B. Tab 1: press "Send answer". The stub saw `userB POST /surveys/s3/responses {"answers":[{"questionId":"q1","optionId":"h1"},{"questionId":"v2","clipId":"c240"},{"questionId":"q2","optionId":"o2"}]}` (A's choice and A's clip id, under B's token) and tab 1 showed "Thanks. Your answers are in." with A's three answers. Picture `docs/lead/surveys/shots-r3-check/N2-stale-tab-after-B-signs-in-1440.png` (opened and looked at).
- Should happen: the page remembers who the answers belong to (the token subject at the time of the first answer) and, at send time and when the draft is saved, refuses and clears if the signed-in person is not that person.

More findings and the full list follow in the next version of this file.
