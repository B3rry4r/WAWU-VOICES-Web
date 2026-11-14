VERDICT: FIX

# Verify V-FIX-B (web), code `v/fix-b` at 1ad938b, origin/main 53e738b is an ancestor

Verifier: independent. Everything below was run against built apps (`next start`) with the API stubbed in the browser. No live service and no .env were touched. The API repo is not in this checkout, so nothing about server behaviour is proved here.

Join flow and one-tap posting: they behave exactly as on origin/main (proved, see "Proved by runs"). The verdict is FIX because of the two HIGH findings and one MEDIUM that costs a person their choice.

## Findings

### HIGH 1. An audio advert does not stop another clip, and another clip does not stop it
- Where: `src/features/profile/playback.ts:3-17` (`makePlayer` is a bare `new Audio()`; the only coordination is `pauseSongForVoice`, which pauses the theme song). `src/components/feed/AudioAdCard.tsx` uses the same `LivePlayer`.
- Did: Home with an override voice note and an audio advert (390, light). Wrapped `window.Audio` to watch the elements. Tapped the override note, then the advert.
- Saw: `override tapped: ["playing"]`, then `advert tapped too: ["playing","playing"]`. Both play at once. Events: one IMPRESSION, one LISTEN.
- Should be: starting the advert (or any clip) stops the one already playing, as the brief for this check requires ("stops when another clip starts"). The same gap exists on main between two answer clips, but this branch adds two more clips to Home, so the overlap is now a launch-night path.
- Counting itself is right: see Proved by runs.

### HIGH 2. The editors' queue has no tab for Verified News requests
- Where: `src/features/admin/NewsPage.tsx:80-84`. The tabs are "Flagged as misleading" and "All changes". The comment reads: `"Asking for Verified News" stays hidden until a route creates those requests` (lead ruling RW3). `TAB_QUERY.asking` exists but is never rendered.
- Did: stubbed `/admin/news/items`, opened `/admin/news` as an editor, logged the tab requests.
- Saw: the page asks only `tab=flagged` (and `all-changes` if clicked). `asking-verified` is never requested. A request shows only if the API also returns it under `flagged`. The builder report says the request "shows in the editors' queue (GET /admin/news/items?tab=asking-verified ...)", which is the tab this web never opens. Approve and Decline work when the item is on screen (`APPROVE_VERIFIED` and `DECLINE_VERIFIED` bodies seen, see `admin-news-verified-request-1440.png`, `admin-news-approve-done-1440.png`, `admin-news-decline-done-1440.png`).
- Should be: the tab is shown now that the route exists (counts come back in `counts.askingVerified`), or the API folds requests into `flagged`. I could not check which. If neither, a person who taps Request Verified News is never answered.

### MEDIUM 3. A guest's tag is thrown away when they join
- Where: `src/features/speak/SpeakScreen.tsx:333-342` (`send()` saves only `{...take, questionId, savedAt}` as the draft, then goes to join) and the `autopost` effect at `:145-155`, which calls `send()` with a fresh `NO_TAG`.
- Did: guest records, picks Gossip, taps Send, goes through the join steps, taps "Finish and post my voice".
- Saw: the post sent was `{"kind":"VOICE","clipId":"c1"}`. Gossip is gone; it posted as Not news with no warning. Same for "Request Verified News" and its source.
- Should be: keep the choice across the join (store it with the draft), or tell the person.

### MEDIUM 4. Where a tap on a new notice lands depends on a payload the web did not change
- Where: `src/features/notifications/NotificationsPage.tsx:52-62` (`targetHref`). The web diff has no notification change; the types and icons for POLL_CLOSED, CATEGORY_ALERT and TAG_FOLLOW were already on main.
- Did: rendered six notices (`notifications-390.png`, `notifications-1440.png`) and tapped each.
- Saw: POLL_CLOSED with `targetType:"question"` opens `/q/q1`. CATEGORY_ALERT with `question` opens `/q/q1`. TAG_FOLLOW with `answer` plus `questionId` opens `/q/q1/a/a1`. POLL_CLOSED with `targetType:"poll"` (only FLASH_POLL is handled) stays on `/notifications`. TAG_FOLLOW with no `questionId`, or no target, stays too.
- Should be: every new notice opens something. The API's real `targetType` is unknown to me, so this is a risk to confirm against the API, not a proved defect.

