# V-install-verify (bundle J, T1) - verdict: FIX (one Medium, no High)

Branch under test `v/install` d2058b2 (web). Verified on a production build (`next build`, `next start` :15021, API base pointed at a dead local port, so API calls fail by design). Pictures: /tmp/v-shots/install-verify/ (17 states x 390 light/dark and 1440 light/dark, each state's 390 and 1440 looked at; ~10 viewed one by one, the rest share the same templates and were checked by the DOM state line in the log).

## Findings

### Medium
M1. Blank page for every Chromium visitor who gets no install prompt. The boot script sets `data-install="pending"` on all Chrome, Edge, Samsung and mobile browsers, and CSS hides `#app-root` (`visibility:hidden`) until the screen decides. Measured on desktop Chrome (incognito, so no prompt): hidden for about 1.3 s after load, then revealed. Same for anyone who already installed the app and opens it in a tab, and for any person on a slow connection until hydration (CSS failsafe is 4 s). The app has no content during that time. Fix idea: show the app and put the screen over it (the screen already covers it), or only hide on iOS and in-app UAs where the screen is certain; for Chromium show the screen only when the prompt arrives.

### Low
L1. The opened address is kept when "Install VOICES" is pressed, even when the person then dismisses the browser's dialog (`keepAddress` runs before `prompt()`; outcome ignored). Evidence: after a dismissed prompt on `/q/<id>/results?transaction_id=123&status=successful`, localStorage held that address; the next standalone open of "/" went straight to it (then cleared). It stays up to 7 days and is not tied to a person: user A presses Install and cancels, user B later installs from the menu on the same device and lands on A's address (payment return query included). Not cleared on sign-out. Fix idea: keep only on `userChoice.outcome === "accepted"` (or on `appinstalled`), and clear the key on sign-out.
L2. `takeKeptAddress` accepts a timestamp in the future (`now - t` is negative), so a bad clock makes an entry never expire. Checked: `t = now + 9e12` opened `/s/future`. A 8-day-old entry and `//evil.example/x` were both refused (good).
L3. iPhone and iPad "Add to Home Screen" never keep the address (no `beforeinstallprompt`), and Safari and the installed app do not share storage anyway, so an invite or share link opened in Safari is lost on install (the 30-day invite cookie at `/go/<code>` is also separate on iOS). V-41 says the address is kept; on iOS only "Continue" keeps it. Report to the lead as a limit, not a bug.
L4. Desktop Chrome and Edge wording: the screen says "Add VOICES to your home screen" and "sits one tap away" with an "Install VOICES" button (desktop-chrome-1440-light.png). "Home screen" is wrong on a computer; use a neutral title for non-mobile.
L5. Console: Chrome warns `<meta name="apple-mobile-web-app-capable"> is deprecated. Please include <meta name="mobile-web-app-capable">`. Next's `appleWebApp.capable` emits only the old tag. Harmless, but the brief said no console errors (this is a warning, not an error). Fix idea: add `other: { "mobile-web-app-capable": "yes" }` in metadata.
L6. The in-app step pictures say "Open in Safari" (iOS) and the text "Choose Open in Safari (or Open in browser)". Instagram on iPhone words it "Open in external browser". Copy is acceptable because of the "or Open in browser" fallback; SFSafariViewController-style in-app views (UA looks like Safari) get the Safari steps though they have no Add to Home Screen. Note only.
L7. Pictures are narrow (max 190 px) and left-aligned under the step text, leaving the right half empty at 390 and at 1440. Cosmetic.

No High findings.

## 1. Installability (pass)
- `Page.getInstallabilityErrors` on a persistent Chrome context: `[]`. `Page.getAppManifest` errors: `[]`.
- `/manifest.webmanifest`: 200, `content-type: application/manifest+json`, `cache-control: public, max-age=0, must-revalidate`; id, name, short_name, start_url `/`, scope `/`, display standalone, colours #f5f5f5, four icons.
- Icons 192/512 any and maskable: 200, `image/png`, real PNG sizes (`file`: 192x192 and 512x512). Apple tags in the HTML: apple-touch-icon (180, `/apple-icon.png`), `apple-mobile-web-app-capable`, title, status bar style; theme-color light and dark.
- Console: no errors other than the expected refused API calls (stand-in port down) and the L5 warning. The "Banner not shown: preventDefault() called" line is Chrome's info about our own handler.
- Headers: `next.config.js` sets none. nginx (`infra/nginx/voices.conf`) has no CSP and no manifest or icon location: they go through `location /` to Next unchanged, safety headers apply. Nothing blocks the manifest.

## 2. States (pictures, one by one)
Each mode reported by the DOM (`data-install-mode`) with its UA:
| UA | Result |
|---|---|
| iPhone Safari | ios-safari: 3 steps with 3 pictures, Continue |
| iPad Safari (Macintosh UA, maxTouchPoints 5) | ios-safari, "at the top of Safari", iPad picture. With maxTouchPoints 1 (Playwright's touch emulation) it is a desktop Mac and no screen; a real iPad reports 5 |
| iOS Chrome, Firefox, Edge | ios-other: share steps from their menu, "Open this page in Safari instead", Copy link |
| Instagram, Facebook, WhatsApp, TikTok, X (iOS UAs), bare iOS web view | in-app: Safari steps, Copy link, Continue; app name in the lede |
| Android WebView (Instagram UA, plain `; wv)`) | in-app, Chrome wording ("another app" for the plain one) |
| Android Chrome with a real `beforeinstallprompt` | prompt: Install VOICES button, Continue |
| Desktop Chrome, Edge with prompt | prompt (see L4) |
| Desktop Firefox, desktop Safari, Android Firefox | no screen (app shown) |
| Chromium with no prompt | steps aside after about 1.2 s (see M1) |
390 light, 390 dark and 1440 light and dark have no horizontal scroll in any state (`scrollWidth <= innerWidth`). Dark pictures use the dark tokens; the desktop card is centred on 1440. Copy: grep of the install files finds no em-dash or en-dash, no "wallet", no "Rant"; quotes are curly in rendered text. Inline `style` appears only on the SVG frame and the `display: contents` wrapper.

## 3. Desktop Safari (for the lead to settle)
macOS Safari 17 and later can install a web app (File, Add to Dock), and the page ships the manifest and Apple tags. The builder gives desktop Safari no screen (mode `none-cannot-install`: browser "safari", os "desktop"); the app shows at once (desktop-safari-1440-light.png). Same for desktop Firefox. Difference from the sibling app (Who Made This): it shows a screen on desktop browsers that cannot install, while this one shows nothing there. Options: (a) leave as is (the screen is for browsers that can install here, silence for the rest); (b) give Safari 17+ on a Mac an "Add to Dock" steps screen (File, Add to Dock; version cannot be read reliably from the UA, which says 10_15_7 and a frozen Safari version token, so it would need a feature probe such as `"standalone" in navigator` absent plus `window.GestureEvent`); (c) give Firefox and old Safari a plain "this browser cannot install, use Chrome or Edge" notice like Who Made This. Not decided here.

## 4. Never stuck, never lost (Android Chrome UA, real beforeinstallprompt)
- Continue from the prompt state on `/s/abc123?x=1#h` reaches the app with the same URL, query and hash; sessionStorage flag set; same tab next page (`/join`) and reload show no screen; a new tab shows the screen again (per tab, as built). In-app Instagram: Continue on `/c/some-slug` reaches the app.
- Payment return `/q/<id>/results?transaction_id=123&status=successful`: screen shown over the same URL, Continue reveals it, the URL never changed.
- Invite: `/go/<code>` answers 307 to `/go` (no screen in the redirect). The `/go` page is not excluded (the exclusion is `/go/` with a code only), so the campaign page does get the screen; Continue reaches it. Excluded paths confirmed: `/admin` (no screen, no pending mark); `/api`, `/_next` by the same code.
- Standalone: with `display-mode: standalone` forced, "/" opens the kept address once, then "/" stays "/"; 8-day-old entry ignored; `//evil.example/x` ignored. Two people on one device: see L1 (a cancelled install leaves a stale address for the next installer).
- Crawlers and share cards: curl of `/s/abc123`, `/c/test`, `/`, `/join` (also with a facebookexternalhit UA): the server HTML has no dialog and no screen text (`ig-root`, `role=dialog` and the title absent); the pending mark is set only by the client script. JS disabled: the app is visible.

## 5. The lead's full check
First run (`fullcheck.sh origin/main v/install bundleJ`): the web ref `v/install` is already checked out in the builder's worktree `/home/user/wt/v-install`, so the web steps could not run (worktree add refused) and their EXIT lines are meaningless. API: APIGEN 0, APITSC 0, APILINT 0, APIBUILD 0, APITEST 1 (one failure, `test/load/shared-address.spec.ts` "300 people behind one address", while the machine was busy with browsers and its disk was full; 962 passed). Second run with `origin/v/install`: see the lines below.
My own web runs on d2058b2: build EXIT 0, `tsc --noEmit` EXIT 0, `next lint` EXIT 0, vitest 73 files all pass (the first run hit ENOSPC on two suites, the disk was full; rerun alone: EXIT 0, 16 tests).

Second run (`fullcheck.sh origin/main origin/v/install bundleJ2`, logs in the lead scratchpad `fullcheck-j/bundleJ2`):
APIGEN 0, APITSC 0, APILINT 0, APIBUILD 0, **APITEST 1**, WEBSYNC 0, WEBTSC 0, WEBLINT 0, WEBTEST 0 (73 files, 724 tests), WEBBUILD 0.
APITEST: 962 passed, 1 failed, 1 skipped; the failure is `test/load/shared-address.spec.ts` "300 people behind one address", "Exceeded timeout of 30000 ms", the same test in both runs. This bundle changes only the web repo and the backend ref is origin/main, so it is not caused by bundle J; it is a slow load test on this machine (disk almost full, 189 MB free, shared with other agents' runs). The lead should judge it on its own (rerun on a quiet disk) before treating "all EXIT 0" as met.

## Verdict
FIX for M1 (the blank page on Chromium without a prompt). L1 and L2 are small and fit the same fix. The rest is for the lead (desktop Safari, iOS address limit, desktop wording).
