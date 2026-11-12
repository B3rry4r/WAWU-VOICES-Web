"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Banner, Button, TextField } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { isAccountBlocked, isEmailNotVerified, isPhoneNotConfirmed, nationalPhone, register, signIn, startEmailVerification } from "@/lib/api/auth";
import { getMe } from "@/lib/api/me";
import { holdReturn, peekHeldPost, readDraft, saveDraft, takeReturn } from "@/lib/auth/entry-draft";
import { AuthSheet } from "./AuthSheet";
import { ErrorBanner, isOffline, useSkipIfSignedIn } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DIAL = "+234";

/** Where a person goes once they have a session: back to where they were, or on to the join steps if they have no profile yet. */
export async function afterSession(go: (path: string) => void): Promise<void> {
  const me = await getMe();
  go(me.profileComplete ? (takeReturn() ?? "/") : "/join/topics");
}

/** /sign-in (sign in) and /sign-in?mode=join (create the WAWU ID account). The sheet is the SignIn board; words about email follow V-20. */
export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const skipping = useSkipIfSignedIn();
  const [join, setJoin] = useState(params.get("mode") === "join");
  const [hasReturn, setHasReturn] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    const next = params.get("next");
    if (next) holdReturn(next, params.get("held") === "1" ? "post" : "page");
    setHasReturn(peekHeldPost());
    const d = readDraft();
    if (d.email) setEmail(d.email);
    if (d.fullName) setFullName(d.fullName);
  }, [params]);
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
      const national = nationalPhone(phone, DIAL);
      if (national.length === 0) bad.phone = "Enter your phone number.";
      else if (national.length < 7 || national.length > 11) bad.phone = "Enter your phone number without the +234.";
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
        await register({ fullName, email, phoneNational: nationalPhone(phone, DIAL), password, country: "Nigeria", dialCode: DIAL });
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
        const r = await startEmailVerification(email);
        saveDraft({ email: email.trim().toLowerCase(), codeSentAt: Date.now(), codeLifeSec: r.expiresIn || 300 });
        router.push("/join/verify");
        return;
      }
      await signIn(identifier, password);
      await afterSession((p) => router.replace(p));
    } catch (err) {
      if (!join && isEmailNotVerified(err)) {
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

  return (
    <AuthSheet
      title={join ? "Join VOICES" : hasReturn ? "Sign in to post" : "Sign in"}
      subtitle={hasReturn ? "Your voice is saved. It posts as soon as you are in." : undefined}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {blocked ? <Banner tone="danger" title="This account cannot sign in to VOICES right now." /> : null}
        {failure ? <ErrorBanner error={failure} onRetry={() => setFailure(null)} fallback="Something went wrong on our side. Try again in a moment." /> : null}
        {join ? (
          <>
            <TextField label="Full name" value={fullName} onChange={setFullName} autoComplete="name" error={errs.fullName} />
            <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" error={errs.email} hint="We send a 6 digit code by email. One account per email." />
            <TextField label="Phone number" prefix={DIAL} inputMode="tel" value={phone} onChange={setPhone} autoComplete="tel-national" placeholder="803 214 7720" error={errs.phone} hint="One account per number." />
          </>
        ) : (
          <>
            <TextField label="Email or phone number" value={identifier} onChange={setIdentifier} autoComplete="username" error={errs.identifier} />
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
        <p className="m-0 mx-auto text-center text-body">
          {join ? "Have an account? " : "New to VOICES? "}
          <button type="button" className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 link" onClick={() => switchTo(!join)}>{join ? "Sign in" : "Join VOICES"}</button>
        </p>
        <p className="vx-sheet__fine pb-3">Reading, listening, liking and sharing stay free without an account.</p>
      </form>
    </AuthSheet>
  );
}
