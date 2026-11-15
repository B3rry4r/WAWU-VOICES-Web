# V-HOME-NEVER-EMPTY (web)

Branch `v/home-never-empty`, from origin/main 8851c92. Prepared only: nothing released, no pull request.

## What changed
- `src/components/feed/parts.tsx` (Answers, about line 60): new optional prop `questionId`. When it is given, a card whose question differs and that has `questionText` gets one line above it, "On: <question text>", linking to `/q/<questionId>`. It is the same "On:" line Profile draws, set with Tailwind classes, one line, cut with an ellipsis. It sits inside the existing card frame, so a hidden or blocked card leaves no stray line. Without the prop, nothing changes (Category, Search, Landing).
- `src/components/feed/HomeScreen.tsx` (about lines 71 to 74 and 120 to 136):
  - Heading: the old two-part heading (phone "Trending answers", desktop "Top voices on today’s question") only when every drawn card is from today's question. Otherwise plain "Trending answers" on both.
  - "See all": drawn only when today's question has at least 1 voice.
  - Draws `h.trending.slice(0, 5)`, as before. Buttons are the existing card's, which already act on that card's own question and post.
- `tests/home-never-empty.test.tsx` (4 tests) and `tests/fixtures/home-trending-today.html`.

## Proof for "same as today"
The fixture is the block's HTML written by the code BEFORE this change (a clean checkout of 8851c92). The test renders the all-today case now and requires the same HTML, character for character. It passes.

## Runs
- `npx tsc --noEmit`: 0 errors.
- `npx next lint`: no warnings or errors.
- `npx vitest run`: 157 files passed, 1595 tests passed, 0 failed (includes the 4 new).
- `npx next build`: passed (built with the API address pointed at my own stub on 127.0.0.1:4101; no live service called).

## Existing tests that fail
None. No existing test was edited.

## Screenshots (light, `docs/lead/reports/home-never-empty/`, each under 300 KB)
- home-today-390.png, home-today-1440.png: all cards from today's question (desktop heading "Top voices on today’s question", See all drawn).
- home-mixed-390.png, home-mixed-1440.png: admin post from another question first, a voice from a third; "On:" lines, heading "Trending answers" on both sizes.
- home-zero-390.png, home-zero-1440.png: today's question with 0 voices, cards from another question; no See all, "Trending answers" on desktop, "On:" lines.
- No sideways scroll at 390 (page width minus window width was 0 in all three cases).

## Could not prove
- The Discuss and Share buttons on a card from another question are not clicked in a test. They are the same card code that already uses that card's own `questionId` and id; I read it, I did not drive it.
- The "On:" line was checked at 390 and 1440 only with short and medium question text; very long text is cut by the ellipsis but not photographed.
- Not tested against the new server, only against a stub that sends the described shape.
