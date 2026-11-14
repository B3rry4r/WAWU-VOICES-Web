VERDICT: FIX

INTERIM (first version, written while the runs go on; the final report replaces this file).

Code under test: `verify/batch-c2` after `git merge origin/v/batch-1114c2` (clean, no conflict; head 639be42 merged as 176feea). One `next build` (exit 0), `next start`, Chromium at 390x844 and 1440x900, API stubbed, nothing live called.

Verdict-changing finding so far: the vote explanation in words (`src/features/vote/ResultsPage.tsx:192`) and the proposal (`src/features/vote/ProposePage.tsx:99`) drop their Idempotency-Key on ANY HTTP answer, a 500 included. Run: the server answered 500, then 201: the retry went out under a NEW key (explain: `98b3510b` then `2779f98e`; propose: `f470fa9f` then `7a9fff08`). A text answer, a voice answer, a text reply and the held draft keep the SAME key after a 500 (`4a8b2e26` twice, `a9c8d65d` twice, `bdbf356a` twice, `held-key` twice). A 429 and a plain 409 behave the same way (explain: new key). So two writers can post twice when a gateway answers 502/504/500 after the API stored the post.
Closed so far: HIGH-1 (share page, all runs: never an error page), MEDIUM-1 on the four main writers, MEDIUM-2, MEDIUM-3 (details in the final report).
