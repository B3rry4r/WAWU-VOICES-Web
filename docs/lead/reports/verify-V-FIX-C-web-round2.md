VERDICT: MERGE

# Verify V-FIX-C, the screens (web), second check

Code under test: `v/fix-c` a2b0af1 (carried on `verify/v-fix-c`, which adds only reports and pictures). Verifier: independent, unattended. Stub API only (the browser answers every `/api/v1` call), no live service, no .env opened. My scripts are not committed. Pictures: `docs/lead/fix-c/shots-r2/` (1440x900 at deviceScaleFactor 2; public pages also 390x844). I opened the pictures cited here.

## Merge and gates
- `git merge origin/main` into a detached worktree: **"Already up to date"**. origin/main (53e738b) is already an ancestor of a2b0af1 (the builder merged it in 9459bb8). **0 conflicts**, nothing to resolve.
- `npx tsc --noEmit`: **0 errors**.
- `next lint`: **No ESLint warnings or errors**.
- `vitest run` (whole suite): **86 files passed, 845 tests passed, 0 failed**.
- `next build`: **compiled successfully, exit 0**; `/admin/ideas`, `/admin/people`, `/admin/weekly`, `/q/[id]/next`, `/weekly` are in the route table. Everything below ran against `next start` of that build.

## The first check's findings
| Finding | Status | Proof |
|---|---|---|
| HIGH-1 poll votes shown as voices | **Closed** | Data draft: both count boxes empty, views empty, labels end "count them from the voices", poll line in votes (`summary-04-draft-from-data-ai-off.png`). Public What Next: every "N voices" on the page is one of the three counted fields (5,100, 2,100, 12,480); 9,680 appears only as "votes"; nothing like "9,680 voices" (`whatnext-public-1440.png`, run output). |
| HIGH-2 next-steps count twice | **Closed on the web** | Page prints "214 proposals in 38 groups. Most supported so far: ..." once, with the API's new line shape (`whatnext-public-1440.png`). Caveat: a saved `nextStepsLine` that itself starts with a count still prints it twice (I fed one: 2 copies). The builder says the API no longer writes a count; not provable here. |
| MEDIUM-1 no AI label for readers | **Closed** | `aiDrafted: true` gives "AI-assisted, reviewed by an editor"; false gives "Reviewed by an editor" and no "AI-assisted" anywhere (`whatnext-public-390.png`, `whatnext-public-plain-390.png`). The flag stays true after a person rewrites an AI draft: that is "assisted", true. A save after "Draft from the data" sent `aiDrafted: false`. |
| MEDIUM-2 no ungroup | **Closed** | "Split this group" with an on-page confirm (see step 4 below). |
| MEDIUM-3 "AI is off" on a load failure | **Closed** | Load failure shows "The summary did not load." and Try again, never "AI drafting is off"; Write the summary stays disabled until Try again succeeds (`summary-02-load-error.png`, `summary-02b-load-error-then-write.png`). |
| LOW-1 "@" sent through | **Closed** | `@ada.okafor`, `ada.okafor`, `  @ada ` sent q = `ada.okafor`, `ada.okafor`, `ada`. |
| LOW-2 reason kept, silent disabled Save | **Closed** | After a save the "Why" box is empty and the next save sent only the new reason. Disabled Save shows "Change a role to save." or "Give a reason of at least 3 characters." (`people-06-no-reason.png`, `people-08-saved.png`). |
| LOW-3 sidebar clipped at 1280x720 | **Open, unchanged** | 11 of 11 items visible, but the page is 733px high in a 720px window and the avatar circle at the bottom is cut (`nav-admin-1280x720.png`). Name and role text are visible. `roles.ts` is byte-identical to the first check's head. |
| LOW-4 `/weekly` crash without `emotions` | **Closed for emotions and regions** | Missing key, null, and empty array all render with no error (list below). A missing `quotes` key still crashes: see LOW-A. |

## New findings
BLOCKER: none.
HIGH: none.
MEDIUM: none.

