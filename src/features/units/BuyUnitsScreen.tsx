"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Banner, Button, Icon, IconButton, PackPicker, Tabs } from "@/components/vx";
import { getTiers, getWallet, type PayMethod, type TiersResponse, type UnitTier, type Wallet } from "@/lib/api/units";
import { safePath } from "./attempt";
import { useCheckout } from "./checkout";
import { awaitingDrafts, getDraft } from "./draft";
import { costRows, extraVoiceTitle, naira, nairaExact, smallestPack, units, unitsLabel } from "./format";
import { useLoad, useSignedIn } from "./hooks";
import { Card, ErrorBlock, Line, LoadingBlock, Note, SignInNeeded } from "./ui";

const METHODS: Array<{ id: PayMethod; label: string }> = [
  { id: "card", label: "Card" },
  { id: "banktransfer", label: "Transfer" },
  { id: "ussd", label: "USSD" },
];

function isMethod(v: string | null): v is PayMethod {
  return v === "card" || v === "banktransfer" || v === "ussd";
}

function holdsDraftFor(q: string): boolean {
  return !!getDraft(q)?.awaitingUnits;
}

function seconds(n: number): string {
  return n >= 60 && n % 60 === 0 ? `${n / 60} ${n === 60 ? "minute" : "minutes"}` : `${n} seconds`;
}

