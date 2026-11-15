VERDICT: FIX
INTERIM

# verify-V-DRAFT-OWNER (interim)

Branch checked: `v/draft-owner` at 7ec4ea4. Built with `next build`, served with `next start`, Chromium with a fake microphone, API and sign-in host stubbed in the browser (no live service called). One browser context, several tabs.

## Findings

### 1. HIGH: one person alone, a guest tab, then signing in in a second tab: the record screen says "signed in as someone else" and nothing is kept or sent
Steps (390x844 and 1440x900, both fail, every time):
1. One person, one browser. Tab 1 opens the record screen as a guest (not signed in).
2. In tab 2 the same person signs in with the real sign-in screen (Email, Password, "Sign in").
3. Back in tab 1, record a take (Start recording, Stop recording).
Result: the line "You are signed in as someone else in another tab. Nothing was saved. Reload to carry on." shows; the kept recording is empty; Send sends nothing (0 clips, 0 posts). The same person is alone on the browser, so this is a HIGH by the rule. Opening a fresh page afterwards works.
On main this works: `saveDraft` stamps whoever is signed in and the guest take is claimed.
Cause: `src/features/speak/draft.ts` around lines 74-85. The first `storage` event from another tab "pins" the tab. When the tab was a guest, the event's old value has no session, so `person` stays `null` and `pinned` stays true. After that `signedInAsSomeoneElse(null)` is true (A is signed in, the tab is nobody), so `saveDraft`, `loadDraft` and `clearDraft` all refuse (lines 143 and 169). Nothing in this tab can ever un-pin it except a sign-in done in this tab.
Likely real-life route: the sign-up code or a link opens in a new tab, or a person signs in in a second tab, while the first tab stays on the record screen.
Fix direction (for the builder, not done here): a guest tab that sees a session appear in another tab should not treat the signed-in person as "someone else". It should become that person (the guest claim), or at least save as guest and let the claim rule hand it over.

## Still to check when this is full
Same tab next person, typed-words loss for B, two people two tabs for every operation, `session-storage.ts` diff on main vs branch, old data from main, storage errors.

## What I ran so far
- `npm ci` exit 0. `npx tsc --noEmit` exit 0. `npx next lint` exit 0.
- `npx vitest run` exit 0: 137 files, 1401 tests passed.
- `npx next build` exit 0.
- My own attack test: guest tab plus sign-in in tab 2 (2 widths): 2 fail (finding 1). Control (guest tab opens the record screen after the sign-in elsewhere): 2 pass.