LOW-A (pre-existing, not this branch). Public `/weekly` shows "Application error" if the report has no `quotes` key (`report.quotes.length`, `src/features/reach/WeeklyPage.tsx`, line unchanged by this round). The contract marks `quotes` required, so only a malformed answer triggers it. The same kind of crash the builder fixed for `emotions`.

LOW-B. The summary panel's 500 on save shows whatever the API's error text says; with an unexplained 500 (HTML body) it says "That did not go through. Try again." (checked on people). Fine; noted because my stub's "x" text showed raw, which is a stub artifact.

## Step by step
**Summary panel (clicking, calendar page, stub API).** All of these passed:
- Draft from the data (AI off and on): views empty, counts empty; AI-on line "proposes the two views ... count the voices yourself"; AI-off line "AI drafting is off here. The draft from the data still works." with Draft with AI disabled (`summary-03/04/05`).
- Draft with AI (stub): views filled, note shown, counts still empty (`summary-06`).
- Approve is off with both counts empty (with the reason line "count the voices behind each view and enter at least 1 for both"), with one empty, with 0, and with 0 and 0 (a forced click sends no request). Save as a draft stays on and sent `approve:false`, counts 0, `aiDrafted:true` (`summary-07`).
- Sum above "based on": 9,000 + 5,000 against 12,480 gets the stub's 422 in plain words ("The two counts together are more than the 12,480 voices this summary is based on."), the form stays open with every typed word and count (`summary-10b-sum-422.png`).
- Approve with 5,100 and 2,100, double click: exactly **1** PUT; body `approve:true`, counts, `aiDrafted:true` (`summary-09-approved.png`).
- Edit after approval: counts come back prefilled, Approve is on, resends with the new text; pill "Shown on What Next" and "AI-assisted" (`summary-12`). Refused 403 and 500 keep typed text and re-enable the button (`summary-11-*`). Draft error shows its alert (`summary-10-draft-error`).
- Public What Next for that week (390 and 1440): two chips "5,100 voices" and "2,100 voices", poll line "44% of 9,680 votes", foot "Based on 12,480 voices and 9,680 votes", label as above, next-steps count once, no em-dash. No summary: no summary block.

**Split a group.** Confirm text is on the page, 0 browser dialogs, 0 calls before confirming. Keep it: 0 DELETE, group still listed. Confirm with a double click: exactly **1** DELETE; the list is refetched and the group is gone; message "Group split ... Its 3 proposals went back to not grouped." 403 and 500: words shown, confirm stays open, button re-enabled, 1 DELETE each; Keep it clears the error (`ideas-09-refused-403/500`, `ideas-10-split-ask`, `ideas-11-split-done`).

**People and roles.** Covered in the table (LOW-1, LOW-2). Also: Save is disabled for no change, for a change with no reason and for a 2-character reason; a refused save (403, 500) keeps the typed reason and the ticks; a double click on Save sent **1** PUT.

**Public `/weekly`**, 390 and 1440, no error, no horizontal scroll, no "NaN", "undefined", "null" or em-dash, mood rows and by-state block exactly as expected: both fields; emotions only; states only; neither; both empty arrays; both null; "Other" as a mood (row drawn); every change null (4 rows, 0 change figures); a 91-character state with 1,234,567 votes and a long leading choice. Dark theme at 390 (`weekly-public-dark-390.png`). Admin weekly: a null change shows an empty box labelled "empty if unknown" and is sent as `null`; `regions` is not sent (`weekly-admin-edit-1440.png`).

**Shared component `components/vx/polls.tsx`.** `WeeklyReportCard` is used by two screens: public `/weekly` (`src/features/reach/WeeklyPage.tsx`) and admin weekly (`src/features/admin/WeeklyPage.tsx`); also by tests `wf-web` and `vx-controlled`, which pass. Nothing else imports it. I rendered the card on origin/main and on the merged head with deltas 6, -3, 0, 1 and with no mood rows, to static HTML: the two outputs are **byte-identical** (`cmp`). The only difference is when `delta` is undefined: no figure is drawn and the row's fourth grid column stays empty (looks right in `weekly-public-null-change-*.png` and `-dark-390`).

