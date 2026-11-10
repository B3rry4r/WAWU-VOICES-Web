# Bundle J (the web app asks to be installed on launch). Tier T1. Lead brief, 10 Nov 2026

Builder: one Sonnet agent. Branch `v/install` in wawu-voices-web, from origin/main (846940b or later).
Read `docs/agents/RULES.md`, DECISIONS.md V-41 (in this repo), and the web app's `src/app/layout.tsx`, `public/`
and `src/app/icon.png`, `apple-icon.png`. Resources: ports 15000-15019, Redis db 10, Postgres databases `vj_*`.

| # | What | Done when |
|---|---|---|
| J1 | Installable: a web manifest (Next 14 `app/manifest.ts` or `public/manifest.webmanifest`) with the app's name, short name, icons at 192 and 512 (any and maskable, from the brand assets), theme and background colours from the design tokens, `display: standalone`, `start_url` and `scope` `/`; the Apple tags (`apple-touch-icon`, `apple-mobile-web-app-capable`, title, status bar style) through Next's metadata. Served with the right content type under the site's headers (nginx and any CSP). | Chromium reports the app installable on a production build (`next build` + `next start`); the manifest and icons load with no console error. |
| J2 | The install screen (V-41), before anything else in a browser tab: Install through `beforeinstallprompt` where offered; iPhone and iPad Safari steps with pictures; the in-app browsers told to open in Safari or Chrome with a copy-link button; "Continue in the browser" at the foot; never in standalone (`display-mode: standalone`, `navigator.standalone`); the address opened (an invite, a share link, a payment return) kept and opened after. Curly quotes, no em-dashes, never "wallet" for tokens. | Vitest for each detection (standalone, iOS Safari, each in-app browser user agent, beforeinstallprompt) and the kept address; Playwright pictures of each state at 390 light and dark and at 1440 on a production build, each looked at. |

## Checks
Every existing check EXIT 0 on the branch (web lint, typecheck, vitest, build, `sync:shared --check`) and the lead's
`scripts/lead/fullcheck.sh`. Hand back in 6 lines with the head, the proof per browser and the pictures folder.

## State
Round 1 (fix) built on v/install. Status: awaiting re-verification. Every web check EXIT 0 (sync, tsc, lint, vitest 73 files 733 tests, build).

## Known limits
- L3: iPhone and iPad "Add to Home Screen" do not keep the opened address. Safari has no `beforeinstallprompt`, and Safari and the installed app do not share storage (nor the 30-day invite cookie at `/go/<code>`). On iOS only "Continue in the browser" keeps the address. Platform limit; no workaround is built.
- The Add to Dock screen is chosen by a feature probe (Popover API, Safari 17.0), because a Mac Safari user agent cannot tell the version.

## History
- Round 0: d2058b2. Manifest, icons, Apple tags, install screen, kept address. Verifier: FIX (M1 blank page on Chromium without an offer; L1, L2, L4, L5).
- Round 1: M1 the app is never hidden (boot script only captures the offer; failsafe and pending CSS removed); Chrome, Edge and Samsung show the screen only when the browser offers install. L1 address kept only on accepted or appinstalled, cleared on sign-out. L2 future timestamps refused. L4 and V-41 computer rule: neutral words on a computer, Safari 17+ on a Mac gets the File, Add to Dock steps (new mode `dock-safari`), Firefox and others none. L5 `mobile-web-app-capable` tag. Changed existing tests (the ruling changed their values): the "marks a tab visit pending" head-script test (now: marks nothing) and the "Chromium with no prompt steps aside after a moment" gate test (now: nothing covers the app, no timer). Pictures: /tmp/v-shots/install-fix1/ (36).