### LOW 5. Audio advert with a long button label scrolls sideways at 390
- `AdSlot` CTA (`src/components/vx/sponsored.tsx`). A 60 character label gave `scrollWidth 518` against 390. A long brand, headline and body made of words wrapped fine (390/390). An unbroken 100+ character word in the advert text gave 1641. On main the feed ad with the same long label did not scroll, but main did not draw an advert in my stub, so this is not a like for like proof.

### LOW 6. Override text with one long unbroken string scrolls sideways at 390
- `src/components/feed/OverrideMessage.tsx:35`. `See https://example.com/aaaa...` (120 chars) gave `scrollWidth 1363`. Origin/main does the same (1363), so it is not new, but the override is now fuller. A `break-words` would close it.

### LOW 7. The advert button is an unchecked link
- `AudioAdCard.tsx` passes `ad.linkUrl` straight to `AdSlot`. With `javascript:alert(1)` the button gets `href="javascript:alert(1)"` and no `target`. The override link is guarded (`safeLink`, below). Main's `AdCard` is the same, so the API must refuse non-http links; I could not check it. It also opens in the same tab, so it leaves the page while the advert may be playing.

### LOW 8. An editor can briefly see "Request Verified News"
- `src/features/news/TagPicker.tsx:6-18`. With `/me` delayed 2.5 s the editor's first paint shows `Request Verified News`, then it becomes `Verified News`. If `/me` fails the editor keeps Request. Tapping it in the gap posts a request, not a Verified post.

### LOW 9. Differences from the boards (below)

## Board against build, element by element
Boards open in `docs/lead/fix-b/boards/`; my pictures in `docs/lead/fix-b/shots/`.

**Write** (`Write-390`, mine `write-390-not-news.png`, `write-1440-*.png`)
- Board fourth chip is a locked "Verified News" (lock icon, grey). Build shows "Request Verified News" with a shield-check icon, for members; editors get an active "Verified News". The request chip is drawn by no board.
- Board has a "Use voice" link top right of the card, a hint line under the question ("Walk us through payday..."), a "Last free post" amber banner and "Need a starting point? Try a prompt". My run showed none of them (my stub has no hint and 5 free posts, so I cannot say which are stub effects).
- Build shows a "Fix my text" button and the "Post without my name" card; the board draws neither. Both exist on main.
- Board counter `148 / 500` sits inside the box; same in build. Board post button is green with a paper plane; same.
- Under the picker the build adds a one-line caption per tag and, for Request, a source field and an optional link field. No board draws these. Judged against the card around them: spacing, label type and field style match the other fields, and the caption is plain words. Good.

**Record ready / live / preview** (`Record-*-390/1440`, mine `record-*-*.png`)
- No record board draws a tag picker at all. The build puts "Is this news? Pick a tag so readers know." and four chips between "Listen back..." and the buttons, plus the anonymous card. On the dark panel the chips are white and readable; the selected Gossip chip is outlined magenta. The panel gets taller and the Send button moves down; the board's preview is a short stack.
- Board shows "7 free posts left"; build "5 free posts left" (stub).

**Home** (`Home-390`, `Home-390-2`, `Home-390-dark`, `Home-1440`, `HomeGuest-*`)
- No Home board draws the override picture, voice note, link button or the audio advert. Judged against the cards around them: the picture is a rounded full-width image under the message, the voice note is the mint player, the link is a secondary button ("Open the link", link icon). The advert is the dashed beige AdSlot with an "AD" badge, brand, headline, body, the player, then "Visit page >". It sits after the trending answers and before "New conversations" (y 1365, between 971 and 1646 at 390). Consistent with the neighbours. In `home-override-all-390.png` the fixed bottom bar covers the voice note in a full-page capture; that is the capture, not the page.
- Dark override: `home-override-text-390-dark.png`, `home-override-all-390-dark.png` read fine.