**Roles (1440x900, stub `/me`)**
| Role | Nav items | Typed addresses that open |
|---|---|---|
| MODERATOR | Today, Moderation, Group ideas (3) | those 3; the other 8 "We could not find that" |
| EDITOR | Today, Override the day, Topic calendar, Question pool, News tags, Posted results, Weekly report (7) | those 7 |
| AD_MANAGER | Today, Adverts (2) | those 2 |
| ADMIN | all 11 | all 11 |
| member | none | none |

No flash: `/me` delayed 1.5 s, a MutationObserver kept the page text; Moderator on /people and /calendar, Editor on /people and /ideas, AD_MANAGER on /weekly, member on /people: **0** snapshots out of 18 to 33 each held any of that page's text (nav labels removed first).
Sidebar: 11 items; **11 of 11 fully visible** at 1440x900, 1366x768 and 1280x720; no inner scroll. Same rows as the first check, `roles.ts` unchanged. `/admin/people`, `/admin/ideas`, `/admin/calendar` at 390 show "Open the admin on a computer."

**The changed test assertions** (read each diff). All follow the rule and hide nothing:
- Data draft in `fixc-admin.test.tsx` and `e2e/fixc.e2e.mts`: views and counts now empty and `nextStepsLine` without a count. This is the rule. The test no longer asserts the "Draft from the data" button is enabled; the button still exists and the run above clicked it.
- AI test: scaled counts gone, a draft can be saved with counts 0, approve needs both typed. Rule.
- Approve test: 60+25 became 20+10 against basedOn 40: stays inside the sum rule.
- `q=%40ada.okafor` became `q=ada.okafor`: LOW-1 fix.
- New tests: load failure and Try again, Split with confirm and one DELETE, "214 proposals" once, "AI-assisted" both ways, `moodRows` with null and missing emotions, reason cleared. Nothing was loosened. (API-side test changes are in the other repo and not read here.)

**Words.** U+2014 or U+2013: 0 added lines in `git diff f1cc13b..a2b0af1 -- src`; the only one in `src/` is a stripper that replaces an em-dash in server text (`entry/ui.tsx:79`). No em-dash on any page I rendered (What Next, public weekly all variants). The word "Rant": nowhere in `src/`. Truth: AI-off is stated only when `aiAvailable` is false; a load failure never says it; "AI-assisted" appears only with `aiDrafted` true.

## Proved by runs
tsc, lint, 845 tests, build; the merge; every row of the findings table; the summary panel flow, the public What Next page with both labels at both widths; split flow; people flow; 10 public weekly variants x 2 widths plus dark; the shared component diff by byte comparison against origin/main; role, typed-address, no-flash and nav-reach tables; 390 notices; pictures: summary-01 to 12 (+02b, 10b), ideas-01 to 11, people-01 to 09, nav 3 sizes, admin-390 x3, weekly-admin x4, weekly-public x 10 variants x 2 widths + dark, whatnext x 4.

## Read only
`SummaryPanel`, `IdeasPage`, `PeoplePage`, `AdminFrame`, `roles.ts`, `WhatNextPage`, `reach/WeeklyPage`, `weekly-map.ts`, `polls.tsx`, `admin.ts`, and the test and e2e diffs.

## Not proved
- Anything on the API side: that the real data draft writes `nextStepsLine` without a count, that the real 422 wording matches my stub's, that `aiDrafted` is really exposed publicly, the share page and share card with an approved summary, `DELETE /admin/proposal-groups/{id}` behaviour. The 403 and 500 words are my stub's.
- The public weekly theme rows say "3,200 voices" from the report's `themes[].count`. That is unchanged from main and is not a poll number in my stubs; whether the API's figure is a counted one I cannot say.
- Real AI drafting; a real sign-in with real roles.
