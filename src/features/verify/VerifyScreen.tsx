"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, EmptyState, Icon, IconButton, Skeleton } from "@/components/vx";
import { putVerificationDocument, submitVerification } from "@/lib/api/verify";
import type { VerificationState } from "@/lib/api/verify";
import { failWords, useMyVerification, useSignedIn } from "./useVerification";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf";

/** "14 Feb 2027" on the Lagos clock. */
export function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function Card({ children, label, className = "" }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <section aria-label={label} className={`rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {children}
    </section>
  );
}

function Slot({ kind, title, hint, done, busy, onPick }: { kind: "id" | "bill"; title: string; hint: string; done: boolean; busy: boolean; onPick: (kind: "id" | "bill", f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const id = `verify-file-${kind}`;
  return (
    <li className="flex items-center gap-3 rounded-m bg-surface-2 p-3" data-testid={`slot-${kind}`}>
      <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${done ? "bg-success-bg text-success" : "bg-surface text-ink-2"}`} aria-hidden="true">
        <Icon name={done ? "circle-check" : kind === "id" ? "user-check" : "clipboard-list"} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-body-strong">{title}</b>
        <span className="text-caption text-ink-2">{done ? "Added. Choose another file to replace it." : hint}</span>
      </span>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={`${title}: choose a file`}
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(kind, f);
        }}
      />
      <Button variant="secondary" size="s" loading={busy} onClick={() => input.current?.click()}>
        {done ? "Replace" : "Choose file"}
      </Button>
    </li>
  );
}

/** The upload form: both documents, then send. */
function Documents({ state, onState }: { state: VerificationState; onState: (s: VerificationState) => void }) {
  const [busy, setBusy] = useState<"id" | "bill" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(kind: "id" | "bill", f: File) {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 10 MB. Choose a smaller photo or PDF.");
      return;
    }
    if (f.size === 0) {
      setError("That file is empty. Choose another one.");
      return;
    }
    setBusy(kind);
    try {
      onState(await putVerificationDocument(kind, f));
    } catch (e) {
      setError(failWords(e));
    } finally {
      setBusy(null);
    }
  }
  async function send() {
    setError(null);
    setBusy("send");
    try {
      onState(await submitVerification());
    } catch (e) {
      setError(failWords(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card label="Your documents" className="flex flex-col gap-3">
      <h2 className="m-0 text-body-strong">Send your documents</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <Slot kind="id" title="Government ID" hint="National ID, passport, driver's licence or voter's card. Photo or PDF." done={state.documents.id} busy={busy === "id"} onPick={(k, f) => void pick(k, f)} />
        <Slot kind="bill" title="Utility bill" hint="A recent electricity, water or similar bill with your name. Photo or PDF." done={state.documents.bill} busy={busy === "bill"} onPick={(k, f) => void pick(k, f)} />
      </ul>
      <p className="m-0 text-caption text-ink-2">JPEG, PNG, WebP, HEIC or PDF, up to 10 MB each. Your documents are private. Only the WAWU team who check them can open them, and they are deleted 90 days after the decision.</p>
      {error ? <Banner tone="danger" onClose={() => setError(null)}>{error}</Banner> : null}
      <Button size="l" block icon="send" disabled={!state.canSubmit || busy !== null} loading={busy === "send"} onClick={() => void send()}>
        Send for checking
      </Button>
    </Card>
  );
}

function Body({ state, onState }: { state: VerificationState; onState: (s: VerificationState) => void }) {
  switch (state.state) {
    case "NOT_SUBSCRIBED":
      return (
        <Card label="Subscribe first" className="flex flex-col gap-3">
          <h2 className="m-0 text-body-strong">Verification comes with a subscription</h2>
          <p className="m-0 text-body text-ink-2">Subscribe to a plan, then send your government ID and a utility bill. When the team has checked them you get a verified tick, you can suggest ideas on What Next, and you can message other people.</p>
          <Button size="l" block href="/units/buy#plans">
            See the plans
          </Button>
        </Card>
      );
    case "UNDER_REVIEW":
      return (
        <Card label="Under review" className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sun text-[color:var(--on-sun)]" aria-hidden="true">
              <Icon name="clock" size={20} />
            </span>
            <h2 className="m-0 text-body-strong">Under review</h2>
          </div>
          <p className="m-0 text-body text-ink-2">The team is checking your ID and utility bill. We will email you as soon as there is an answer. You cannot change the documents while they are being checked.</p>
        </Card>
      );
    case "VERIFIED":
      return (
        <Card label="Verified" className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-success-bg text-success" aria-hidden="true">
              <Icon name="badge-check" size={22} />
            </span>
            <h2 className="m-0 text-body-strong">You are verified</h2>
          </div>
          <p className="m-0 text-body text-ink-2">
            {state.verifiedUntil ? `Your tick shows beside your name until ${dayLabel(state.verifiedUntil)}, when your plan ends. ` : ""}
            Renew your plan to stay verified. You can suggest ideas on What Next and message other people.
          </p>
          <div>
            <Button variant="secondary" size="s" href="/units/buy#plans">
              See the plans
            </Button>
          </div>
        </Card>
      );
    case "REJECTED":
      return (
        <div className="flex flex-col gap-4">
          <Banner tone="danger" title="We could not approve your documents">
            {state.request?.reason ?? "Send them again and we will look again."}
          </Banner>
          <Documents state={state} onState={onState} />
        </div>
      );
    case "EXPIRED":
      return (
        <div className="flex flex-col gap-4">
          <Banner tone="info" title="Your request ran out">
            Nobody checked it in 90 days, so your documents were deleted. Send them again and we will look.
          </Banner>
          <Documents state={state} onState={onState} />
        </div>
      );
    case "LAPSED":
      return (
        <div className="flex flex-col gap-4">
          <Banner tone="info" title="Your verification ended">
            It ended with your subscription. Send your documents again to get your tick back.
          </Banner>
          <Documents state={state} onState={onState} />
        </div>
      );
    default:
      return <Documents state={state} onState={onState} />;
  }
}

/** /verify: where a subscriber sends their ID and utility bill, and sees how it is going (V-46). */
export function VerifyScreen() {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { state, error, reload, set } = useMyVerification(signedIn === true);
  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="-ml-2 flex items-center gap-1">
        <span className="dt:hidden">
          <IconButton icon="arrow-left" label="Back to settings" variant="ghost" onClick={() => router.push("/settings")} />
        </span>
        <h1 className="m-0 flex-1 font-display text-display-m dt:ml-2 dt:text-display-l">Get verified</h1>
      </header>
      {signedIn === null ? (
        <Skeleton variant="tile" />
      ) : signedIn === false ? (
        <EmptyState icon="badge-check" title="Sign in to get verified" body="Verification belongs to your VOICES account." action="Sign in" onAction={() => router.push("/sign-in")} />
      ) : error && !state ? (
        <Banner tone="danger" title="Could not load this" action="Try again" actionIcon="refresh-cw" onAction={reload}>
          {failWords(error)}
        </Banner>
      ) : !state ? (
        <div role="status" aria-label="Loading" className="flex flex-col gap-3">
          <Skeleton variant="tile" />
          <Skeleton variant="tile" />
        </div>
      ) : (
        <>
          {state.subscription && state.state !== "VERIFIED" ? (
            <p className="m-0 text-caption text-ink-2">{`Your plan: ${state.subscription.planName}, until ${state.subscription.endLabel}.`}</p>
          ) : null}
          <Body state={state} onState={set} />
        </>
      )}
    </div>
  );
}
