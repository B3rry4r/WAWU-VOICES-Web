"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Banner, Button, PhoneField, TextField } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { isAccountBlocked, isEmailNotVerified, isPhoneNotConfirmed, register, signIn, startEmailVerification } from "@/lib/api/auth";
import { getMe } from "@/lib/api/me";
import { countryByCode, DEFAULT_COUNTRY } from "@/lib/phone/countries";
import { countryForNumber, looksLikePhone, readPhone } from "@/lib/phone/phone";
import { dropAdminReturn, holdAdminReturn, holdReturn, peekHeldPost, readDraft, saveDraft, takeAdminReturn, takeReturn } from "@/lib/auth/entry-draft";
import { AuthSheet } from "./AuthSheet";
import { ErrorBanner, isOffline, useSkipIfSignedIn } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * What sign in sends. An email, and any number typed with Nigeria chosen, go exactly as typed (what people have always typed
 * keeps working). A number with another country chosen goes in full international form (+<code><number>), unless it is unclear.
 */
export function idAsSent(identifier: string, country: string): string {
  if (!looksLikePhone(identifier) || country === DEFAULT_COUNTRY) return identifier;
  const read = readPhone(identifier, country);
  return read.ok ? read.e164 : identifier;
}

/** Where a person goes once they have a session: back to where they were, or on to the join steps if they have no profile yet. */
export async function afterSession(go: (path: string) => void): Promise<void> {
  const me = await getMe();
  go(me.profileComplete ? (takeReturn() ?? "/") : "/join/topics");
}

/**
 * The admin sign-in reuses this form as it is. `returnTo` is the admin address the person asked for; `onSignedIn` runs once they have a session.
 * No VOICES profile is needed to get in (the admin area asks the API who they are), so the join steps are not offered and nothing checks the profile here.
 */
export interface AdminSignInMode {
  returnTo: string;
  onSignedIn: () => void;
}

