VERDICT: FIX

(First version, written as soon as the first BLOCKER and HIGH were proved. Updated below as the remaining checks finish.)

## BLOCKER
1. Nothing flips to the live state by itself at 23:00:00 UTC. Home, landing (/welcome), /join, /go and the question page were loaded at 22:59:30 (browser clock faked, stub switched to OPEN at exactly 23:00:00.019 browser time). I watched all five for 150 s: none changed. A phone that "slept" 8 h (clock fast-forwarded, visibilitychange and focus fired) also stayed on "Coming up" on all five. Only a reload shows the open question. Cause: `comingUp()` (src/lib/feed-format.ts) is evaluated once in render; `useLoad` (src/components/feed/useLoad.ts) fetches once; no timer, no refetch on visibility. Only the bell listens to focus. People waiting at midnight see "Coming up / Opens Sunday 15 November" for ever. Fix: a timer to startsAt (plus a refetch at that instant, with a small random delay to spare the API) and a refetch on visibilitychange/focus when startsAt has passed.

## HIGH
2. The big "Speak" mic in the bottom bar / sidebar, "Add your voice" on /go and landing, goes to /q/<id>/mood (src/features/speak/SpeakScreen.tsx:440) and says "Today's question" and "This question has closed. You can still read and listen to every voice." That is false on a question that has not opened. Pictures: docs/lead/prelaunch/shots/before/speak-390-in.png. Same on origin/main (not introduced by the builder) but the owner's rule is "nothing false" and the Speak button is on every screen.
