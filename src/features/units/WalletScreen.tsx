"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdSlot, Banner, Button, EmptyState, FreePosts, Icon, IconButton } from "@/components/vx";
import type { IconName } from "@/components/vx";
import {
  fetchStatementCsv,
  getAdPlacement,
  getHistory,
  getPublicConfig,
  getTiers,
  getWallet,
  recordAdEvent,
  type ActionCosts,
  type ExtraVoiceOffer,
  type LedgerItem,
} from "@/lib/api/units";
import { startErrorText, useCheckout } from "./checkout";
import { costRows, ledgerFigure, ledgerNote, naira, smallestPack, units, whenLong, whenShort } from "./format";
import { readErrorText, useDesktop, useLoad, useSignedIn } from "./hooks";
import { Card, ErrorBlock, H2, Line, LoadingBlock, Note, SignInNeeded } from "./ui";

const KIND_ICON: Record<LedgerItem["kind"], IconName> = {
  PURCHASE: "coins",
  SPEND_POST: "message-square",
  SPEND_REACTION: "smile-plus",
  SPEND_VOTE: "vote",
  REVERSAL: "rotate-ccw",
  ADJUSTMENT: "coins",
  REFUND: "rotate-ccw",
};

export function CostCard({ costs, title = "What things cost", className = "" }: { costs: ActionCosts; title?: string; className?: string }) {
  return (
    <Card label={title} className={`!pb-[6px] ${className}`}>
      <h2 className="m-0 mb-[6px] text-[16px] font-bold leading-[22px]">{title}</h2>
      {costRows(costs).map((r) => (
        <Line key={r.label} label={r.label} value={r.value} />
      ))}
      <Line label="Read, listen, like, share" value="Always free" tone="free" />
    </Card>
  );
}