**Notifications** (`Notifications-390/1440`, mine `notifications-390.png`)
- Board has a settings gear at top right; build has none (not in this change).
- Board groups TODAY and EARLIER inside rounded cards; build shows one TODAY group, all unread.
- Tag notices use one amber shield icon regardless of which tag; poll notices use the dark bar-chart icon; category alert uses the yellow mic. The board draws the tag change with the same amber shield.

**Admin override** (`AdminOverride-1440`, mine `admin-override-*-1440.png`)
- Tabs Text, Voice, Image, Link: present. Board icons are message, mic, eye, link; build uses a "plus" for Image.
- Board draws the editor voice note as a player (play button, waveform, 0:14, 1x). Build draws a "Choose a recording" button and then a file name and Remove. No playback of the chosen file.
- Board label "Headline"; build "Headline (120 max)". Board toggle text "Send a push notification / To everyone in Nigeria who allows alerts"; build "Send an in-app alert". Board has three toggles on; build starts them off except "Keep the weekly theme".
- Board: sidebar counts; build: only Adverts shows its count in my stub.
- Build adds a "Picture (optional)" row; board draws none for the picture. Judged against the form: same label type, hint and button style as the voice row.

**Admin adverts** (`AdminAds-1440`, mine `admin-ads-*-1440.png`): the audio picker and picture picker are not on the board. They read like the override pickers: label, button, file name, Remove, hint ("Up to 30 seconds ... checked before approval"). Fine. The form is two columns.

**Admin news** (`AdminNews-1440`, mine `admin-news-*`): tabs show Flagged and All changes only (HIGH 2). The request row says "Source sent for Verified News" and the source name and link are pre filled in the form. The old "Open the source photo" line is only for an evidence photo.

**Newsroom / NewsPost**: not changed by this branch; not compared.

