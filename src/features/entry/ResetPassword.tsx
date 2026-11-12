"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Banner, Button, TextField } from "@/components/vx";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AuthSheet } from "./AuthSheet";
import { ErrorBanner } from "./ui";

/**
 * /reset-password?token=...&email=... : the page the reset email opens (V-44). It reads the token and the email from the link,
 * takes a new password and tells WAWU ID. It signs nobody in: a reset ends every session, so the next step is Sign in.
 * A link that is wrong, used or older than an hour (WAWU ID answers 401) says so and offers a new one.
 */
export function ResetPassword() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [dead, setDead] = useState(!token || !email);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password.length > 128) {
      setError("Use 128 characters or fewer.");
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await resetPassword({ token, email, password });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setDead(true);
      else if (err instanceof ApiError && err.status === 400 && err.explained) setError(err.message);
      else setFailure(err);
    }
    setBusy(false);
  };

  if (done) {
    return (
      <AuthSheet title="Password changed">
        <div className="flex flex-col gap-4 pb-3">
          <Banner tone="success" title="Your password is changed">You were signed out everywhere. Sign in with your new password.</Banner>
          <Button size="l" block href="/sign-in">Sign in</Button>
        </div>
      </AuthSheet>
    );
  }
  if (dead) {
    return (
      <AuthSheet title="This link does not work">
        <div className="flex flex-col gap-4 pb-3">
          <Banner tone="danger" title="The link has expired or was already used">Reset links work for 1 hour and only once. Ask for a new one.</Banner>
          <Button size="l" block href="/forgot-password">Send a new link</Button>
          <p className="m-0 mx-auto text-center text-body"><Link href="/sign-in" className="inline-flex min-h-[44px] items-center link">Back to sign in</Link></p>
        </div>
      </AuthSheet>
    );
  }
  return (
    <AuthSheet title="Choose a new password" subtitle={`For ${email}`}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4 pb-3">
        {failure ? <ErrorBanner error={failure} onRetry={() => setFailure(null)} fallback="Something went wrong on our side. Try again in a moment." /> : null}
        <TextField label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={error} hint="At least 8 characters." />
        <Button size="l" block type="submit" loading={busy}>Change password</Button>
      </form>
    </AuthSheet>
  );
}
