"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Rail } from "@/components/shell/ShellSlots";
import { Banner, Button, Icon, IconButton, PackPicker } from "@/components/vx";
import { getMySubscriptions, getPlans, getTiers, getWallet, type MySubscriptions, type SubscriptionPlans, type TiersResponse, type Wallet } from "@/lib/api/units";
import { tokensLabel } from "@/lib/shared/text-price";
import { safePath } from "./attempt";
import { useCheckout } from "./checkout";
import { awaitingDrafts, getDraft } from "./draft";
import { naira, smallestPack, units, unitsLabel } from "./format";
import { useLoad, useSignedIn } from "./hooks";
import { Breakdown, MySubscriptionCard, PlansSection } from "./Plans";
import { Card, ErrorBlock, Line, LoadingBlock, Note, SignInNeeded } from "./ui";
import { openedFor } from "@/features/speak/draft";

function holdsDraftFor(q: string): boolean {
  return !!getDraft(q, openedFor())?.awaitingUnits;
}

/** What things cost, as the Get tokens board draws it: text by length, then the two voice prices. */
function CostList({ costs, className = "" }: { costs: TiersResponse["costs"]; className?: string }) {
  const per = costs.textPriceChars ?? 150;
  const t1 = costs.voiceTier1Seconds ?? 30;
  const max = costs.voiceMaxSeconds ?? 60;
  const sample = Math.min(500, costs.textMaxChars);
  const sampleCost = Math.round((sample * costs.textPostMilli) / (per * 10)) * 10;
  return (
    <section aria-labelledby="cost-h" className={`flex flex-col gap-[10px] ${className}`}>
      <h2 id="cost-h" className="m-0 font-display text-display-m">
        What things cost
      </h2>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-l bg-surface p-0 shadow-[inset_0_0_0_1px_var(--line)]">
        <li className="flex items-center gap-3 border-b border-line px-4 py-[14px]">
          <Icon name="message-square" size={20} />
          <span className="flex flex-1 flex-col">
            <b className="text-body-strong">Text</b>
            <span className="text-caption text-ink-2">{`By length. ${sample} characters is ${tokensLabel(sampleCost)} tokens.`}</span>
          </span>
          <span className="text-body-strong">{`${units(costs.textPostMilli)} per ${per} characters`}</span>
        </li>
        <li className="flex items-center gap-3 border-b border-line px-4 py-[14px]">
          <Icon name="mic" size={20} />
          <span className="flex-1 text-body-strong">{`Voice, up to ${t1} seconds`}</span>
          <span className="text-body-strong">{units(costs.extraVoice30Kobo * 10)}</span>
        </li>
        <li className="flex items-center gap-3 px-4 py-[14px]">
          <Icon name="mic" size={20} />
          <span className="flex-1 text-body-strong">{`Voice, ${t1 + 1} to ${max} seconds`}</span>
          <span className="text-body-strong">{units(costs.extraVoice60Kobo * 10)}</span>
        </li>
      </ul>
      <Note>{`Charged only when your message is sent. A recording you cancel costs nothing. Up to ${costs.messagesPerDay ?? 20} messages a day; reading, listening, likes, shares and reactions never count.`}</Note>
    </section>
  );
}