## Proved by runs
1. `npx tsc --noEmit`: exit 0, no errors. `next lint`: "No ESLint warnings or errors". `npx vitest run`: 86 files passed, 846 tests passed, 0 failed. `next build`: compiled and finished, exit 0, no warnings, on `v/fix-b` and on origin/main. Nothing failed, so there was nothing to compare against main.
2. Write and record, tags (390 and 1440, light): Not news is selected on open and Post/Send is ready. A plain post sends `{"kind":"TEXT","body":"Plain words."}`, no tag, one request on a double tap. Gossip sends `isNews:true,newsTag:"GOSSIP"`. Request Verified News with no source: Post/Send disabled and the words "Name your source to ask for Verified News."; bad link ("not a link", `ftp://...`, `http://localhost`): disabled, "Use a full link that starts with https://." (it accepts http too; the words say https); good source and link: enabled and the voice post body was `{"kind":"VOICE","clipId":"c1","isNews":true,"newsTag":"UNVERIFIED_NEWS","requestVerified":true,"newsSourceName":"NiMet","newsSourceUrl":"https://example.com/nimet"}`.
3. Editor: chips are Not news, Unverified News, Gossip, Verified News; Verified with no source disables Post. Member: chips are Not news, Unverified News, Gossip, Request Verified News; no Verified News choice. Guest write screen draws no chips.
4. A tag chosen on the record screen survives Re-record: after Re-record and a new take the pressed chip was still "Request Verified News" and the source still "NiMet".
5. Join flow by clicking (stub; sign-up and the email code were skipped by setting the session, see Not proved): guest records, sends, lands on `/join?next=%2Fq%2Fq1%2Fspeak&held=1`, Next/Skip to country, topics, profile, "Finish and post my voice". Result on both builds: `/q/q1/posted?a=new1` with the single request `{"kind":"VOICE","clipId":"c1"}`. Identical on origin/main (`main-join-*.png` against `fixb-join-*.png`). On this branch the guest preview shows Not news pressed and Send enabled; main has no picker. One tap, no tag pick.
6. Audio advert: no tap, no audio element playing and no `/play` request after 2.5 s. IMPRESSION fires once, only after it is scrolled into view (none before). One tap: one `/voice-clips/{id}/play`, one LISTEN. Three more taps (pause, play, pause): still one LISTEN, one `/play`. No advert is drawn when there is no advert, when the advert has no clip, or when the placement call fails (error). A failed play shows "Could not play this advert. Try again." and sends no LISTEN. Labelled "Ad" (badge "AD"); the play button is labelled "Play voice, 15 seconds" and speed "Playback speed 1x".
7. Override: link shows only for http(s). `javascript:`, `data:`, `ftp:`, `//evil.com`, `not a url` all gave no button. A good link has `target=_blank rel="noopener noreferrer"`, opened a second tab, and left Home in place. Picture alt "Picture from the VOICES team". The voice note is not fetched before a tap (0 `/play`). Failed play: "Could not play this voice note. Try again."; a broken picture and a failed note are in `home-override-broken-image-and-audio-390.png`.
8. Admin override: file pickers send `purpose:OVERRIDE_NOTE` (audio/mpeg, 40560 bytes, 5000 ms) and `kind:OVERRIDE_IMAGE`; a GIF gives "Use a JPEG, PNG or WebP picture."; a 6 MB PNG "That picture is too large. Use one under 5 MB."; a failed upload shows the server's words ("x", "no") in an alert. Admin adverts: choosing "Ad · audio slot in the feed" shows the audio picker; uploads send `AD_AUDIO` and `AD_CREATIVE`; a 45 s file gives "That recording is too long. 30 seconds at most."
9. Editors' queue approve and reject: bodies seen, success lines "Verified News approved. The poster is told why." and "Request declined. The poster is told why."
10. Shared screens against origin/main, same stub, same size: question page (390 and 1440), thread, voice thread, profile, Home with trending clip: pixel diff of screenshots IDENTICAL on all six. The anonymous switch: write sends `{"kind":"TEXT","body":"hi there","anonymous":true}` and record sends `{"kind":"VOICE","clipId":"c1","anonymous":true}` on both builds. A voice thread play fetched `/play` once and one listen on this branch; main logged the listen twice in that run (timing, I did not chase it).
11. Words: no em-dash or en-dash and no "Rant" in any added source line, in the built `.next` output, or in the rendered text of Home (override and advert), write, write with Request chosen, record preview, notifications, admin override and admin adverts.
12. States: Home error ("This did not load / Something went wrong ... Try again", `home-error-390.png`); offline post (`write-390-offline-error.png`): stays on write, "This did not post. You are offline...", Gossip still pressed and the text kept; notifications empty and error pictures; sideways scroll at 390: write 390/390, write with a 300 char link and a long source 390/390, record 390/390, every Home override kind 390/390.
13. Keyboard: the write picker is a `role=group` named "Tag your post"; Tab order after the text box is Not news, Unverified News, Gossip, Request Verified News (each `aria-pressed`), then Post without my name, then the card's close button. On record: the four chips, the anonymous switch, Re-record, Delete, Send.

## Read only (not run)
- The ClipPlayer `onFirstPlay` prop, `tag-choice.ts` and `AdsPage`/`OverridePage` code paths beyond what the runs touched.
- The diff of `contract/openapi.yaml` and `types.ts`.
- `tests/fixb-web.test.tsx` (it passes inside the 846).

## Not proved
- Anything in the API: real `targetType` of the new notices, that the API accepts a request tag, that requests appear under `flagged`, one LISTEN per person per day, role checks, link validation on adverts.
- The real sign-up and email-code steps of the join flow (I set the session directly after the country step and clicked the rest). They are not changed by this branch.
- Admin at 390: my 390 admin run timed out waiting for the form, so there is no picture and no scroll check. The admin boards are 1440 only.
- Light/dark of the advert, and the override in dark at 1440; the audio advert in dark.
- A real microphone, real audio output, Safari/iOS, a real CDN picture of a large size (I used a 640x360 and a 1x1).
- Admin override creation round trip: the form's Go live button was seen but I did not post it; only the uploads were observed.
- Whether the missing Write board items (Use voice, hint, banner, prompt link) are stub effects.
- Pictures named in "Do" that are not in `shots/`: admin 390; the override `Link` and `Image` tabs with a file chosen are covered by `admin-override-image-1440.png`, `admin-override-link-1440.png` and the voice file shot only.

Pictures: 100 files in `docs/lead/fix-b/shots/` (write, record, home, notifications, admin, join, and `main-join-*` for the origin/main comparison).
