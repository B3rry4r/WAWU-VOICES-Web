# V-install-verify-r1 (bundle J, T1, fix round 1) - verdict: MERGE

Under test: web `v/install` 6717f73 (round 0 was d2058b2). Production build (`next build`, `next start` :15041, API bases pointed at a dead local port), Chromium with user agents set; real `beforeinstallprompt` fired by Chromium on a desktop Chrome UA with a persistent profile (synthetic event only where noted). Pictures: /tmp/v-shots/install-verify-r1/ (17 states x 390/1440 x light/dark = 68; state sheets of 4 looked at for desktop Chrome offer, accepted, dismissed note, Mac Safari 17 dock, iPhone Safari, Instagram iOS; the rest checked by DOM: no horizontal scroll, copy rules, mode, in all 68).

## Findings (none High, none Medium)

Low
- N1. The Mac Safari probe can misfire on Safari 17 on macOS 12 and 13 (Popover API is in Safari 17.0 on those systems, but "Add to Dock" needs macOS 14). Those people would see steps for a menu item they do not have; "Continue" still works. Same for other Mac WebKit browsers with a Safari-like UA (e.g. DuckDuckGo for Mac) that carry Popover but cannot install. Not testable here (no WebKit); from knowledge of the platform, so treat as unverified. Rare, harmless, no fix needed for merge. Mac Chrome, Mac Edge, iPad-as-Mac and Safari 16 cannot be caught by the probe (section 2).
- N2. Builder said two tests changed. Actually three edits in tests: the head-script "marks pending" test (rewritten), the head-script test "leaves the page alone in standalone, on excluded paths, after Continue, on a desktop that cannot install" (deleted, folded into "marks nothing for any UA"), and the gate "steps aside after a moment" test (rewritten, `PROMPT_WAIT_MS` import dropped). The deleted one is moot (the script now marks nothing for any input, and the new test asserts that for 7 UAs and checks the attribute list is empty); standalone and /admin are still covered in install-gate.test.tsx and the excluded paths in install-detect.test.ts. Nothing else removed or weakened (see 3).
- N3 (note). On iPhone, iPad and in-app browsers the app paints first and the screen covers it after hydration (about 100 ms normal, about 1.7 s on throttled slow 3G with 4x CPU): a brief flash of the app, then the screen. Not a blank page; by design now.
- N4 (note, pre-existing, not this bundle). The built bundle contains the `wawuafrica.com` host in chunk 3996 (not from install code: grep of install files finds none). Round 0 had the same bundle; RULES says grep before browser runs. I ran with the stand-in bases and no call left the machine.

## 1. Round-0 findings
- M1 fixed. `data-install="pending"` is never set (boot script sets no attribute: asserted for 7 UAs; `pending` and `ig-reveal` are gone from the CSS; no 4 s failsafe). Frame-by-frame (requestAnimationFrame log of `#app-root` visibility and text length from document start), production build:
  | state | first frame visible with content | frames hidden |
  |---|---|---|
  | desktop Chrome, no offer (incognito, as an already-installed person in a tab) | 217 ms | 0 |
  | same, throttled 50 KB/s, 400 ms latency, CPU 4x | 1772 ms (that is the network, first paint) | 0 |
  | Android Chrome no offer, normal / throttled | 53 ms / 1752 ms | 0 / 0 |
  | Edge no offer, normal / throttled | 76 ms / 1751 ms | 0 / 0 |
  | Firefox, normal / throttled | 43 ms / 1708 ms | 0 / 0 |
  | iPhone Safari (screen certain), normal | visible 103 ms, then screen covers after hydration (~270 ms) | hidden behind screen by design |
  Chrome, Edge, Samsung with an offer (real event on desktop Chrome: fired at about 355 ms): screen over the app. Without an offer: no screen, app never covered, console quiet.
- L1 fixed. Press Install, outcome dismissed: localStorage empty. Outcome accepted: address kept (`/s/abc1234?x=1#h`). `appinstalled` keeps it (vitest + code). `signOut()` calls `clearKeptAddress()` (diff, vitest). Standalone "/" opens a fresh kept address once, key removed, second open stays "/".
- L2 fixed. `t = now + 9e12` refused (stays "/", key removed); 8-day-old refused; `//evil.example/x` refused.
- L4 fixed. Desktop Chrome/Edge: title "Install VOICES", lede "VOICES works best as an app. It opens in its own window."; installed state "Open VOICES from your apps"; dismissed note "use Install in your browser menu". No "home screen" or "one tap" on any computer state (checked in all desktop pictures by DOM and by eye).
- L5 fixed. `<meta name="mobile-web-app-capable" content="yes">` in server HTML of /s, /c, /, /join.

## 2. The Mac Safari probe (`typeof HTMLElement.prototype.togglePopover === "function"`, gated on os desktop AND browser safari)
Chromium here has togglePopover (all four rows below show `function`).
| browser | result |
|---|---|
| Mac Chrome (UA with Chrome/) | no screen with no offer; "prompt" (Install) with an offer |
| Mac Edge (Edg/) | no screen; "prompt" with an offer |
| Windows Edge + offer | prompt |
| Mac Safari 17 (UA Version/17.4, popover present) | dock-safari: File, Add to Dock, Add |
| Mac Safari 16 (same UA family, popover deleted) | none |
| Safari 17 UA with popover deleted | none |
| iPad reporting a Mac UA, maxTouchPoints 5, with or without popover | ios-safari (Share steps), never the Dock steps |
| iPhone Chrome | ios-other; Firefox desktop (popover present) | none |
Chrome and Edge are told apart by their own UA tokens before the probe is read (browser must be "safari"), and an iPad is caught by touch points first. Misfire: see N1 only. Playwright's touch emulation on a Mac UA gives maxTouchPoints 1 (a real iPad reports 5), as in round 0.

