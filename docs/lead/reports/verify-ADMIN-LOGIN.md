VERDICT: FIX

Checked `origin/main` (5c54f5d) against 38ec048 (before the change). Two builds, `next start` on 3101 (new) and 3102 (before), Chromium, API and WAWU ID stubbed with `page.route`, anything outside localhost blocked. No live service was called.

## Findings, most severe first

### 1. HIGH - the app's ordinary sign-in now sends a person to the admin if they once opened /admin (rule L7)
Steps (390 wide): as a guest open `/admin/money` (the sign-in page shows). Do not sign in. Go to `/sign-in` and sign in with an ordinary account (no admin role).
Happened: lands on `/admin/money` and sees "This account is not an admin". The before-build lands on `/`.
Why: `SignIn.tsx` (effect, about line 71) runs `holdReturn(admin.returnTo)` as soon as the admin form shows. That puts `/admin/money` in sessionStorage (`voices-return-to`). It is only removed when the admin sign-in succeeds (`SignIn.tsx:128`). Nothing clears it when the person leaves. The ordinary `afterSession` (`SignIn.tsx:30`) then does `takeReturn() ?? "/"` and uses it. The same stale value is used by the join steps (`ProfileSetup.tsx:136`) and the email-code step, so a person who joins after glancing at /admin is also sent there. It can only point inside `/admin`, so it is not an open redirect; it is a changed destination for ordinary people. Should: the admin form must not leave a return behind (hold it only at the moment of the email detour, or clear it when the admin page is left or unmounted).

### 2. MEDIUM - a guest at an unknown /admin/... address sees "We could not find that." (rule L1)
Steps: no session, `/admin/nonexistent/deep` (also `/admin//evil.example`, `/admin/%5Cevil`, `/admin/..%2fsettings`, `/admin/javascript:alert(1)`, `/admin/%0d%0a//evil`).
Happened: the app's not-found page, no sign-in form. Real addresses (`/admin`, `/admin/money`, `/admin/money/payments?x=1`) show "VOICES admin". Should: every /admin/... address shows the admin sign-in page. Cause: the gate is in `src/app/admin/layout.tsx`; Next answers an address with no page under it with the root not-found page, outside that layout. No admin call is made and no data shows, so it is a rule gap, not a leak. Way round: type a real admin address. (`/admin/%2e%2e/settings` is normalised by the browser to `/settings`, which is the app's Settings page, correct.)

### 3. MEDIUM (from the code; the browser run reached `/join/verify` and the held return but not the code step) - the unverified-email detour does not bring an admin with no VOICES profile back to the admin (L2, L4)
Steps: admin account with no VOICES profile, email not yet verified, sign in at `/admin/money`. Browser: goes to `/join/verify`, `voices-return-to=/admin/money` is held. After the code, `Verify.tsx:60` calls `afterSession` (`SignIn.tsx:28-31`): `profileComplete:false` goes to `/join/topics`. The admin mode skips that check only for a direct sign-in (`SignIn.tsx:126-130`). An admin with a profile comes back to `/admin/money`. Should: an admin with no profile gets in by this route too. Way round: sign in again after verifying (the account is then verified and the direct path works).

### 4. LOW - the query string and hash of the address are dropped after sign-in
`/admin/money?x=1` and `/admin/money#a` land on `/admin/money` (`adminReturnFor(pathname)` has only the path). Return values given as `?next=//evil.example` or `https://evil.example` are ignored (safe).

### 5. LOW (note, not a fault of this change) - the keyboard path is plain but fine
Tab order on the admin sign-in: email, password, "Forgot password?", "Sign in". Both inputs have labels tied to them (`Email or phone number`, `Password`), with `autocomplete` username / current-password.

## Not verified (say so plainly)
- L6, "every admin page the same as before": my stub bodies (built from `contract/openapi.yaml`) make 12 of the 15 admin pages crash with "Application error" in BOTH builds, so their content could not be compared. Pool, Wallets and Prices render with the sidebar in the new build. Sign out on Prices worked (below). Treat page-by-page content equality as unproven; the diff of `AdminFrame.tsx` only changes the gate, the sign-out and the guest/not-admin branches, and the 1114 tests pass.
- The record screen (mic recording and the picked word on return) was not driven in a browser. `SignIn` without `admin` renders the same pixels and text as before (below); `useSkipIfSignedIn` has the same default.

## What I ran
| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx next lint` | no warnings or errors |
| `npx vitest run` | 102 files, 1114 tests, all pass |
| `next build`, new and before | both succeed |
| L1 guest `/admin`, `/admin/money`, `/admin/money/payments?x=1` | "VOICES admin", 0 requests of any kind, no not-found |
| L1 guest `/admin/nonexistent/deep` and 5 other odd addresses | not-found page (finding 2) |
| L2 return address, 5 shapes that reach the form (path, `?next=` value, hash, `/admin?next=/\evil`) | stay on `/admin...`, 0 external requests |
| L2 sessionStorage `//evil.example` before sign-in | overwritten by the admin return; detour keeps `/admin/money` |
| L2 admin with no profile, direct sign-in | lands on `/admin/money` |
| L3 non-admin | heading and "@tunde.a" shown, 0 `/admin` calls; "Sign in with another account": both tokens null, `/auth/logout` sent, "VOICES admin" shown, `/settings` loads as signed out; "Back to VOICES": `/` with token kept |
| L4 wrong password / unknown / locked / offline / 500 | each shows its own line ("That email, phone or password is not right", "No account found...", "This account cannot sign in...", "You are offline", "boom"), second try works |
| L4 unverified | goes to `/join/verify` (finding 3 for no-profile admins) |
| L5 `/me` 500, 502, network drop with a session | 3 `/me` calls over about 4 s, then "We could not check your access" + "Try again"; sign-in page never shown, "not an admin" never shown, token kept; Try again re-checks |
| L6 Sign out (on Prices), then Back | "VOICES admin", both tokens null; Back to `/admin/pool` shows the sign-in page, 0 admin calls after sign out |
| L7 `/sign-in`, `?mode=join`, `?next=/q/abc&held=1`, `/join/verify` at 390 and 1440 | screenshots byte-identical to the before-build, text identical |
| L7 sign-in with `?next=/q/abc`, Join toggle (390) | same in both builds |
| L7 stale admin return | differs (finding 1) |
| L8 | `noindex, nofollow` on `/admin` and `/admin/money`; robots.txt `Disallow: /admin`; no admin in sitemap |
| L9 sign-in and not-admin pages at 390 and 1440 | `scrollWidth` equals window width, no sideways scroll; labels tied; tab order sensible |
