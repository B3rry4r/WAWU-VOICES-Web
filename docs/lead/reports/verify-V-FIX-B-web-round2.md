VERDICT: FIX

# Verify V-FIX-B round 2 (web), code `v/fix-b` at cf2c175 (my branch also holds reports and pictures)

Everything ran against one `next build` + `next start`, API stubbed in the browser. No live service, no .env. The API repo is not in this checkout, so nothing about the API's real words, payloads or counting is proved.

Why FIX: the join flow, one-tap posting and all first-check findings are closed, but "one clip at a time" is not true for two clips the brief names (the theme song and the recorder's own preview), and the branch does not merge cleanly into today's origin/main. Neither is a crash; the lead may judge the song/preview gap acceptable for tonight, but it is open.

## Gates (exact)
- `npx tsc --noEmit`: exit 0, no output.
- `next lint`: "No ESLint warnings or errors".
- `npx vitest run` whole suite, one run: **88 files passed, 853 tests passed, 0 failed.** (The builder's three failures do not recur.)
- `next build`: exit 0. All runs below used this build.

## First check's findings
| # | Finding | Status | Proof |
|---|---|---|---|
| HIGH 1 | Advert and other clips overlap | **Closed for answer, reply, override note, advert.** Open for song and recorder preview (new MEDIUM A) | `clips-ov-then-ad-390.png`, `clips-ad-then-ov-390.png`, `clips-thread-0-then-1-390.png`, `clips-thread-1-then-0-390.png`; log in "Proved by runs" 3 |
| HIGH 2 | No Verified News tab | **Closed** | `admin-news-asking-editor-1440.png`, `admin-news-asking-admin-1440.png`, `admin-news-approved-*`, `admin-news-declined-*`, `admin-news-asking-390.png` |
| MEDIUM 3 | Guest's tag lost when joining | **Closed** | `join-gossip-6-after-finish-390.png` etc., requests in 4 |
| MEDIUM 4 | New notices may open nothing | **Closed for the builder's stated shapes; shape not proved against the API** (new LOW D) | `notifications-new-kinds-390.png`, `notif-n1/n2/n3-*` |
| LOW 5 | Long advert label scrolls sideways at 390 | **Closed** | `home-audio-ad-long-390.png`, `...-1440.png`, `home-audio-ad-unbroken-*` (scrollWidth 390/390 and 1440/1440) |
| LOW 6 | Override long string scrolls | **Closed** (300 unbroken characters, 390/390) | same pictures |
| LOW 7 | Advert link unchecked | **Closed**: only http/https drawn; new tab, `rel="noopener noreferrer"`, opener cut, pauses the advert | `home-audio-ad-link-clicked-390.png` |
| LOW 8 | Editor briefly sees "Request Verified News" | **Not retested** (not in the delta; presumed unchanged) | none |
| LOW 9 | Differences from boards | Unchanged by round 2; not re-compared | none |

## New findings

### BLOCKER
None.

### HIGH
None.

### MEDIUM
**A. The theme song and the recorder's own preview are outside "one clip at a time".**
- Where: `claimPlayback` is called only from `LivePlayer`, `talk/lib.tsx` and `ProfileCard`. `TakePlayer` (`src/features/speak/parts.tsx:82`, used on the record screen and the reply recorder) and the song (`src/lib/theme-song.ts`) do not claim. Voices stop the song (`pauseSongForVoice`) but the song starting does not stop a voice.
- Did: Home, guest, played override note, then the speaker button: log `["ovclip","voices-theme.mp3"]` (both playing). Same with the advert (`["adclip","voices-theme.mp3"]`). Thread at 1440: reply playing then song: `["voices-theme.mp3","repclip"]`; answer playing then song: `["voices-theme.mp3","ansclip"]`. Record screen at 1440: preview playing, then song: both playing (`clips-preview-song-1440.png`). Starting a voice after the song does stop the song (4 of 4).
- Should be: starting the song stops the playing clip and the preview, or the lead rules it out. The same gap exists on main for the song; the brief for this check lists them.
- Preview vs another clip: I could not put them on one screen. On the record screen there is no other clip; in the reply sheet the sheet's scrim covers the answer clip. So that pair is not reachable by a person; `TakePlayer` still would not stop one.

**B. The branch conflicts with current origin/main.** origin/main is now 59a44d6 (merge base 53e738b). `git merge-tree` reports a content conflict in `src/features/speak/SpeakScreen.tsx` (auto-merges ProfileCard, SettingsPage, types.ts). The builder's report names this overlap (V-FIX-A). The merger must resolve it by hand and re-run the join flow; the tag/draft code in SpeakScreen is the part at risk.

### LOW
**C. A vanished or double-decided request stays on screen.** Editor approves an item and the API answers 404 (gone) or 409 (another editor decided): the red line shows the API's own words, the row stays in the list, and Approve and Decline keep giving the same error until the page is reloaded. With an API body that has no message the web falls back to "That did not go through. Try again." (code, `refusalWords`), which tells nobody the request is gone. The real API words are not proved.
**D. POLL_CLOSED with no `questionId` opens nothing** (the tap stays on Notifications). The builder says the API fills it "via the poll or the topic's first question"; a weekly poll on a topic with no question would hit this.
**E. Link on an advert pauses whatever clip is playing, not only the advert** (`stopPlayback` stops the current clip). Harmless unless an override note is playing when the advert link is tapped.
**F. A held draft with a malformed `tag` (hand-edited storage) makes the record page show "Application error"**. Not reachable by normal use. Held recordings also have no life at all in the code (a 90 day old one came back with its tag); same as main.

## Proved by runs
1. Gates above.
2. **Clips** (real audio elements watched by wrapping `HTMLMediaElement.play/pause`, 25 s WAV; 0.8 s WAV for the ends-by-itself case; log files in my scratchpad):
   - Home: override note then advert: first 1 playing, then only the advert; override button back to "Play voice, 25 seconds"; reverse also. Pause then other: one plays.
   - Thread: answer then reply, reply then answer: one plays; stopped button shows "Play".
   - Advert counted once: advert, override, advert, override, advert: 1 LISTEN, 1 IMPRESSION, 2 `/play` for the ad+note clips.
   - A note that ends by itself: button back to Play, nothing playing; then advert, then note: one playing, advert shows Play.
   - Home answer cards are links: tapping the play icon on Home opens the question; answer clips play only on thread pages.
   - Two tabs: not run. By code `current` is a module variable, so each tab keeps its own and two tabs can play together.
3. **Join flow by clicking** (stub; the email-code step skipped by setting the session after the country step, as in the first check), guest to `/q/q1/posted?a=new1`. Requests sent:
   - no tag: `{"kind":"VOICE","clipId":"c1"}` (one tap; same as origin/main's code path, `createVoiceAnswer` adds nothing without a tag; main's bytes not re-run because main moved).
   - Gossip: `{"kind":"VOICE","clipId":"c1","isNews":true,"newsTag":"GOSSIP"}`.
   - Unverified News: `...,"isNews":true,"newsTag":"UNVERIFIED_NEWS"}`.
   - Request Verified News + source NiMet: `...,"newsTag":"UNVERIFIED_NEWS","requestVerified":true,"newsSourceName":"NiMet"}`.
   - Pictures: `join-{none,gossip,unverified,request}-{1-guest-preview,2-welcome,3-country,4-topics,5-profile,6-after-finish}-390.png`.
   - Tag, Re-record, new take: Gossip still pressed and sent. Tag, Send, then browser Back from join: tag there. Tab closed during the join: new tab on the speak page shows the recording and Gossip; no post until the person signs in and taps. Draft 90 days old: comes back with its tag.
4. **Editors' queue** (editor and admin, 1440): Asking for Verified News first and selected with count (2), source on each row and in the form, long source link wraps (390 scroll 390/390); approve sent `APPROVE_VERIFIED` with name and link, decline sent `DECLINE_VERIFIED`; counts and rows drop; empty states. With none asking and flagged items: opens on Flagged, Asking sits second. Both empty: opens on Asking with words. Moderator and ad manager: nav shows no News, `/admin/news` by hand shows "We could not find that", no news call made. Member: whole-page "We could not find that". 404, 409, 422, 500: the API's message shown, rows stay (see C).
5. **Notices** (builder's shapes: POLL_CLOSED `poll`+`questionId`, CATEGORY_ALERT `question`, TAG_FOLLOW `answer`+`questionId`), 390 and 1440, live and gone (404): `/q/{id}/results`, `/q/{id}`, `/news/{id}`; each renders; gone gives "We could not find that." with Back and Home buttons. TAG_FOLLOW with no `questionId` still opens the Newsroom post.
6. **Settings** (390 and 1440): "News tag alerts" shows the API's value (true, false, and missing = on), a tap sends exactly `{"notifyTagFollows":false}` then `true`; Replies, Poll results, Reactions each send only their own key; value holds after reload.
7. **Adverts and override**: scroll 390/390 and 1440/1440 with a 60+ character label, 110 to 140 character words, 260 character unbroken strings; `javascript:`, mixed-case, tab-prefixed, `data:`, `vbscript:`, `ftp:`, relative and `//host` links draw no button (audio advert, feed advert and override); https and http draw. Advert link: `target=_blank`, `rel="noopener noreferrer"`, popup opened, `window.opener === null`, Home stays, the playing advert pauses, events IMPRESSION, LISTEN, TAP.
8. **Words**: no em-dash or en-dash in added source lines (`git diff 1ad938b..cf2c175`), none in rendered text and labels of Home (override, advert), write, write with Request, record, Settings, admin news; "Rant" nowhere (source, built `.next`, rendered).

## Existing assertions the builder changed (read)
- `tests/wf-admin.test.tsx` RW3: old `not.toContain("Asking for Verified News")`, new `toContain` plus "listed before Flagged". It follows the RW3 ruling's own condition ("hidden until a route creates those requests"). The assertions that "New" and "Sensitive topics" tabs stay hidden are untouched. Hides nothing else.
- `tests/listen-track.test.tsx`: its mock of `playback.ts` gains `claimPlayback`, `releasePlayback`, `stopPlayback` as no-ops; no assertion changed. This does mean that file no longer exercises the claim path; `tests/fixb-one-clip.test.tsx` covers it.
- `tests/fixb-web.test.tsx` gets the same mock additions.

## Read only
- `playback.ts`, `NewsPage.tsx`, `NotificationsPage.tsx`, `SpeakScreen.tsx`/`draft.ts` deltas, `AdSlot` changes, `refusalWords` and the client's `explained` rule.
- The `contract/openapi.yaml` and `types.ts` diff (generated).
- Shared screens (question page, thread, profile, anonymous switch) were not re-compared against main; the delta touches `talk/lib.tsx` (clip claim) and `ProfileCard.tsx` only there.

## Not proved
- Anything in the API: real `targetType`/ids of the three notices, the words of 404/409 on a decision, TAG_FOLLOW counting and caps, advert LISTEN once per day, link checking.
- Real sign-up and email code; real microphone and audio output; Safari/iOS; dark mode; first-check LOW 8 (editor sees Request chip briefly).
- Two tabs (reasoned, not run). Empty-body error fallback (read only).
- origin/main's exact request bytes today (main moved; the code path is the same as the first check proved).

Pictures: `docs/lead/fix-b/shots-r2/` (390x844 and 1440x900, light, deviceScaleFactor 2). My scripts stay uncommitted in the scratchpad.