## 3. Tests (diff against d2058b2; against origin/main all test files are new, 434 lines added, none existing touched)
- install-detect.test.ts: import adds `clearKeptAddress`; added Mac Safari probe test, future-timestamp test, clearKeptAddress test; head-script test "marks pending" replaced by "hides nothing for anyone" (7 UAs); the standalone/excluded/dismissed head-script test deleted (N2). The existing "desktop browsers that cannot install" test is untouched and still passes (probe not supplied).
- install-gate.test.tsx: `PROMPT_WAIT_MS` import removed; "steps aside after a moment" replaced by "nothing covers the app, nothing hidden, no timer waiting (`vi.getTimerCount() === 0`), and a late offer still draws the screen"; added tests for boot script/CSS free of pending, cancelled vs accepted install, sign-out clears, appinstalled, computer wording, Safari 17 dock, Safari without probe and Firefox none.
Both changes are what V-41 (computer rule: Chrome/Edge step aside when not offered) and M1 demand. No assertion elsewhere weakened or removed; the kept-address, iOS, in-app, admin and standalone tests are untouched. Web vitest 73 files, 733 tests pass (builder had 724 at round 0).

## 4. Standalone, Continue, deep links, server HTML
- Standalone (matchMedia display-mode standalone forced in an init script, because headless Chromium does not honour CDP display-mode emulation; and `navigator.standalone` true): Android Chrome, desktop Chrome with a late offer, iPhone, Mac Safari 17 (dock app), in-app UA: no screen, app visible, not inert, in every case.
- Continue in the browser from 7 states (desktop offer, iOS Safari, iOS Chrome, Instagram iOS, Facebook Android, Mac Safari dock, Android offer) on `/s/abc1234?x=1#h`, `/c/some-slug`, `/q/q123/results?transaction_id=123&status=successful`, `/join`: 28 of 28: screen gone, URL unchanged (query and hash kept), `#app-root` visible and not inert, a reload in the same tab shows no screen.
- Server HTML of `/s/abc1234`, `/c/test`, `/`, `/join` with curl, facebookexternalhit and an iPhone Safari UA (12 fetches): no `ig-root`, no `role="dialog"`, no screen text, no `data-install`. Manifest 200.

## 5. Copy
Source grep of install files, manifest and layout: no em- or en-dash, no "wallet", no "Rant". Rendered card text of all 17 states in 4 renderings: no straight quotes, no dashes, no "wallet" or "rant", no "home screen" on any computer state (problems: []). Quotes curly.

## 6. Pictures
/tmp/v-shots/install-verify-r1/: desktop-chrome-offer, desktop-chrome-installed-accepted, desktop-chrome-dismissed-note, desktop-edge-offer, mac-chrome-no-offer, mac-safari17-dock, mac-safari16-none, firefox-none, android-chrome-offer, android-chrome-no-offer, samsung-offer, iphone-safari, ipad-as-mac, iphone-chrome, instagram-ios, instagram-android, facebook-android, each at 390 and 1440, light and dark (the "none" states show the app itself). Looked at: card centred on 1440, full width on 390, dark tokens correct, steps readable, pictures sharp. Chromium crashed twice (target crashed / timeouts) while the machine was loaded (load average about 10); the pictures were not affected (all 68 exist), the DOM checks were rerun clean.

## 7. The lead's full check (`fullcheck.sh origin/main origin/v/install bundleJ3`)
APIGEN 0, APITSC 0, APILINT 0, APIBUILD 0, **APITEST 1**, WEBSYNC 0, WEBTSC 0, WEBLINT 0, WEBTEST 0 (73 files, 733 tests), WEBBUILD 0. Backend ref origin/main 5aaec23.
APITEST: 960 passed, 3 failed, 1 skipped: `test/load/shared-address.spec.ts` "300 people behind one address" (30 s timeout, as round 0) and, new this run, two tests in `test/me/social.spec.ts` (GET /me/answers, GET /me/saved), both timeouts while the machine ran at load average about 10 with other agents' work. Each spec alone on its own database afterwards: shared-address.spec.ts 4 of 4 pass, social.spec.ts 15 of 15 pass (EXIT 0 both). So they fail under load, not on a quiet run. They are backend main, not this bundle (bundle J changes only the web repo). Lead: the 30 s timeout of the shared-address load test is load-sensitive; fullcheck on a busy shared machine will keep tripping it.

## 8. For the lead
The web repo had no `tasks/` folder on origin/main (top level: .github, content, contract, e2e, public, scripts, src, tests ...). The builder added `tasks/bundles/J-install.md` (a copy of the backend brief plus State, Known limits, History). Either move it out of the web repo or accept a new folder; the web README does not mention tasks/.

## Verdict
MERGE. All of M1, L1, L2, L4, L5 are fixed with measured evidence; no High or Medium open. L3 (iOS keeps no address) stays a known platform limit. APITEST red is the load-sensitive backend load test, to be judged separately.
