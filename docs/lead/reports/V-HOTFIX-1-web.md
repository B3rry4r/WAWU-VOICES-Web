# V-HOTFIX-1 web: no "also block" on a post without a name

## Files and source lines
- `src/features/talk/ReportScreen.tsx` (139 lines after the change; +6 / -4): the sheet.
- `tests/report-anon.test.tsx` (64 lines, new): three tests.
- `docs/lead/reports/V-HOTFIX-1-web.md`: this report.

## What changed
A post is "without a name" when the answer has no `author` (the same test the cards use to show "Anonymous"), or carries `anonymous: true`. For such a post:
- The sheet shows no checkbox and no line about blocking, and shows no handle in the bar or the thanks text.
- The request omits `alsoBlock` entirely.
- The confirmation is only "Thanks. We got your report." with the moderators line. The "You blocked" row, the Undo button and any block-list link are not shown, and the receipt's `blocked` is ignored.
A named post is unchanged: same checkbox, same `alsoBlock: block && !!handle`, same confirmation.

## Where the sheet is opened from
The only opener of `ReportScreen` (`/report/[type]/[id]`) is `TalkCard.tsx` line 236 ("Report this voice" in the "This voice" sheet). Answer cards are used on question pages, threads, profile and search lists. A REPLY report (`/report/REPLY/:id`) never loads an author, so it never offered blocking. Other report UIs: `results/ReportSheet.tsx` (wrong numbers on a result post, never sends `alsoBlock`) and the USER report on `PersonPage.tsx` (reports a named person's profile, not a post; unchanged). Share pages, notifications and news have no report opener.

## Item 3: other "this person" controls on an anonymous post
Found one and it was already safe: `TalkCard.tsx` "Block @handle" (line ~241) renders only when `a.author?.handle` exists, so it is absent on an anonymous answer. No change needed. I looked for Block, Mute, Message, View profile, Follow and "More from" in `src/features/talk`, `share`, `news`, `notifications`, `profile/PostRow.tsx` and `src/components`. None act on an anonymous post: names render as plain "Anonymous" text (`PostRow`, `SharePageView`, `NewsCard`, `ThreadScreen`, `feed-format`) with no link. "Follow" only appears as news tag follows and category follows (not people). Messages are not served (AppShell). Nothing removed.

## Checks
- `npx tsc --noEmit`: exit 0, no errors.
- `npm run lint` (next lint): no warnings or errors.
- `tests/report-anon.test.tsx` + `tests/report-sheet.test.tsx`: 2 files, 5 tests passed.
- Whole `npx vitest run`: 86 files, 834 tests, all passed. No existing test failed and none was edited.
- `next build`: succeeded (once).

## Choices
- Reply targets keep their existing behaviour (no block offered).
- `anonymous` is not in the generated `Answer` type, so it is read through a narrow cast; remove it if the API never sends the flag.