export function ExtraVoiceCards({
  offers,
  busy,
  onBuy,
  disabled,
}: {
  offers: ExtraVoiceOffer[];
  busy: string | null;
  onBuy: (o: ExtraVoiceOffer) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {offers.map((o) => (
        <article key={o.kind} className="flex flex-col gap-[6px] rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]">
          <span className="vx-eyebrow text-ink-2">{o.label}</span>
          <span className="font-display text-[26px] font-normal leading-[28px]">{naira(o.priceKobo)}</span>
          <Note>{`One message, up to ${o.maxSeconds >= 60 ? `${o.maxSeconds / 60} ${o.maxSeconds === 60 ? "minute" : "minutes"}` : `${o.maxSeconds} seconds`}`}</Note>
          <div>
            <Button variant="secondary" size="s" loading={busy === o.kind} disabled={disabled || (busy !== null && busy !== o.kind)} onClick={() => onBuy(o)}>
              Buy token
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function HistoryRow({ item, desktop }: { item: LedgerItem; desktop: boolean }) {
  const fig = ledgerFigure(item);
  const segs = [...(desktop ? [] : [whenShort(item.createdAt)]), ...ledgerNote(item)];
  const receipt = item.hasReceipt && item.paymentId ? `/units/receipt/${item.paymentId}` : null;
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 dt:grid dt:grid-cols-[minmax(0,1fr)_150px_80px] dt:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full dt:hidden ${item.kind === "PURCHASE" ? "bg-mint text-green-text" : "bg-surface-2"}`}
          aria-hidden="true"
        >
          <Icon name={KIND_ICON[item.kind]} size={20} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold leading-[21px]">{item.title}</span>
          {segs.length > 0 || receipt ? (
            <span className="text-[13px] font-medium leading-[18px] text-ink-2">
              {segs.join(" \u00b7 ")}
              {receipt ? (
                <>
                  {segs.length > 0 ? " \u00b7 " : ""}
                  <a className="font-semibold text-green-text underline" href={receipt}>
                    Receipt
                  </a>
                </>
              ) : null}
            </span>
          ) : null}
        </span>
      </div>
      <span className="hidden text-[14px] font-medium leading-5 text-ink-2 dt:block">{whenLong(item.createdAt)}</span>
      <span className={`text-[15px] font-bold tabular-nums dt:text-right ${fig.tone === "free" || fig.tone === "plus" ? "text-green-text" : ""}`}>{fig.text}</span>
    </li>
  );
}

function History() {
  const [items, setItems] = useState<LedgerItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const first = useRef(false);
  const desktop = useDesktop();

  function load(cursor?: string) {
    setMore(true);
    getHistory(cursor).then(
      (p) => {
        setItems((prev) => (cursor && prev ? [...prev, ...p.items] : p.items));
        setNext(p.nextCursor);
        setError(null);
        setMore(false);
      },
      (e: unknown) => {
        setError(e);
        setMore(false);
      },
    );
  }
  useEffect(() => {
    if (first.current) return;
    first.current = true;
    load();
  }, []);

  async function download() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const blob = await fetchStatementCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "voice-units-statement.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setSaveError(startErrorText(e).startsWith("Could not reach") ? readErrorText(e) : "The statement could not be downloaded. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="hist-h" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hist-h" className="vx-eyebrow m-0 text-ink-2">
          History
        </h2>
        <button
          type="button"
          onClick={download}
          disabled={saving}
          className="inline-flex min-h-[44px] items-center gap-2 border-0 bg-transparent p-0 text-[14px] font-semibold text-green-text"
        >
          <Icon name="file-down" size={18} />
          {saving ? "Preparing" : "Download statement"}
        </button>
      </div>
      {saveError ? <Banner tone="danger">{saveError}</Banner> : null}
      {error && !items ? (
        <ErrorBlock error={error} onRetry={() => load()} />
      ) : items === null ? (
        <LoadingBlock rows={2} />
      ) : items.length === 0 ? (
        <EmptyState icon="coins" title="No activity yet" body="Your Voice Units, free posts and payments show here." />
      ) : (
        <>
          <div className="overflow-hidden rounded-l bg-surface shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="vx-eyebrow hidden border-b border-line px-4 py-3 text-ink-2 dt:grid dt:grid-cols-[minmax(0,1fr)_150px_80px] dt:gap-4" aria-hidden="true">
              <span>What</span>
              <span>When</span>
              <span className="text-right">Units</span>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {items.map((i) => (
                <HistoryRow key={i.id} item={i} desktop={desktop} />
              ))}
            </ul>
          </div>
          {error ? <Banner tone="danger" action="Try again" onAction={() => next && load(next)}>{readErrorText(error)}</Banner> : null}
          {next ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="s" loading={more} onClick={() => load(next)}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function BannerAd() {
  const { result } = useLoad(() => getAdPlacement("BANNER").catch(() => null));
  const ad = result.state === "ready" ? result.data : null;
  const adId = ad?.id;
  useEffect(() => {
    if (adId) void recordAdEvent(adId, "IMPRESSION");
  }, [adId]);
  if (!ad) return null;
  return (
    <div onClickCapture={() => void recordAdEvent(ad.id, "TAP")}>
      <AdSlot variant="banner" brand={ad.brand} headline={ad.headline} cta={ad.ctaLabel ?? "Open"} href={ad.linkUrl ?? undefined} />
    </div>
  );
}

function SignedOut() {
  const { result, reload } = useLoad(getPublicConfig);
  return (
    <div className="flex flex-col gap-5">
      <SignInNeeded />
      {result.state === "ready" ? <CostCard costs={result.data.costs} /> : result.state === "error" ? <ErrorBlock error={result.error} onRetry={reload} /> : <LoadingBlock rows={1} />}
    </div>
  );
}

function SignedIn() {
  const router = useRouter();
  const { result, reload } = useLoad(() => Promise.all([getWallet(), getTiers()]));
  const checkout = useCheckout("/units");

  if (result.state === "loading") return <LoadingBlock rows={3} />;
  if (result.state === "error") return <ErrorBlock error={result.error} onRetry={reload} />;
  const [wallet, tiers] = result.data;
  const min = smallestPack(tiers.tiers);
  const total = wallet.freePostsRemaining + wallet.freePostsUsed;

  return (
    <div className="flex flex-col gap-5 dt:gap-6">
      <section aria-label="Balance" className="flex flex-col gap-4 rounded-xl bg-forest p-5 text-forest-on shadow-[inset_0_0_0_1px_var(--forest-line)]">
        <div className="flex flex-col gap-4 dt:flex-row dt:items-center dt:gap-5">
          <div className="flex items-center gap-[14px] dt:flex-1">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-sun text-[color:var(--on-sun)] dt:h-16 dt:w-16" aria-hidden="true">
              <Icon name="coins" size={28} />
            </span>
            <div className="flex flex-col gap-[2px]">
              <span className="vx-eyebrow text-[color:var(--on-forest-2)]">Your balance</span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[44px] font-normal leading-[46px] tabular-nums" data-testid="balance">{units(wallet.balanceMilli)}</span>
                <span className="text-[16px] font-semibold leading-[22px]">Voice Units</span>
              </span>
            </div>
          </div>
          <Button size="l" icon="plus" className="dt:flex-none" href="/units/buy">
            Get Voice Units
          </Button>
        </div>
        <p className="m-0 text-[13px] font-medium leading-[18px] text-[color:var(--on-forest-2)]">
          {min ? `From ${naira(min.priceKobo)} for ${units(min.unitsMilli)} units. ` : ""}Units cannot be cashed out or sent to others.
        </p>
      </section>

      <Card label="Free posts" className="flex flex-col gap-[10px]">
        <H2>Free posts</H2>
        <FreePosts left={wallet.freePostsRemaining} total={total} />
        <Note className="text-[13px]">Text and voice both count. Deleting a post does not give one back. After these, each post shows its unit cost first.</Note>
      </Card>

      <CostCard costs={wallet.costs} />

      <section aria-labelledby="tok-h" className="flex flex-col gap-3">
        <div className="flex flex-col gap-[2px]">
          <h2 id="tok-h" className="m-0 font-display text-[22px] font-normal leading-[27px]">
            Extra voice
          </h2>
          <p className="m-0 text-[14px] font-medium leading-5 text-ink-2">
            Talk past {wallet.costs.freeVoiceSeconds} seconds. One token covers one message and does not renew.
          </p>
        </div>
        {checkout.error ? <Banner tone="danger" onClose={checkout.clearError}>{checkout.error}</Banner> : null}
        <ExtraVoiceCards
          offers={tiers.extraVoice}
          busy={checkout.busy}
          onBuy={(o) => void checkout.start(o.kind, { kind: "EXTRA_VOICE", tokenKind: o.kind })}
        />
        <Note>You can also buy one right when you reach the limit while recording. Your recording waits.</Note>
      </section>

      <History />
      <BannerAd />
    </div>
  );
}

export function WalletScreen() {
  const signedIn = useSignedIn();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="-ml-2 flex items-center gap-1">
        <span className="dt:hidden">
          <IconButton icon="arrow-left" label="Back to profile" variant="ghost" onClick={() => router.push("/profile")} />
        </span>
        <h1 className="m-0 flex-1 font-display text-[24px] font-normal leading-7 dt:text-[32px] dt:leading-9 dt:ml-2">Voice Units</h1>
      </header>
      {signedIn === null ? <LoadingBlock rows={2} /> : signedIn ? <SignedIn /> : <SignedOut />}
    </div>
  );
}
