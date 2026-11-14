VERDICT: FIX

# Verify V-FIX-C, the screens (web)

Code under test: `v/fix-c` f1cc13b (checked on `verify/v-fix-c`, which adds only the builder's report). Verifier: independent, unattended. Stub API only, no live service, no .env opened. Scripts were not committed; pictures are in `docs/lead/fix-c/shots/`.

## Merge with origin/main (local copy, never pushed)
`git merge origin/main` into a detached worktree: **no conflicts**. Git auto-merged `contract/openapi.yaml` and `src/lib/api/types.ts` (main changed both). `roles.ts` and `lib/api/admin.ts` were not touched by main, so there was nothing to resolve. I did not regenerate types after the merge; `tsc` passes on the merged result.

On the merged tree:
- `npx tsc --noEmit`: 0 errors.
- `next lint`: "No ESLint warnings or errors".
- `vitest run`: 86 files passed, **840 tests passed, 0 failed** (builder had seen 2 load-flaky failures; none here).
- `next build`: compiled successfully; `/admin/ideas` and `/admin/people` are in the route table.

## Findings

### HIGH-1. The two numbers beside the views are poll votes, labelled and shown as voices
`SummaryPanel.tsx` fields "Voices behind the main view" / "Voices behind the opposing view", pre-filled by the data draft with the weekly poll's vote counts (stub: 5,400 and 2,100 against 9,680 votes). The public What Next page then prints them as "5,400 voices" and "2,100 voices" next to the argument (`WhatNextPage.tsx:40-45`). Pictures: `summary-04-draft-from-data-ai-off.png`, `whatnext-public-datadraft-1440.png`. Poll votes are shown as a count of voices who hold the view. The builder's report admits this; the screen only says "Rewrite them in your own words", not that the numbers are poll votes. Should be: label the admin fields as poll votes and have the public chip say "votes", or leave the counts empty for the editor to type until they are real counted arguments.

### HIGH-2. The next-steps count is printed twice on the public page (if the API's data draft is shaped like the builder's stub)
The builder's own stub for the data draft gives `nextStepsLine` = "214 proposals in 38 groups. Most supported so far: ...". The public page prepends the same count (`WhatNextPage.tsx:53`: `${proposals} proposals in ${groups} groups. ${s.nextStepsLine}`). I rendered it: "214 proposals in 38 groups. 214 proposals in 38 groups. Most supported so far: ..." (`whatnext-public-datadraft-1440.png`). I could not run the real API, so whether the real draft text starts with the count is **not proved**; the builder's stub says it does. Should be: either the draft omits the count or the page does.

### MEDIUM-1. A reader is never told the summary was AI-drafted
Admin shows an "AI-assisted" pill (`aiDrafted`), but the public What Next page and the picture of it show only "Reviewed by an editor"; `aiDrafted` is not read anywhere in the public code (grep). The weekly page does carry "AI-assisted · Human-reviewed". Not false, but the reader cannot see an AI origin the admin knows about. Also the flag stays true after a person rewrites every line (I edited the AI text, PUT still sent `aiDrafted: true`, `summary-07`): the pill then says AI-assisted for words a person wrote. Decide the rule and show it.

### MEDIUM-2. "Group and ungroup": there is no ungroup
`IdeasPage.tsx` has no control to undo or split a group. The page says "To change a group, confirm a new one with the proposals you want. They move, and an empty group goes away." Searched for a button named ungroup/remove/split/undo after confirming: 0 found (`ideas-08-confirmed.png`). A wrongly confirmed group cannot be dissolved except by that workaround. Confirm whether the brief wanted an ungroup; if so it is missing.

### MEDIUM-3. When the summary fails to load, the panel claims "AI drafting is off here"
Stub GET summary returns 500 while AI is on. The panel shows "The summary did not load.", the "Write the summary" button stays enabled, and after clicking it says "AI drafting is off here. The draft from the data still works." and disables Draft with AI (`summary-02b-load-error-then-write.png`). The AI state is unknown, not off; the line is false. Should be: keep the button disabled on load error, or do not state AI is off.

### LOW-1. Handle search sends the "@" through
Typing `@ada.okafor` calls `/admin/users?q=%40ada.okafor&limit=20`. The hint says "with or without the @". Whether the API strips it is **not proved** (no API here). Cheap fix: strip a leading "@" before the call.

### LOW-2. People and roles: reason is kept after a save; the disabled Save has no cue
After a successful save the "Why" box still holds the old reason (`people-08-saved.png`), so the next change would send it unless cleared. "Tried with no reason": Save is disabled (also for fewer than 3 characters) with only the hint "Required." under the field, so it cannot be tried and nothing says why it is grey (`people-06-no-reason.png`). Acceptable, but weak.

### LOW-3. At 1280x720 the sidebar's user block is clipped by 13px
All 11 items are visible, but the aside is 733px tall in a 720px window, so the person's name sits partly below the fold (page scrolls 13px). `nav-admin-1280x720.png`. Not an inner scroll; no item is lost.

### LOW-4 (pre-existing, not this branch)
Public `/weekly` throws "Application error: a client-side exception" if the report has no `emotions` key (or null). The contract marks `emotions` required, so the real API always sends it; I only met it with a malformed stub. `moodRows` is in main. Noted so nobody reads that crash as this branch's.

## Asked and answered
**Roles in the browser** (1440x900, stub `/me`):
| Role | Nav items shown | Pages that open when typed |
|---|---|---|
| MODERATOR | Today, Moderation, Group ideas (3) | /admin, /moderation, /ideas; the other 8 show "We could not find that" |
| EDITOR | Today, Override the day, Topic calendar, Question pool, News tags, Posted results, Weekly report (7) | those 7; ads, moderation, ideas, people blocked |
| AD_MANAGER | Today, Adverts (2) | /admin, /ads only |
| ADMIN | all 11, incl. Group ideas and People and roles | all 11 |
| plain member | none | every address shows "We could not find that" |

**No flash of content:** `/me` delayed 1.5 s, a MutationObserver recorded the page text while waiting; for Moderator on /people and /calendar, Editor on /people and /ideas, and a member on /people, **0** snapshots contained any text from the page the role may not open (22 to 31 snapshots each). Nav labels were excluded from that match.

**390 wide:** `/admin/people`, `/admin/ideas`, `/admin/calendar` each show only "Open the admin on a computer." (`admin-390-*.png`).

**Nav reach** (ADMIN, 11 items): 1440x900, 1366x768 and 1280x720 each have **11 of 11 fully visible with no scrolling**, no inner scroll (overflow visible). Only the 13px user-block clip above.

**Look of the new pages:** `/admin/ideas` and `/admin/people` use the admin kit (PageHead, Card, Pill, queueRow, TextField, Button, EmptyState, LoadFailed, ListSkeleton from `ui.tsx` and `@/components/vx`), same dark sidebar, same cards and type as the calendar and weekly pages. Nothing looks foreign (pictures `ideas-07`, `people-08`).

**Clicking:** draft from data, Draft with AI, edit existing, save as draft, approve, cancel, group by suggestion, group by hand, confirm, find person, tick roles, save: all fire and update. Failed saves (500 and 403) keep the typed words, tick boxes and reason, and re-enable the button (`summary-11-*`, `ideas-09-*`, `people-09-*`). Double-click on save: exactly **1** PUT (summary), **1** POST (group), **1** PUT (roles); double-click on Draft with AI sent 1 extra draft call (2 in total with the automatic first draft, so no duplicate).

**Words:** no em-dash (U+2014) in text I rendered on any new screen, the public weekly page (all variants) or What Next; no added line in the branch diff of `src/` contains an em or en dash; the word "rant" appears nowhere in `src/`. False lines: HIGH-1, HIGH-2, MEDIUM-3 above.

**Public /weekly** (390 and 1440): both variants render; with emotions and states, only emotions, only states, none, empty arrays, and long names (a 68-character state with 1,234,567 votes and a long leading choice) wrap with no horizontal scroll (`weekly-public-long-states-390.png`, `-1440.png`). Admin weekly edit sends `emotions` (4 rows, edited share 46 sent) and no `regions`; a double-click on Save draft sent 1 PATCH.

## Proved by runs
Merge (0 conflicts), tsc 0, lint clean, vitest 840/840, `next build`; every role/page cell above; the no-flash test; nav counts at three sizes; 390 notice; all states in the pictures: summary loading, load error, empty (AI off), data draft (AI off and on), AI draft with its note, saved draft, approved, existing approved, draft error, save refused 500/403, ideas loading, empty, error, proposals error, suggestions present, none, by hand, confirmed, refused 500/403, people loading, empty, error, not found, search error, ready, saved, refused 403/500, no reason, public weekly and What Next at 390 and 1440. I opened the pictures cited here.

## Read only
`SummaryPanel`, `IdeasPage`, `PeoplePage`, `AdminFrame`, `roles.ts`, `ui.tsx`, public `WeeklyPage`, `WhatNextPage` source, and the builder's e2e stub, used for the finding on data draft text.

## Not proved
- Anything on the API side: what the real data draft writes in `nextStepsLine`, whether `q=@handle` is stripped, whether `aiDrafted` is exposed publicly, the share subject text ("What Next and the share subject show an approved summary": only the What Next page was checked; the share page and card are server-rendered or API-supplied and were not rendered with an approved summary).
- Real AI drafting (no key; stub only).
- The 403 and 500 messages in my pictures are my stub's text ("x"); real wording depends on the API.
- The Instagram pictures and the share card with emotions (API).
- A real browser sign-in with real roles.
