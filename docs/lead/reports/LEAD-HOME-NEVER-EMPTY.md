# Lead record: Home's "Trending answers" can hold voices from other questions

Owner's order, 16 Nov 2026 (click answer, about 11:05 UTC): "Keep Home filled (Recommended)". USEVOICES posts always stay on top of Home. Under them the 2 top voices: from today's question once it has some, and until then from the other questions of the past week. Each such card says which question it answers.

This is the website half. It is right with both servers: the one live today (every card is from today's question: the block is the same as before, element for element) and the new one.

- Desktop heading "Top voices on today’s question" only when every card is from today's question; otherwise "Trending answers".
- "See all" only when today's question has at least one voice.
- A card from another question gets one line above it, "On: <question>", that opens that question.

Independent check: verify/home-never-empty, round 2, VERDICT MERGE at a058b8b (same as main in 16 of 16 cells; 48 cells of new cases clean; 116 of 116 controls act on the card's own question and post; the record screen 20 of 20 for both kinds of question; card edges equal main's at 360, 390 and 1440; vitest 157 files and 1595 tests).

This branch = a058b8b joined with main 42e59dc (the small-phone card fix; different files). Lead's run after the join: `tests/home-never-empty.test.tsx` 4 of 4, `npx tsc --noEmit` clean.