function Buy({ wallet, tiers }: { wallet: Wallet; tiers: TiersResponse }) {
  const params = useSearchParams();
  const from = safePath(params.get("from"));
  const sorted = useMemo(() => [...tiers.tiers].sort((a, b) => a.priceKobo - b.priceKobo), [tiers.tiers]);
  const wanted = params.get("pack");
  const [sel, setSel] = useState<string>(() => (sorted.find((t) => t.slug === wanted || t.name.toLowerCase() === wanted) ?? sorted[0])?.id ?? "");
  const [method, setMethod] = useState<PayMethod>(() => (isMethod(params.get("method")) ? (params.get("method") as PayMethod) : "card"));
  const [holdsDraft, setHoldsDraft] = useState(false);
  useEffect(() => setHoldsDraft(awaitingDrafts().length > 0), []);
  const qFrom = /^\/q\/([^/?]+)/.exec(from ?? "")?.[1];
  const draftQ = qFrom && holdsDraftFor(qFrom) ? qFrom : undefined;
  const checkout = useCheckout(from, draftQ);
  const tier = sorted.find((t) => t.id === sel) ?? sorted[0];
  const min = smallestPack(sorted);
  const free = wallet.freePostsRemaining + wallet.freePostsUsed;
  const offer = tiers.walletOffer;

  if (!tier) return <Banner tone="info">There are no Voice Unit packs to buy right now.</Banner>;

  return (
    <div className="flex flex-col gap-5 dt:gap-6">
      <div className="flex flex-col gap-4 dt:rounded-xl dt:bg-surface dt:p-6 dt:shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="hidden dt:block">
          <h2 className="m-0 font-display text-[28px] font-normal leading-8">Get Voice Units</h2>
          <p className="m-0 text-[15px] leading-[22px] text-ink-2">Balance: {unitsLabel(wallet.balanceMilli)}</p>
        </div>
        {holdsDraft && wallet.freePostsRemaining === 0 && min ? (
          <div className="vx-paywall" role="status">
            <Icon name="triangle-alert" size={20} />
            <span>{`You have used your ${free} free posts. Get Voice Units from ${naira(min.priceKobo)}. Your draft is saved and posts when your units arrive.`}</span>
          </div>
        ) : null}
        <PackPicker
          packs={sorted.map((t) => ({
            id: t.id,
            name: t.name,
            units: units(t.unitsMilli),
            price: naira(t.priceKobo),
            per: `${nairaExact(t.effectiveKoboPerUnit)} a unit`,
            bonus: t.bonusMilli > 0 ? `+${units(t.bonusMilli)} bonus` : undefined,
          }))}
          selected={tier.id}
          onSelect={setSel}
        />
        <div className="vx-field">
          <span className="vx-field__label">Pay with</span>
          <Tabs variant="segmented" block label="Payment method" value={method} onChange={(v) => isMethod(v) && setMethod(v)} items={METHODS} />
        </div>
        {offer ? (
          <div className="vx-offer">
            <Badge tone="sponsored">Offer</Badge>
            <span>{offer.headline}</span>
          </div>
        ) : null}
        {checkout.error ? (
          <Banner tone="danger" onClose={checkout.clearError}>
            {checkout.error}
          </Banner>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button
            size="l"
            block
            icon="lock"
            loading={checkout.busy === "pay"}
            disabled={checkout.busy !== null && checkout.busy !== "pay"}
            onClick={() => void checkout.start("pay", { kind: "UNITS", tierId: tier.id, method })}
          >
            {`Pay ${naira(tier.priceKobo)} for ${units(tier.unitsMilli)} units`}
          </Button>
          <p className="m-0 text-center text-[13px] font-medium leading-[18px] text-ink-2">
            You see the full price before you pay. Units cannot be cashed out or sent to others. Reading, listening, liking and sharing stay free.
          </p>
        </div>
      </div>

      <section aria-labelledby="xv-h" className="flex flex-col gap-3">
        <div className="flex flex-col gap-[2px] dt:flex-row dt:items-baseline dt:gap-3">
          <h2 id="xv-h" className="m-0 font-display text-[22px] font-normal leading-[27px]">
            Extra voice
          </h2>
          <p className="m-0 text-[14px] font-medium leading-5 text-ink-2">A one-off token for one longer message. The price is shown before you pay.</p>
        </div>
        <div className="grid gap-3 dt:grid-cols-2">
          {tiers.extraVoice.map((o) => (
            <div key={o.kind} className="flex items-center gap-3 rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-bold leading-[22px]">{extraVoiceTitle(o.maxSeconds)}</span>
                <span className="text-[13px] font-medium leading-[18px] text-ink-2">{`One message, up to ${seconds(o.maxSeconds)}`}</span>
              </div>
              <Button
                variant="secondary"
                size="s"
                loading={checkout.busy === o.kind}
                disabled={checkout.busy !== null && checkout.busy !== o.kind}
                onClick={() => void checkout.start(o.kind, { kind: "EXTRA_VOICE", tokenKind: o.kind })}
              >
                {naira(o.priceKobo)}
              </Button>
            </div>
          ))}
        </div>
        <Note>Tokens do not renew. Each purchase shows in your Voice Units history with a receipt.</Note>
      </section>

      <aside className="hidden flex-col gap-3 dt:flex" aria-label="What units pay for">
        <Card className="!pb-[6px]">
          <h2 className="vx-eyebrow m-0 mb-1 text-ink-2">What units pay for</h2>
          {costRows(tiers.costs).map((r) => (
            <Line key={r.label} label={r.label} value={r.value} />
          ))}
        </Card>
        <Banner tone="info">Reading, listening, liking and sharing are always free.</Banner>
      </aside>
    </div>
  );
}

export function BuyUnitsScreen() {
  const signedIn = useSignedIn();
  const router = useRouter();
  const params = useSearchParams();
  const back = safePath(params.get("from")) ?? "/units";
  const { result, reload } = useLoad(() => Promise.all([getWallet(), getTiers()]), signedIn === true);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="-ml-2 flex items-center gap-1">
        <span className="dt:hidden">
          <IconButton icon="arrow-left" label="Back to Voice Units" variant="ghost" onClick={() => router.push(back)} />
        </span>
        <h1 className="m-0 flex-1 font-display text-[24px] font-normal leading-7 dt:hidden">Get Voice Units</h1>
        {signedIn && result.state === "ready" ? (
          <span className="dt:hidden">
            <a className="vx-units" href="/units" aria-label={`${units(result.data[0].balanceMilli)} Voice Units. Open Voice Units`}>
              <span className="vx-units__coin" aria-hidden="true">
                <Icon name="coins" size={18} strokeWidth={2.25} />
              </span>
              {`${units(result.data[0].balanceMilli)} units`}
            </a>
          </span>
        ) : null}
        <div className="hidden dt:block">
          <Button variant="ghost" size="s" icon="arrow-left" href="/units">
            Voice Units
          </Button>
        </div>
      </header>
      {signedIn === null ? <LoadingBlock rows={2} /> : !signedIn ? <SignInNeeded /> : result.state === "loading" ? <LoadingBlock rows={3} /> : result.state === "error" ? <ErrorBlock error={result.error} onRetry={reload} /> : <Buy wallet={result.data[0]} tiers={result.data[1]} />}
    </div>
  );
}
