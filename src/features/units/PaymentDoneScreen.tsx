"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, Icon, IconButton, Skeleton } from "@/components/vx";
import { getPayment, getPlans, getTiers, verifyPayment, type Payment, type PayMethod } from "@/lib/api/units";
import { clearByPayment, findByPayment, safePath, type Attempt } from "./attempt";
import { startCheckout, startErrorText } from "./checkout";
import { findPostedFor, getDraft } from "./draft";
import { dateTimeLagos, extraVoiceTitle, failureText, methodLabel, naira, packLine, units, unitsLabel } from "./format";
import { useDesktop, useSignedIn } from "./hooks";
import { postDraftForPurchase, type DraftOutcome } from "./post-draft";
import { isFinal, runReturn, type ReturnState } from "./payment-return";
import { SignInNeeded } from "./ui";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// One verify per payment per page load (React runs effects twice in development).
const verifying = new Map<string, Promise<Payment>>();
function verifyOnce(id: string, key: string, txId?: string): Promise<Payment> {
  let p = verifying.get(id);
  if (!p) {
    p = verifyPayment(id, key, txId).finally(() => setTimeout(() => verifying.delete(id), 0));
    verifying.set(id, p);
  }
  return p;
}

/** A raw provider reference (voices-<uuid>) is long: show its last 8 characters, and keep the whole value to copy. The person's own VT- reference is short already and is shown whole. */
export function shortRef(ref: string): string {
  return ref.startsWith("voices-") && ref.length > 12 ? ref.slice(-8) : ref;
}

/** The one reference a person sees and copies for a payment (lead ruling WF, 6 Nov, B-L2): VT-yymmdd-XXXXXXXX, the same on every screen. The provider reference only if the API sent none. */
export function paymentRef(p: { reference?: string | null; receiptNo?: string | null; txRef: string }): string {
  return p.reference ?? p.receiptNo ?? p.txRef;
}

function CopyRef({ full }: { full: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the full value is in the title for a long press */
    }
  }
  return (
    <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap border-0 bg-transparent p-0 text-label link" title={full} aria-label={`Copy the full reference ${full}`} onClick={() => void copy()}>
      <span className="whitespace-nowrap tabular-nums">{shortRef(full)}</span>
      <Icon name={copied ? "check" : "copy"} size={14} />
      <span className="sr-only" role="status">{copied ? "Copied" : ""}</span>
    </button>
  );
}

function Details({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="m-0 flex flex-col rounded-l bg-surface px-4 py-1 text-body shadow-[inset_0_0_0_1px_var(--line)] dt:bg-surface-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-line py-[10px] last:border-b-0">
          <dt className="flex-none text-ink-2">{k}</dt>
          <dd className="m-0 min-w-0 break-words text-right text-body-strong tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Hero({ tone, title, body, big }: { tone: "ok" | "bad" | "wait"; title: string; body?: ReactNode; big?: boolean }) {
  const circle = tone === "ok" ? "bg-mint text-green-text" : tone === "bad" ? "bg-danger-bg text-danger" : "bg-surface-2 text-ink-2";
  return (
    <div className="flex flex-col items-center gap-[10px] px-2 text-center">
      <span className={`flex items-center justify-center rounded-full ${circle} ${big ? "h-[88px] w-[88px]" : "h-[72px] w-[72px]"} dt:h-24 dt:w-24`} aria-hidden="true">
        <Icon name={tone === "ok" ? "circle-check" : tone === "bad" ? "circle-x" : "clock"} size={big ? 44 : 36} />
      </span>
      <h1 className={`m-[4px_0_0] font-display ${big ? "text-display-xl" : "text-display-l"} dt:text-display-xl`}>{title}</h1>
      {body ? <p className="m-0 text-body text-ink-2">{body}</p> : null}
    </div>
  );
}

function Shell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3 pb-6">
      <div className="flex justify-end dt:hidden">
        <span className="rounded-full bg-surface shadow-[inset_0_0_0_1px_var(--line)]"><IconButton icon="x" label="Close" variant="ghost" onClick={onClose} /></span>
      </div>
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 dt:mt-4 dt:rounded-xl dt:bg-surface dt:p-10 dt:shadow-[inset_0_0_0_1px_var(--line)]">{children}</div>
    </div>
  );
}

