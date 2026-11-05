"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Banner, Button, Icon } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { confirmEmailVerification, isAccountBlocked, isSignedIn, startEmailVerification } from "@/lib/api/auth";
import { peekHeldPost, readDraft, saveDraft } from "@/lib/auth/entry-draft";
import { AuthSheet } from "./AuthSheet";
import { afterSession } from "./SignIn";
import { ErrorBanner, isOffline, refusalWords, sendSignedIn } from "./ui";

const RESEND_AFTER_SEC = 60;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** /join/verify: the six digit code sent by email (V-20), drawn as the Verify board's code screen. */
export function Verify() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | undefined>();
  const [life, setLife] = useState(300);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<"entry" | "checking" | "verified">("entry");
  const [wrong, setWrong] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [posting, setPosting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const d = readDraft();
    if (!d.email) {
      router.replace("/sign-in?mode=join");
      return;
    }
    setEmail(d.email);
    setSentAt(d.codeSentAt);
    setLife(d.codeLifeSec ?? 300);
    setPosting(peekHeldPost());
    // Already signed in: a code that was accepted only needs its next step again; anything else moves on.
    if (isSignedIn()) {
      if (d.verified) {
        setPhase("verified");
        void goOn();
      } else void sendSignedIn((p) => router.replace(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!email) return null;

  async function goOn() {
    setFailure(null);
    try {
      await afterSession((p) => router.replace(p));
    } catch (err) {
      setFailure(err); // only this step is retried, never the used code
    }
  }
  const code = digits.join("");
  const elapsed = sentAt ? Math.floor((now - sentAt) / 1000) : Infinity;
  const wait = Math.max(0, RESEND_AFTER_SEC - elapsed);
  const expired = elapsed > life;
  const setAt = (i: number, v: string) => setDigits((d) => d.map((x, n) => (n === i ? v : x)));

  const typeDigit = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "");
    setWrong(false);
    setNote(null);
    if (!v) return setAt(i, "");
    if (v.length > 1) return fill(v, i);
    setAt(i, v);
    if (i < 5) refs.current[i + 1]?.focus();
  };
  const fill = (text: string, from = 0) => {
    const v = text.replace(/\D/g, "").slice(0, 6 - from);
    if (!v) return;
    setDigits((d) => d.map((x, n) => (n >= from && n < from + v.length ? v[n - from] : x)));
    refs.current[Math.min(5, from + v.length)]?.focus();
  };
  const keys = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      setAt(i - 1, "");
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault();
    fill(e.clipboardData.getData("text"), i);
  };

  const verify = async () => {
    if (code.length !== 6 || phase !== "entry") return;
    setPhase("checking");
    setFailure(null);
    setNote(null);
    try {
      await confirmEmailVerification(email, code);
    } catch (err) {
      setPhase("entry");
      if (isAccountBlocked(err)) setBlocked(true);
      else if (isOffline(err)) setFailure(err);
      else if (err instanceof ApiError && err.status === 429) setFailure(err);
      else if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setWrong(true);
        setDigits(["", "", "", "", "", ""]);
        refs.current[0]?.focus();
      } else setFailure(err);
      return;
    }
    saveDraft({ verified: true });
    setPhase("verified");
    await goOn();
  };

  const resend = async () => {
    setFailure(null);
    try {
      const r = await startEmailVerification(email);
      if (r.expiresIn === 0) {
        router.push("/sign-in");
        return;
      }
      const t = Date.now();
      saveDraft({ codeSentAt: t, codeLifeSec: r.expiresIn });
      setSentAt(t);
      setLife(r.expiresIn);
      setNow(t);
      setWrong(false);
      setDigits(["", "", "", "", "", ""]);
      setNote("A new code is on its way. Check your email.");
      refs.current[0]?.focus();
    } catch (err) {
      setFailure(err);
    }
  };

  if (phase === "verified") {
    return (
      <AuthSheet title="Email verified" subtitle="Taking you in.">
        <div className="flex flex-col items-center gap-3 py-6 text-green-text" role="status">
          <Icon name="circle-check" size={56} />
          <p className="m-0 text-[15px] font-medium leading-[22px] text-ink-2">{email}</p>
          {failure ? <div className="w-full text-ink"><ErrorBanner error={failure} onRetry={goOn} fallback="Something went wrong on our side. Try again in a moment." /></div> : null}
        </div>
      </AuthSheet>
    );
  }

  const problem = wrong ? "That code is not right. Check it and try again." : expired ? "This code has expired. Send a new one." : null;
  return (
    <AuthSheet title="Enter your code" subtitle={`We sent 6 digits by email to ${email}.`}>
      <div className="flex flex-col gap-[18px]">
        {blocked ? <Banner tone="danger" title="This account cannot sign in to VOICES right now." /> : null}
        {failure ? <ErrorBanner error={failure} onRetry={() => setFailure(null)} fallback={refusalWords(failure, "Something went wrong on our side. Try again in a moment.")} /> : null}
        <fieldset className="m-0 flex flex-col gap-[10px] border-0 p-0">
          <legend className="vx-sr">Verification code</legend>
          <div className="grid grid-cols-6 gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                aria-label={`Digit ${i + 1}`}
                aria-invalid={problem ? true : undefined}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={6}
                value={d}
                autoFocus={i === 0}
                onChange={(e) => typeDigit(i, e.target.value)}
                onKeyDown={(e) => keys(i, e)}
                onPaste={(e) => paste(e, i)}
                onFocus={(e) => e.currentTarget.select()}
                className={`box-border h-[60px] w-full rounded-[14px] border-0 bg-surface text-center font-display text-[28px] leading-8 text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--focus),var(--shadow-focus)] ${problem ? "shadow-[inset_0_0_0_2px_var(--danger)]" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}
              />
            ))}
          </div>
          {problem ? <p role="alert" className="m-0 flex items-start gap-[6px] text-[14px] font-medium leading-5 text-danger"><Icon name="circle-x" size={16} className="mt-[2px] flex-none" />{problem}</p> : null}
          {note && !problem ? <p role="status" className="m-0 text-[14px] font-medium leading-5 text-ink-2">{note}</p> : null}
          <div className="flex items-center justify-between text-[14px] font-medium leading-5 text-ink-2">
            {wait > 0 ? (
              <span className="inline-flex items-center gap-[6px]"><Icon name="clock" size={16} />{`Resend code in ${clock(wait)}`}</span>
            ) : (
              <button type="button" onClick={resend} className="inline-flex min-h-[44px] items-center gap-[6px] border-0 bg-transparent p-0 font-semibold text-green-text underline"><Icon name="clock" size={16} />Resend code</button>
            )}
            <Link href="/sign-in?mode=join" className="inline-flex min-h-[44px] items-center font-semibold text-green-text no-underline">Change email</Link>
          </div>
        </fieldset>
        <Button size="l" block disabled={code.length !== 6} loading={phase === "checking"} onClick={verify}>{posting ? "Verify and post" : "Verify"}</Button>
        <p className="vx-sheet__fine pb-3">New here? Next you choose a handle and 3 topics. It takes a minute.</p>
      </div>
    </AuthSheet>
  );
}
