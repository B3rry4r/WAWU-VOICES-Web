VERDICT: FIX
INTERIM

Interim, written part-way through the check. Final replaces this file.

## Findings so far (most severe first)

### 1. MEDIUM - a guest at an unknown /admin/... address sees "We could not find that.", not the admin sign-in (rule L1)
Steps: no session, 1440 wide, open `/admin/nonexistent/deep` (also `/admin//evil.example`, `/admin/%5Cevil`, `/admin/..%2fsettings`, `/admin/%0d%0a//evil`).
Happened: heading "We could not find that." No sign-in form. Real pages (`/admin`, `/admin/money`, `/admin/money/payments?x=1`) correctly show "VOICES admin".
Should: every /admin/... address shows the admin sign-in page. Cause: the gate lives in `src/app/admin/layout.tsx`; an address with no page under it is answered by the root not-found page, outside that layout. No admin API call and no data leaks (calls = 0), so it is a rule gap, not a leak. Way round: type a real admin address.

### 2. MEDIUM (code reading, browser run of the code step not finished) - the unverified-email detour does not bring an admin with no VOICES profile back to the admin
Steps: admin account with no VOICES profile, email not verified, signs in at `/admin/money`. Browser run: the form goes to `/join/verify` and the return `/admin/money` is held in sessionStorage (confirmed). After the code, `Verify.tsx:60` runs `afterSession` (`SignIn.tsx:28-31`), which sends `profileComplete:false` to `/join/topics`. The new "admin" mode skips this check only for the direct sign-in (`SignIn.tsx:126-130`), not for the detour. Should: L2/L4, an admin with no profile gets into the admin.

### 3. LOW - sign-in drops the query string and hash of the address asked for
`/admin/money?x=1` and `/admin/money#a` land on `/admin/money` (`AdminSignIn.tsx` uses the path only). Same for `?next=//evil.example`: it is ignored, which is safe.

## Passed so far
- tsc 0 errors; `next lint` clean; vitest 102 files / 1114 tests pass.
- Return address: no open redirect found through path or query (`/admin/money?next=//evil.example` and `https://evil.example` stay on `/admin/money`; no request left localhost). Bad paths fall to the 404 page (finding 1), not off-site.
- L3: not-admin page shows handle, no /admin API call; "Sign in with another account" empties both tokens and shows "VOICES admin"; `/settings` loads as signed out afterwards; "Back to VOICES" goes to `/` with the token kept.
- L4: wrong password, unknown account, locked, offline and a 500 each show a clear line and the form can be submitted again; unverified goes to `/join/verify`.
- L8: `noindex, nofollow` on `/admin` and `/admin/money`; robots.txt has `Disallow: /admin`; sitemap has no admin.
- Admin with no profile signing in directly lands on `/admin/money`.