/** The buttons sit at the foot, apart from the details by a rule on a phone, and side by side on a desktop. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-col gap-3 border-t border-line pt-4 dt:flex-row dt:flex-wrap dt:border-0 dt:pt-0 [&>*]:dt:flex-none">{children}</div>;
}

function methodOf(p: Payment | undefined): PayMethod {
  const m = (p?.method ?? "").toLowerCase();
  return m === "bank_transfer" || m === "banktransfer" ? "banktransfer" : m === "ussd" ? "ussd" : "card";
}

export function PaymentDoneScreen() {
  const signedIn = useSignedIn();
  const params = useSearchParams();
  const router = useRouter();
  const paymentId = params.get("paymentId") ?? params.get("payment") ?? "";
  const txId = params.get("transaction_id");
  const urlStatus = params.get("status");
  const [state, setState] = useState<ReturnState>({ kind: "confirming" });
  const [draft, setDraft] = useState<DraftOutcome | null>(null);
  const [attempt, setAttempt] = useState<Attempt | undefined>();
  const attemptRef = useRef<Attempt | undefined>();
  const desktop = useDesktop();
  const [run, setRun] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const postedFor = useRef<string | null>(null);

  useEffect(() => {
    if (signedIn !== true) return undefined;
    let live = true;
    // The purchase attempt that made this payment says which draft (if any) this purchase is for. Read it before a final
    // state clears it. A page with no attempt (a refresh later, another browser) posts nothing.
    if (!attemptRef.current) {
      attemptRef.current = findByPayment(paymentId);
      setAttempt(attemptRef.current);
    }
    setState({ kind: "confirming" });
    void runReturn(
      { paymentId, transactionId: txId, urlStatus },
      { getPayment, verifyPayment: (id, key, tx) => verifyOnce(id, key, tx), sleep },
      (s) => setState(s),
      () => !live,
    );
    return () => {
      live = false;
    };
  }, [signedIn, paymentId, txId, urlStatus, run]);

  // A final state: forget the purchase attempt (the next purchase is a clean one). Success also posts a held draft.
  useEffect(() => {
    if (!isFinal(state) || !paymentId) return;
    clearByPayment(paymentId);
  }, [state, paymentId]);

  const postDraft = useCallback(
    (force = false) => {
      void postDraftForPurchase(attemptRef.current?.draftQuestionId, paymentId, { force }).then((o) => {
        setDraft(o);
        // The draft spent from the balance: read the payment again so "Your balance is now" is the real figure.
        if (o.status === "posted" && paymentId) {
          void getPayment(paymentId).then((fresh) => setState((cur) => (cur.kind === "success" ? { kind: "success", payment: fresh } : cur)), () => undefined);
        }
      });
    },
    [paymentId],
  );
  // Only a tokens purchase posts a draft, only the one it was made for, once. A token purchase never does.
  useEffect(() => {
    if (state.kind !== "success" || postedFor.current === paymentId) return;
    postedFor.current = paymentId;
    if (state.payment.kind === "UNITS") postDraft();
  }, [state, paymentId, postDraft]);

  // Another tab of this browser may post the draft first: when it records that it did, this tab shows the same banner.
  useEffect(() => {
    if (state.kind !== "success" || state.payment.kind !== "UNITS") return undefined;
    const check = () => {
      const q = findPostedFor(paymentId);
      if (q) setDraft((cur) => (cur?.status === "posted" ? cur : { status: "posted", questionId: q }));
    };
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, [state, paymentId]);

  const from = safePath(attempt?.from);
  const home = "/units";
  const close = () => router.push(from ?? home);

  async function tryAgain(p?: Payment) {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const t = await getTiers();
      const tier = p ? t.tiers.find((x) => `${x.name} pack` === p.title) : undefined;
      const planHit = p?.kind === "SUBSCRIPTION" && p.plan ? (await getPlans()).plans.find((x) => x.slug === p.plan?.slug) : undefined;
      const offer = p ? t.extraVoice.find((x) => extraVoiceTitle(x.maxSeconds) === p.title) : undefined;
      if (planHit) await startCheckout({ kind: "SUBSCRIPTION", planId: planHit.id, method: methodOf(p) }, from);
      else if (tier) await startCheckout({ kind: "UNITS", tierId: tier.id, method: methodOf(p) }, from, undefined, attemptRef.current?.draftQuestionId);
      else if (offer) await startCheckout({ kind: "EXTRA_VOICE", tokenKind: offer.kind }, from);
      else router.push("/units/buy");
    } catch (e) {
      setRetryError(startErrorText(e));
      setRetrying(false);
    }
  }

  if (signedIn === null) return <Shell onClose={close}><Skeleton variant="tile" /></Shell>;
  if (!signedIn) return <Shell onClose={close}><SignInNeeded /></Shell>;

  if (state.kind === "confirming") {
    return (
      <Shell onClose={close}>
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <Hero tone="wait" title="Confirming your payment" body="This takes a moment. Please do not pay again." />
          <Skeleton variant="tile" />
        </div>
      </Shell>
    );
  }

  if (state.kind === "slow") {
    return (
      <Shell onClose={close}>
        <Hero tone="wait" title="Still confirming" body="Your bank has not confirmed this payment yet. If you were charged, your tokens arrive as soon as it does. Please do not pay again." />
        <Actions>
          <Button icon="refresh-cw" onClick={() => setRun((n) => n + 1)}>Check again</Button>
          <Button variant="secondary" href={home}>Back to your tokens</Button>
        </Actions>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell onClose={close}>
        <Banner tone="danger" title="Could not check this payment" action="Try again" actionIcon="refresh-cw" onAction={() => setRun((n) => n + 1)}>
          {startErrorText(state.error)}
        </Banner>
      </Shell>
    );
  }

  if (state.kind === "notfound") {
    return (
      <Shell onClose={close}>
        <Hero tone="bad" title="We could not find that payment" body="It is not on this account. Check that you are signed in to the account you paid with." />
        <Actions>
          <Button href={home}>Back to your tokens</Button>
        </Actions>
      </Shell>
    );
  }

  if (state.kind === "success") {
    const p = state.payment;
    const isUnits = p.kind === "UNITS" && p.unitsMilli !== null;
    const isPlan = p.kind === "SUBSCRIPTION";
    const rows: Array<[string, string]> = [
      ["Pack", packLine(p)],
      ["Paid", naira(p.totalKobo ?? p.amountKobo)],
    ];
    const m = methodLabel(p);
    if (m) rows.push(["Method", m]);
    rows.push(["Reference", paymentRef(p)]);
    if (p.verifiedAt) rows.push(["Time", dateTimeLagos(p.verifiedAt)]);
    if (!isUnits) rows[0][0] = isPlan ? "Plan" : "Item";
    const posted = draft?.status === "posted" ? draft : null;
    const target = posted ? `/q/${posted.questionId}` : from ?? home;
    return (
      <Shell onClose={close}>
        <Hero
          tone="ok"
          big
          title={isPlan ? `${p.title} has started` : isUnits ? `${unitsLabel(p.unitsMilli as number)} added` : "Extra voice token added"}
          body={
            isPlan ? (
              <>Payment received.{p.plan ? ` Your first ${unitsLabel(p.plan.monthlyMilli)} are in your balance. The rest of your plan arrives one month at a time.` : " Your tokens arrive one month at a time."}</>
            ) : isUnits ? (
              <>Payment received.{p.balanceMilli !== null ? <> Your balance is now <b className="text-ink">{units(p.balanceMilli)} {p.balanceMilli === 1000 ? "token" : "tokens"}</b>.</> : null}</>
            ) : (
              <>Payment received. Use it on one message{p.token ? ` of up to ${p.token.maxSeconds} seconds` : ""}. It does not renew.</>
            )
          }
        />
        {posted ? (
          <Banner tone="success" title="Your answer is posted">We kept your draft and sent it the moment your tokens arrived.</Banner>
        ) : draft?.status === "offer" ? (
          <Banner tone="info" title="You have a saved draft" action="Post it now" actionIcon="send" onAction={() => postDraft(true)}>
            You wrote it a while ago, so it was not posted on its own.
          </Banner>
        ) : draft?.status === "kept" ? (
          <Banner tone="info" title="Your draft is still saved">{draft.message}</Banner>
        ) : draft?.status === "retry" ? (
          <Banner tone="warning" title="Your draft is still saved" action="Post it now" actionIcon="send" onAction={postDraft}>
            We could not post it just now.
          </Banner>
        ) : null}
        <Details rows={rows} />
        <Actions>
          <Button icon={posted ? "message-circle" : undefined} href={target}>{posted ? "Back to the conversation" : from ? "Back" : "Back to your tokens"}</Button>
          <Button variant={desktop ? "secondary" : "ghost"} icon="file-down" href={`/units/receipt/${p.id}`}><span className="dt:hidden">Download receipt</span><span className="hidden dt:inline">Receipt</span></Button>
        </Actions>
      </Shell>
    );
  }

  // The payment did not complete: failed, refunded, expired, or the amount did not match.
  const p = "payment" in state ? state.payment : undefined;
  const copy = {
    failed: { title: "Payment did not go through", body: `${failureText(p?.failureReason ?? null)} No tokens were added.` },
    refunded: { title: "This payment was refunded", body: "The money went back to you. No tokens were added." },
    expired: { title: "This payment expired", body: "You did not pay in time. No tokens were added. You can start again." },
    // lead ruling WF, 6 Nov (RW4): a cancelled checkout says so plainly, never "do not pay again".
    cancelled: { title: "Payment cancelled", body: "You were not charged." },
    mismatch: { title: "We could not confirm this payment", body: "The amount paid does not match this payment. Nothing was added." },
  }[state.kind];
  const rows: Array<[string, ReactNode]> = [];
  if (p && state.kind !== "cancelled") {
    rows.push([p.kind === "SUBSCRIPTION" ? "Plan" : "Pack", p.kind === "UNITS" ? `${p.title.replace(/ pack$/i, "")}, ${naira(p.totalKobo ?? p.amountKobo)}` : `${p.title}, ${naira(p.totalKobo ?? p.amountKobo)}`]);
    const m = methodLabel(p);
    if (m) rows.push(["Method", m]);
    rows.push(["Payment reference", <CopyRef key="ref" full={paymentRef(p)} />]);
  }
  const qd = attemptRef.current?.draftQuestionId;
  const hold = !!qd && !!getDraft(qd);
  const canSwitch = p?.kind === "UNITS" && state.kind !== "mismatch";
  return (
    <Shell onClose={close}>
      <Hero tone="bad" title={copy.title} body={copy.body} />
      {hold ? <Banner tone="info" title="Your draft is still saved">It posts as soon as your tokens arrive.</Banner> : null}
      {p && state.kind !== "refunded" && state.kind !== "cancelled" ? (
        <Banner tone="warning" title="Seeing a debit?">
          If your bank shows one for this payment, it comes back to you. Support can trace it with reference {shortRef(paymentRef(p))}.
        </Banner>
      ) : null}
      {rows.length ? <Details rows={rows} /> : null}
      {retryError ? <Banner tone="danger" onClose={() => setRetryError(null)}>{retryError}</Banner> : null}
      <Actions>
        <Button icon="refresh-cw" loading={retrying} onClick={() => void tryAgain(p)}>Try again</Button>
        {canSwitch ? (
          <Button variant="secondary" href={`/units/buy?pack=${encodeURIComponent((p?.title ?? "").replace(/ pack$/i, "").toLowerCase())}&method=banktransfer`}>Pay by transfer or USSD</Button>
        ) : null}
      </Actions>
    </Shell>
  );
}
