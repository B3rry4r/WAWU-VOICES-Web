"use client";

import { Banner, Button, Icon } from "@/components/vx";
import type { MySubscriptions, Quote, Subscription, SubscriptionPlan } from "@/lib/api/units";
import { monthsLabel, naira, percentLabel, planDay, unitsLabel } from "./format";
import { Card, H2, Note } from "./ui";

/** Plan prices and tokens come from the API (config, seeded from the owner's price list). Nothing here is a price. */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-[10px] text-body last:border-b-0 dt:text-label">
      <dt className="min-w-0 text-ink-2">{label}</dt>
      <dd className="m-0 whitespace-nowrap text-right text-body-strong tabular-nums">{value}</dd>
    </div>
  );
}

/** What the customer pays: the price, VAT, the payment charge and the total. All four come from the API's quote. */
export function Breakdown({ quote, vatRateBps, className = "" }: { quote: Quote; vatRateBps?: number; className?: string }) {
  return (
    <dl className={`m-0 flex flex-col ${className}`} aria-label="What you pay" data-testid="breakdown">
      <Row label="Price" value={naira(quote.priceKobo)} />
      <Row label={vatRateBps === undefined ? "VAT" : `VAT (${percentLabel(vatRateBps)})`} value={naira(quote.vatKobo)} />
      <Row label="Payment charge" value={naira(quote.chargeKobo)} />
      <div className="flex justify-between gap-3 py-[10px] text-body dt:text-label">
        <dt className="whitespace-nowrap text-body-strong">Total</dt>
        <dd className="m-0 whitespace-nowrap text-right text-body-strong tabular-nums">{naira(quote.totalKobo)}</dd>
      </div>
    </dl>
  );
}

/** My subscription: the plan, the months credited so far, the next credit day and the end day. */
export function MySubscriptionCard({ mine }: { mine: MySubscriptions }) {
  const s: Subscription | null = mine.current;
  const q: Subscription | null = mine.queued;
  return (
    <section aria-labelledby="mysub-h" className="flex flex-col gap-[10px]">
      <h2 id="mysub-h" className="m-0 font-display text-display-m">
        My subscription
      </h2>
      {s ? (
        <Card label="My subscription" className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sun text-[color:var(--on-sun)]" aria-hidden="true">
              <Icon name="coins" size={20} />
            </span>
            <span className="flex flex-col">
              <b className="text-body-strong">{s.planName}</b>
              <span className="text-caption text-ink-2">{`${unitsLabel(s.monthlyMilli)} a month for ${monthsLabel(s.months)}`}</span>
            </span>
          </div>
          <dl className="m-0 flex flex-col">
            <Row label="Months credited" value={`${s.creditedMonths} of ${s.months}`} />
            <Row label="Next credit" value={s.nextCreditDay ? planDay(s.nextCreditDay) : "All months credited"} />
            <Row label="Ends" value={planDay(s.endDay)} />
          </dl>
          <Note>Tokens you do not use carry over. You can still buy token packs any time.</Note>
        </Card>
      ) : q ? null : (
        <Card label="My subscription" className="flex flex-col gap-2">
          <H2>You have no plan</H2>
          <Note>A plan gives you tokens every month. You pay once and the tokens arrive month by month.</Note>
          <div>
            <Button variant="secondary" size="s" href="/units/buy#plans">
              See the plans
            </Button>
          </div>
        </Card>
      )}
      {q ? (
        <Banner tone="info" title={`${q.planName} is next`}>
          {`It starts on ${planDay(q.startDay)}, when your current plan ends, and gives you ${unitsLabel(q.monthlyMilli)} a month for ${monthsLabel(q.months)}.`}
        </Banner>
      ) : null}
    </section>
  );
}

/** The three plans, each with what you get a month and in total, and a buy button that opens the same checkout as a pack. */
export function PlansSection({
  plans,
  vatRateBps,
  mine,
  busy,
  onBuy,
}: {
  plans: SubscriptionPlan[];
  vatRateBps?: number;
  mine: MySubscriptions | null;
  busy: string | null;
  onBuy: (plan: SubscriptionPlan) => void;
}) {
  if (plans.length === 0) return null;
  const blocked = mine ? !mine.canBuy : false;
  const until = mine?.queued?.endDay ?? mine?.current?.endDay;
  return (
    <section id="plans" aria-labelledby="plans-h" className="flex flex-col gap-[10px] scroll-mt-4">
      <h2 id="plans-h" className="m-0 font-display text-display-m">
        Plans
      </h2>
      <Note>Pay once. Your tokens arrive month by month, on the same day each month. Tokens you do not use carry over.</Note>
      {blocked && until ? <Banner tone="info">{`You already have a plan until ${planDay(until)}. You can buy another after it ends.`}</Banner> : null}
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 dt:grid-cols-3">
        {plans.map((p) => (
          <li key={p.id} className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]" data-testid={`plan-${p.slug}`}>
            <div className="flex flex-col gap-[2px]">
              <b className="text-body-strong">{p.name}</b>
              <span className="text-caption text-ink-2">{monthsLabel(p.months)}</span>
            </div>
            <span className="font-display text-num-l tabular-nums">{naira(p.priceKobo)}</span>
            <dl className="m-0 flex flex-col">
              <Row label="Each month" value={unitsLabel(p.monthlyMilli)} />
              <Row label="In total" value={unitsLabel(p.totalMilli)} />
            </dl>
            {p.quote ? <Breakdown quote={p.quote} vatRateBps={vatRateBps} /> : null}
            <Button
              variant="secondary"
              block
              loading={busy === `plan:${p.slug}`}
              disabled={blocked || (busy !== null && busy !== `plan:${p.slug}`)}
              aria-label={`Get ${p.name}`}
              onClick={() => onBuy(p)}
            >
              {p.quote ? `Pay ${naira(p.quote.totalKobo)}` : "Get this plan"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
