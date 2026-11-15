# V-PAID-POST-BOX

## How I reproduced it
A vitest test (tests/paid-post-box.test.tsx, test 1) holds a post, posts it the way the payment-done screen does, then opens the write screen. On main the box opens with the same words in it. A second Post tap would send them again with a new key.

## Cause
`postDraftForPurchase` (src/features/units/post-draft.ts) records the post with `markPosted` but never touches the typed words kept for the write box (`typedDraft` / `saveTyped`, src/features/talk/lib.tsx, key `voices-typing-v2`, slot `q:<question>`). The write screen restores those words on open (WriteScreen.tsx line 63).

## Fix (one place)
All paths go through `postDraftForPurchase`, so the fix is there, not in the write screen. A restore-time check on the write screen would be wrong: a person who types something new after a posted record would lose it.
- src/features/talk/lib.tsx: new `forgetPostedWords(slot, body, person)`. It removes the person's own words for that slot only when they are still the words that were posted. Nothing is claimed or moved from the old shared table.
- src/features/units/post-draft.ts: `forgetWords(questionId)` is called after `markPosted` (the automatic post, the "Post it now" offer, the retry), when the record already says posted for this payment (a page load, another tab posted first), and in the no-draft-id path through `findPostedFor`.
Diff: 2 source files, about 30 lines added, 1 line changed. Nothing else touched (not ReplyComposer, not src/features/speak, keys and post count unchanged).
Refusal, lost connection and the "offer" status never reach those calls, so draft and words stay.

## Proof
- tests/paid-post-box.test.tsx: 7 tests (the five asked for, plus a full page load case and a "newer words are kept" case). With the fix: 7 pass. On main product code: 5 fail (tests 1, 3, 4, 5, 5b: the words are still there). Failures on main, as printed: "expected 'My honest answer' to be ''" for 1, 3, 5, 5b and "expected { t: 'My honest answer' ... } to be undefined" for 4.
- Test 2 (refusal keeps the words) and the "newer words kept" test pass on main too. They guard behaviour that must not change, so they cannot fail on main.
- `npx tsc --noEmit`: 0 errors. `npx next lint`: no warnings or errors. `npx next build`: ok. `npx vitest run`, 3 times: 138 files, 1410 tests, exit 0 each time.
- Browser (e2e/paid-post-box.e2e.mts, built app with `next start`, API and pay page stubbed, Chromium) at 390x844 and 1440x900: type, out of posts, Get tokens, buy, pay, banner "Your answer is posted", back to the write screen: box value "". Calls to the answers route: [402, 201], so 1 refused attempt and exactly 1 post. Same after a reload of the payment-done page. Record screen (pick HOPEFUL, Type it instead, type, Send): 1 post at both widths. 6 of 6 ok per width set.
- e2e/draft-owner.e2e.mts, unchanged: 38 of 38 ok on three of my four runs at both widths (the file runs both widths itself).

## Could not prove
- One of my four runs of draft-owner.e2e.mts printed "1 of 38 FAILED". I only kept its last lines, so I do not know which case. The next runs were all 38 ok. I think it was a timing flake (it ran straight after my own e2e) but I cannot show that.
- I did not run the browser script against a main build, so the browser failure on main is not shown. The vitest failures on main are.
- The real pay page and sign-in host were stubbed. Another tab's post is simulated by the shared record in storage, not by a second real tab.
- Commit trailers use the lines in the brief (names Fable 5.2); I am not that model.