/** /sign-in (sign in) and /sign-in?mode=join (create the WAWU ID account). The sheet is the SignIn board; words about email follow V-20. */
export function SignIn({ admin }: { admin?: AdminSignInMode } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const skipping = useSkipIfSignedIn("/", !!admin);
  const [join, setJoin] = useState(!admin && params.get("mode") === "join");
  const [hasReturn, setHasReturn] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);
  const [idCountry, setIdCountry] = useState(DEFAULT_COUNTRY);
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    // The admin form leaves nothing behind (its return is held only for the email code detour). An ordinary form forgets any admin return left over.
    if (!admin) {
      dropAdminReturn();
      const next = params.get("next");
      if (next) holdReturn(next, params.get("held") === "1" ? "post" : "page");
    }
    setHasReturn(peekHeldPost());
    const d = readDraft();
    if (d.email) setEmail(d.email);
    if (d.fullName) setFullName(d.fullName);
  }, [params, admin]);
  if (skipping) return null;

  const switchTo = (j: boolean) => {
    setJoin(j);
    setErrs({});
    setFailure(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    setBlocked(false);
    const bad: Record<string, string> = {};
    if (join) {
      if (fullName.trim().length < 2) bad.fullName = "Tell us your name.";
      if (!EMAIL_RE.test(email.trim())) bad.email = "Enter an email address like name@example.com.";
      const read = readPhone(phone, phoneCountry);
      if (!read.ok) bad.phone = read.reason === "empty" ? "Enter your phone number." : `Enter a valid number for ${countryByCode(phoneCountry).name}, or start with + and the country code.`;
      if (password.length < 8) bad.password = "Use at least 8 characters.";
      if (!consent) bad.consent = "Confirm you are 18 or older and accept the rules.";
    } else if (needEmail) {
      if (!EMAIL_RE.test(email.trim())) bad.email = "Enter the email address on your account.";
    } else {
      if (!identifier.trim()) bad.identifier = "Enter your email or phone number.";
      if (!password) bad.password = "Enter your password.";
    }
    setErrs(bad);
    if (Object.keys(bad).length) return;
    setBusy(true);
    try {
      if (join) {
        const d = readDraft();
        const read = readPhone(phone, phoneCountry);
        if (!read.ok) { setBusy(false); return; }
        // A number typed with its own + names its own country.
        const from = countryForNumber(read.e164, phoneCountry);
        await register({ fullName, email, phoneNational: read.e164.slice(1 + from.dial.length), password, country: from.name, dialCode: `+${from.dial}` });
        saveDraft({ email: email.trim().toLowerCase(), fullName: fullName.trim(), ageConfirmed: true, countryCode: d.countryCode, codeSentAt: undefined, codeLifeSec: undefined });
        try {
          const r = await startEmailVerification(email);
          saveDraft({ codeSentAt: Date.now(), codeLifeSec: r.expiresIn || 300 });
        } catch {
          /* the code step offers "Resend code" at once when this failed */
        }
        router.push("/join/verify");
        return;
      }
      if (needEmail) {
        if (admin) holdAdminReturn(admin.returnTo);
        const r = await startEmailVerification(email);
        saveDraft({ email: email.trim().toLowerCase(), codeSentAt: Date.now(), codeLifeSec: r.expiresIn || 300 });
        router.push("/join/verify");
        return;
      }
      await signIn(idAsSent(identifier, idCountry), password);
      if (admin) {
        takeAdminReturn();
        admin.onSignedIn();
        return;
      }
      await afterSession((p) => router.replace(p));
    } catch (err) {
      if (!join && isEmailNotVerified(err)) {
        if (admin) holdAdminReturn(admin.returnTo);
        if (!identifier.includes("@")) {
          // Signed in by phone: the code goes to the account's email, so ask for it.
          setNeedEmail(true);
          setErrs({ email: "Your email is not verified yet. Enter the email on your account and we will send a code." });
          setBusy(false);
          return;
        }
        try {
          const r = await startEmailVerification(identifier);
          saveDraft({ email: identifier.trim().toLowerCase(), codeSentAt: Date.now(), codeLifeSec: r.expiresIn || 300 });
        } catch {
          saveDraft({ email: identifier.trim().toLowerCase(), codeSentAt: undefined });
        }
        router.push("/join/verify");
        return;
      }
      if (isAccountBlocked(err)) setBlocked(true);
      else if (isPhoneNotConfirmed(err)) setErrs({ identifier: "Your phone number is not confirmed yet. Confirm it, then sign in." });
      else if (isOffline(err)) setFailure(err);
      else if (err instanceof ApiError && err.status === 409) setErrs({ email: "An account with this email or phone already exists. Sign in instead." });
      else if (err instanceof ApiError && err.status === 401) setErrs({ password: "That email, phone or password is not right." });
      else if (err instanceof ApiError && err.status === 404 && err.code === "USER_NOT_IN_WAWUID") setErrs({ identifier: "No account found with this email or phone number. Join VOICES to make one." });
      else if (err instanceof ApiError && err.status === 403 && err.explained) setErrs({ identifier: err.message });
      else if (err instanceof ApiError && err.status === 400 && err.explained) setErrs({ password: err.message });
      else setFailure(err);
      setBusy(false);
    }
  };

  const form = (
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {blocked ? <Banner tone="danger" title="This account cannot sign in to VOICES right now." /> : null}
        {failure ? <ErrorBanner error={failure} onRetry={() => setFailure(null)} fallback="Something went wrong on our side. Try again in a moment." /> : null}
        {join ? (
          <>
            <TextField label="Full name" value={fullName} onChange={setFullName} autoComplete="name" error={errs.fullName} />
            <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" error={errs.email} hint="We send a 6 digit code by email. One account per email." />
            <PhoneField label="Phone number" country={phoneCountry} onCountry={setPhoneCountry} value={phone} onChange={setPhone} error={errs.phone} hint="One account per number." />
          </>
        ) : (
          <>
            <PhoneField mixed showCountry={looksLikePhone(identifier)} label="Email or phone number" country={idCountry} onCountry={setIdCountry} value={identifier} onChange={setIdentifier} autoComplete="username" error={errs.identifier} />
            {needEmail ? <TextField label="Email on your account" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" error={errs.email} /> : null}
          </>
        )}
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete={join ? "new-password" : "current-password"} error={errs.password} hint={join ? "At least 8 characters." : undefined} />
        {join ? (
          <div>
            <label className="flex cursor-pointer items-start gap-3 text-body">
              <input type="checkbox" className="mt-[2px] h-6 w-6 flex-none accent-[var(--green)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={errs.consent ? "consent-err" : undefined} />
              <span>I am 18 or older and I accept the <Link href="/settings/legal/rules" target="_blank" className="link">Community rules</Link>, <Link href="/settings/legal/terms" target="_blank" className="link">Terms</Link> and <Link href="/settings/legal/privacy" target="_blank" className="link">Privacy notice</Link>.</span>
            </label>
            {errs.consent ? <p id="consent-err" role="alert" className="m-0 mt-1 text-caption text-danger">{errs.consent}</p> : null}
          </div>
        ) : null}
        {join || needEmail ? null : <Link href="/forgot-password" className="link -mt-2 inline-flex min-h-[44px] items-center self-start">Forgot password?</Link>}
        <Button size="l" block type="submit" loading={busy}>{join || needEmail ? "Send code" : "Sign in"}</Button>
        {admin ? null : (
          <>
            <p className="m-0 mx-auto text-center text-body">
              {join ? "Have an account? " : "New to VOICES? "}
              <button type="button" className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 link" onClick={() => switchTo(!join)}>{join ? "Sign in" : "Join VOICES"}</button>
            </p>
            <p className="vx-sheet__fine pb-3">Reading, listening, liking and sharing stay free without an account.</p>
          </>
        )}
      </form>
  );
  if (admin) return form;
  return (
    <AuthSheet
      title={join ? "Join VOICES" : hasReturn ? "Sign in to post" : "Sign in"}
      subtitle={hasReturn ? "Your voice is saved. It posts as soon as you are in." : undefined}
    >
      {form}
    </AuthSheet>
  );
}
