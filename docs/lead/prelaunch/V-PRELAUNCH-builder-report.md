# V-PRELAUNCH report

Heads (branch v/prelaunch, pushed, no PR):
- API  /home/user/wt/v-prelaunch  d45f0d5  (on origin/main f336fc6)
- Web  /home/user/wt/vw-prelaunch 9c37bf8  (on origin/main 53e738b)

## The one rule reused
api/src/feed/question-window.ts already held the V-27 window (isQuestionOpen / isQuestionOver / questionOpenWhere). Added there, built only from those parts:
isQuestionReadable (:65), questionOverWhere (:53), questionReadableWhere (:70), answerReadableWhere (:77), replyReadableWhere (:82), notOpenYet (:103, the plain refusal "This question opens on Sunday 15 November."). Readable = open or over; before the window and drafts are not, for anyone including the author. Nothing stored changes; when startsAt passes everything shows again.

## Read paths put behind it (file:line)
- answer by id and replies (replies call the same gate): talk/posts.service.ts:303 (visibleAnswer). ANSWER_INCLUDE (me/views.ts) now carries the question's status/startsAt/endsAt.
- answerWhere (feed.service.ts:48) now ANDs answerReadableWhere; used by trendingAnswers, the home payload, question answers, category top voices (:425).
- Home `trending`: feed.service.ts home(), today's question only, and only if open (see point 2).
- new / trending question feeds, category and topic pages: already behind liveWhere/shownWhere (startsAt <= now); unchanged. Faces (recent voices): feed.service.ts:420s.
- counts: topic voiceCount/voicesCount (feed.service.ts:84), category voicesThisWeek (:255, raw count now limited to readable question ids), profile voicesCount (me/views.ts:153,164), search people counts (feed.service.ts:1161,1172), saved-question category counts (me/views.ts:369-397).
- search answers: feed.service.ts ~1100 (raw hits filtered through answerReadableWhere before paging and totals).
- news list/item/tags/flags: news/news.service.ts:59 (`visible` is now a getter that adds the rule; it had no question test at all).
- profile posts (others'), replies list, my answers, saved answers and saved questions: me/people.service.ts:96,152,178,219,232.
- share page, card, story, square, link creation: reach/share-subject.ts:424,491; reach/share.service.ts:348 (moodCardGone).
- notifications that link to a voice or reply (list and unread count both go through render): reach/reach.service.ts:376.
- weekly report numbers drafted from answers: reach/weekly-draft.ts:171.
- mood counts: mood/mood.controller.ts:48.
- listen: talk/engagement.service.ts (assertStarted).
Refusals: posting an answer or reply (talk/posts.service.ts:183,458), react, like, save, helpful, report (talk/engagement.service.ts:51,324), proposal writes (vote/proposal.service.ts:114), poll explanation (vote/poll.service.ts:478) now answer 409 QUESTION_NOT_OPEN "This question opens on <Lagos weekday day month>." Voting on a poll before its poll window already answered 409 POLL_NOT_STARTED "This poll has not opened yet." (unchanged). A draft or unknown question still 404.

## Point 2: Home heading
Boards disagree by size. Home-390.dc.html and HomeGuest-390.dc.html: `<h2 id="h-trend" ...>Trending answers</h2>`. Home-1440.dc.html: `<h2 id="h-top" ...>Top voices on today's question</h2>`. The web already draws both headings (phone / desktop). The desktop heading is about today's question, so the list now is: API home().trending = top 2 answers of today's question only, and only when that question is open (empty otherwise). Web: the section is not drawn at all when the list is empty (no "No voices yet" box). Headings left as the boards draw them.

## Point 3 (web)
- Topic of the week (rail and phone card): topic status SCHEDULED and startsOn after today (Lagos): title kept, meta "Starts Monday 16 November", no "Poll open", rail has no "Join the conversation" button. (src/components/feed/parts.tsx WeekCard, vx/home.tsx TopicOfWeek `upcoming`, lib/feed-format.ts.) WeekCard is also used on Discover, category and search rails, so they follow.
- Question card (Home, /welcome landing, /go): label "Coming up", line "Opens Sunday 15 November", no counts, no buttons (the card has no Share today, so nothing). /go's word buttons are hidden before opening. /join preview (phone slide and desktop pane): "Coming up" and the Opens line. Question page: text, hint, Opens line only (no counts, no voices list, no buttons, no stage nav). Its Share button is hidden there, because the API answers 404 to a share of a question that has not opened (V-27); say if you want Share kept and the API relaxed for the launch question.
- The moment startsAt passes the next fetch (or render) draws the normal card (date comes from the API's startsAt; checked in vitest and Playwright with the clock moved).
- Topic page: the web has no topic page (WeekCard opens the question). API GET /topics/:id returns status SCHEDULED and startsOn; no questions are listed as open (/questions lists only started ones).
- Weekly report link and Discover: no published report exists in production (GET /weekly-reports is empty). The report numbers are guarded (weekly-draft). I did NOT gate published reports by topic start: that broke weekly/share specs that use future-dated topics and nothing live needs it.

## Checks and results
- API spec src/feed/prelaunch.spec.ts (8 tests, scratch PostgreSQL 16 + Redis, dropped): real seed:questions, seed:launch, applyShift (same code as calendar:launch-shift --apply); answer + reply + save + notification inserted on the 17 Nov bank question. Clock at 14 Nov 05:00, 14 Nov 23:00, 15 Nov 23:00 UTC: guest, another member and the author each swept 17 routes (answer by id, replies, question answers, home, feed trending (+news tag), feed new, search answers and people, news list/item, people profile/by-handle/replies, categories, my answers, my saved, notifications): zero leaks. At 17 Nov 00:00 UTC they all show again with no data change (counts: topic voicesCount 1, question voicesCount 1, profile voicesCount 1), and go back to hidden when the clock returns. Home states per instant: launch question SCHEDULED at 05:00 with topic SCHEDULED startsOn 2026-11-16 and zero counts; LIVE at 23:00; topic LIVE at 15 Nov 23:00. Posting, replying, react, like, save answer, save question on a SCHEDULED question: 409 with "This question opens on Tuesday 17 November." / "Sunday 15 November." Share link for the hidden answer: 404; a link made after opening 404s when the clock goes back. The same spec run against origin/main fails (13 leaks listed for the guest), so it bites.
- API suites run (one batch): src/feed, test/feed, test/talk, test/reach, test/news, test/vote, test/mood, test/me/me.spec + social.spec: 33 of 34 suites passed, 475 tests; test/talk/rt-limits.spec.ts failed once under load (a 900/min limit test) and passed alone (3/3). tsc clean; eslint clean on touched files (one pre-existing-style `any` warning in the new spec).
- One existing fixture changed: test/news/news.spec.ts creates its question as a DRAFT (the default) and expected its news to show; it now creates it LIVE. This is the old behaviour the task outlaws (answers under a question that is not open).
- Web: vitest tests/prelaunch.test.tsx 11 tests; plus the related suites (w1-entry, lch-a-go, lch-a2, lastfix-web, walk-fix, wf-web, wf6b-people, home-redraw, feed-format, talk, date-format, w6-screens, vx-controlled) pass (talk.test.tsx had two timeouts while the API suite was hogging the CPU, 23/23 alone). tsc clean, eslint clean.
- ONE next build: compiled and generated 50/50 pages. Playwright (API stubbed, clock fixed 14 Nov 05:18 UTC and 23:05 UTC; e2e/prelaunch.e2e.mts): Home guest and signed in, question page, /join, /welcome at 390 and 1440, before and after opening, all asserting the texts. Pictures in /tmp/claude-0/-home-user/f6abda14-ea52-5aeb-b102-78d31cb7857d/scratchpad/prelaunch/ (22 png). I looked at home guest 390 and 1440, question 390, join 1440, landing 390 beside the boards.

## Could not prove / caveats
- After the build I added one line to Onboarding.tsx (the Opens line on the /join phone slide); the final Playwright run used `next dev`, not the build (no second build, as asked). vitest and tsc cover it.
- I did not look at every picture one by one (the 'after' ones and dark mode were only asserted by text).
- The stored per-user counter users.voiceCount (profile `voiceCount`) is not recomputed; only `voicesCount` is. Admin screens and the admin weekly-report quote editor are unchanged.
- Notifications of non-named types linked to a hidden answer are not filtered in the unread badge count (only the named reply/reaction ones, which render through the same path).
- A question page share before opening is hidden, not enabled (see above).
- Not run against the real database or the live API; production behaviour assumes the startsAt values measured by the lead.