function Buy({ wallet, tiers, plans, mine }: { wallet: Wallet; tiers: TiersResponse; plans: SubscriptionPlans | null; mine: MySubscriptions | null }) {
  const params = useSearchParams();
  const from = safePath(params.get("from"));
  const sorted = useMemo(() => [...tiers.tiers].sort((a, b) => a.priceKobo - b.priceKobo), [tiers.tiers]);
  const wanted = params.get("pack");
  const [sel, setSel] = useState<string>(() => (sorted.find((t) => t.slug === wanted || t.name.toLowerCase() === wanted) ?? sorted.find((t) => t.slug === "standard") ?? sorted[0])?.id ?? "");
  const [holdsDraft, setHoldsDraft] = useState(false);
  useEffect(() => setHoldsDraft(awaitingDrafts(openedFor()).length > 0), []);
  const qFrom = /^\/q\/([^/?]+)/.exec(from ?? "")?.[1];
  const draftQ = qFrom && holdsDraftFor(qFrom) ? qFrom : undefined;
  const checkout = useCheckout(from, draftQ);
  const tier = sorted.find((t) => t.id === sel) ?? sorted[0];
  const min = smallestPack(sorted);
  const free = wallet.freePostsRemaining + wallet.freePostsUsed;
  const offer = tiers.walletOffer;

  if (!tier) return <Banner tone="info">There are no token packs to buy right now.</Banner>;

  return (
    <div className="flex flex-col gap-5 dt:gap-6">
      <div className="flex flex-col gap-5 dt:rounded-xl dt:bg-surface dt:p-6 dt:shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="hidden dt:block">
          <h2 className="m-0 font-display text-display-l">Get tokens</h2>
          <p className="m-0 text-body text-ink-2">Balance: {unitsLabel(wallet.balanceMilli)}</p>
        </div>
        <p className="m-0 text-label text-ink-2">1 token is ₦1. You get exactly the tokens you pay for. VAT and the payment charge are added at checkout, and the total is shown before you pay.</p>
        {holdsDraft && wallet.freePostsRemaining === 0 && min ? (
          <div className="vx-paywall" role="status">
            <Icon name="triangle-alert" size={20} />
            <span>{`You have used your ${free} free posts. Get tokens from ${naira(min.priceKobo)}. Your draft is saved and posts when your tokens arrive.`}</span>
          </div>
        ) : null}
        <PackPicker
          priceFirst
          packs={sorted.map((t) => ({
            id: t.id,
            name: t.name,
            units: units(t.unitsMilli),
            price: naira(t.priceKobo),
          }))}
          selected={tier.id}
          onSelect={setSel}
        />
        {tier.quote ? <Breakdown quote={tier.quote} vatRateBps={tiers.vatRateBps} /> : null}
        {offer ? (
          <div className="vx-offer">
            <span>{offer.headline}</span>
          </div>
        ) : null}
        {checkout.error ? (
          <Banner tone="danger" onClose={checkout.clearError}>
            {checkout.error}
          </Banner>
        ) : null}
        <Button
          size="l"
          block
          loading={checkout.busy === "pay"}
          disabled={checkout.busy !== null && checkout.busy !== "pay"}
          onClick={() => void checkout.start("pay", { kind: "UNITS", tierId: tier.id })}
        >
          {`Pay ${naira(tier.quote?.totalKobo ?? tier.priceKobo)} for ${unitsLabel(tier.unitsMilli)}`}
        </Button>
      </div>

      {mine && (mine.current || mine.queued) ? <MySubscriptionCard mine={mine} /> : null}
      {plans ? <PlansSection plans={plans.plans} vatRateBps={plans.vatRateBps} mine={mine} busy={checkout.busy} onBuy={(p) => void checkout.start(`plan:${p.slug}`, { kind: "SUBSCRIPTION", planId: p.id })} /> : null}

      <CostList costs={tiers.costs} className="dt:hidden" />
      <Rail>
        <CostList costs={tiers.costs} />
      </Rail>
    </div>
  );
}

export function BuyUnitsScreen() {
  const signedIn = useSignedIn();
  const router = useRouter();
  const params = useSearchParams();
  const back = safePath(params.get("from")) ?? "/units";
  const { result, reload } = useLoad(
    () =>
      Promise.all([
        getWallet(),
        getTiers(),
        // The plans are a bonus on this page: if they fail to load, the packs still work.
        getPlans().catch(() => null),
        getMySubscriptions().catch(() => null),
      ]),
    signedIn === true,
  );

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="-ml-2 flex items-center gap-1">
        <span className="dt:hidden">
          <IconButton icon="arrow-left" label="Back to your tokens" variant="ghost" onClick={() => router.push(back)} />
        </span>
        <h1 className="m-0 flex-1 font-display text-display-m dt:hidden">Get tokens</h1>
        {signedIn && result.state === "ready" ? (
          <span className="dt:hidden">
            <a className="vx-units a-plain" href="/units" aria-label={`${unitsLabel(result.data[0].balanceMilli)}. Open your tokens`}>
              <span className="vx-units__coin" aria-hidden="true">
                <Icon name="coins" size={18} strokeWidth={2.25} />
              </span>
              {unitsLabel(result.data[0].balanceMilli)}
            </a>
          </span>
        ) : null}
        <div className="hidden dt:block">
          <Button variant="ghost" size="s" icon="arrow-left" href="/units">
            Tokens
          </Button>
        </div>
      </header>
      {signedIn === null ? <LoadingBlock rows={2} /> : !signedIn ? <SignInNeeded /> : result.state === "loading" ? <LoadingBlock rows={3} /> : result.state === "error" ? <ErrorBlock error={result.error} onRetry={reload} /> : <Buy wallet={result.data[0]} tiers={result.data[1]} plans={result.data[2]} mine={result.data[3]} />}
    </div>
  );
}
