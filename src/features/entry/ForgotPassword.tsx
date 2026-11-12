"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Banner, Button, TextField } from "@/components/vx";
import { requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AuthSheet } from "./AuthSheet";
import { ErrorBanner, useSkipIfSignedIn } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * /forgot-password. No board draws it: it is the Sign in sheet with one field (V-44, lead default).
 * WAWU ID mails a link when the email is on a VOICES account whose email is confirmed, and answers the same either way,
 * so the confirmation never says whether an account exists. The link opens /reset-password on this site.
 */
export function ForgotPassword() {
  const skipping = useSkipIfSignedIn();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (skipping) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter the email address on your account.");
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError("Too many tries. Wait a little, then try again.");
      else setFailure(err);
    }
    setBusy(false);
  };

  return (
    <AuthSheet title="Forgot your password?" subtitle={sent ? undefined : "Enter the email on your account and we will send you a link to choose a new one."}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <Banner tone="success" title="Check your email">
            If {email.trim().toLowerCase()} is on a VOICES account, we have sent a link. It works for 1 hour and can only be used once.
          </Banner>
          <p className="m-0 text-body">No email after a few minutes? Look in spam, or check the address and ask again.</p>
          <Button size="l" block variant="secondary" onClick={() => setSent(false)}>Use a different email</Button>
          <p className="m-0 mx-auto text-center text-body pb-3"><Link href="/sign-in" className="inline-flex min-h-[44px] items-center link">Back to sign in</Link></p>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {failure ? <ErrorBanner error={failure} onRetry={() => setFailure(null)} fallback="Something went wrong on our side. Try again in a moment." /> : null}
          <TextField label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" error={error} />
          <Button size="l" block type="submit" loading={busy}>Send link</Button>
          <p className="m-0 mx-auto text-center text-body pb-3"><Link href="/sign-in" className="inline-flex min-h-[44px] items-center link">Back to sign in</Link></p>
        </form>
      )}
    </AuthSheet>
  );
}
