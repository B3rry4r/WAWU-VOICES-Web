# V-PROFILE-DELETE
Branch v/profile-delete. Commit 6e7e84a (code and tests); screenshots and this report in the next commit.

## What changed (git diff origin/main)
- src/features/talk/TalkCard.tsx: new exported `OwnVoiceFlow` (the "This voice" sheet for my own post: Edit this post for text, Delete this post, Copy link; plus EditSheet, DeleteDialog, share sheet). TalkCard now uses it for my own posts, so there is one version. Others' posts keep the old sheet (Report, Copy link, Block).
- src/features/profile/PostRow.tsx: optional `own` prop. With it, my row gets the same ellipsis IconButton in the same head slot as the card, opening OwnVoiceFlow. Edited text replaces the row's text. Body gets `whitespace-pre-line` so line breaks show.
- src/features/profile/MePage.tsx: toast, list of deleted ids; "Voices" stat and tab count drop by one; row leaves.
- src/features/profile/PostList.tsx: optional `skip` and `keyOf` (rows keep their own state when another leaves).
- tests/profile-delete.test.tsx (5 tests, new). No existing assertion changed.

## How the rows are drawn
PostRow kept (not TalkCard): the Profile row has the "On:" link, the anon note and count line, so TalkCard would change the look. Only the sheet is shared.

## Commands
- npx tsc --noEmit: no errors in src or tests (the only output is e2e/ files that need @types/node, same on main).
- npx next lint: no warnings or errors.
- npx vitest run: 103 files, 1119 tests passed (new file: 5).
- npx next build: ok. Playwright against `next start` (3101 after, 3102 origin/main in a git worktree), API stubbed with page.route.

## Browser results (390x844 and 1440x900, light and dark, 4 runs)
- No sideways scroll in any. Three dots 44x44 px on every row.
- Page with the dots hidden is byte-identical to the origin/main page (all 4 runs).
- Delete: 1 DELETE call, row gone, toast "Your post is deleted.", tab count 48 to 47, rows 3 to 2.
- Edit: row shows "Edited line one.\nSecond line." (line break kept).
- Row is 2 px taller (171 vs 169) because the 44 px button is taller than the avatar; the voice card does the same.

## Screenshots (docs/lead/profile-delete/)
{390,1440}-0-main-before-change, -1-before-tap, -2-sheet-open, -3-after-delete, -4-edit-sheet, -5-after-edit (.png, light; dark was measured, not saved).

## Not done / unsure
- The app shows no "edited" mark anywhere, so none was added.
- A failed delete closes the confirm and shows the failure words (as on the card); retry is through the dots again.
- A post on a question that has not opened yet: not seen. My stub lists what I give it; the real API hides those from /me/answers, so they do not appear. Not worked around.
- Own posts in the Saved tab get no dots (only My voices). Replies are not listed on the Profile, so none were touched.
- Deleting does not refetch /me; counts are local until reload. whitespace-pre-line also applies to older multi-line posts in rows.
