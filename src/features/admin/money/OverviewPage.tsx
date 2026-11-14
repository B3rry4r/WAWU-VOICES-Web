"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/vx";
import { getMoneyOverview } from "@/lib/api/admin";
import type { MoneyOverview, MoneyWindow } from "@/lib/api/admin";
import { Card, CardTitle, Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead } from "../ui";
import { count, dayWords, naira, tokens } from "./format";
import { Td, Th } from "./parts";

type Cell = (w: MoneyWindow) => string;
interface Row {
  label: string;
  hint?: string;
  cell: Cell;
  strong?: boolean;
}

/** Every cell reads one figure the API summed. Nothing here adds anything up. */
const SECTIONS: { title: string; sub?: string; rows: Row[] }[] = [
  {
    title: "Money received",
    sub: "What customers paid, split by what they bought.",
    rows: [
      { label: "Token packs", hint: "Total paid", cell: (w) => naira(w.received.packs.totalKobo) },
      { label: "Subscriptions", hint: "Total paid", cell: (w) => naira(w.received.subscriptions.totalKobo) },
      { label: "All money received", cell: (w) => naira(w.received.total.totalKobo), strong: true },
    ],
  },
  {
    title: "What it is made of",
    sub: "VAT and payment charges are paid by the customer on top. They are not WAWU revenue.",
    rows: [
      { label: "WAWU revenue (the price)", cell: (w) => naira(w.received.total.priceKobo), strong: true },
      { label: "VAT collected", cell: (w) => naira(w.received.total.vatKobo) },
      { label: "Payment charges collected", cell: (w) => naira(w.received.total.chargeKobo) },
      { label: "Paid over the total, to refund by hand", cell: (w) => naira(w.overpaidKobo) },
    ],
  },
  {
    title: "Payments",
    rows: [
      { label: "Paid", hint: "Confirmed in the window", cell: (w) => count(w.payments.paid) },
      { label: "Failed", hint: "Started in the window", cell: (w) => count(w.payments.failed) },
      { label: "Pending", hint: "Started, not paid yet", cell: (w) => count(w.payments.pending) },
      { label: "Expired", cell: (w) => count(w.payments.expired) },
      { label: "New paying people", hint: "First payment ever", cell: (w) => count(w.newPayers) },
    ],
  },
  {
    title: "Tokens",
    sub: "From the ledger.",
    rows: [
      { label: "Sold in packs", cell: (w) => tokens(w.tokens.soldMilli) },
      { label: "Credited from subscriptions", cell: (w) => tokens(w.tokens.fromPlansMilli) },
      { label: "Spent", cell: (w) => tokens(w.tokens.spentMilli) },
      { label: "Spends put back", cell: (w) => tokens(w.tokens.reversedMilli) },
      { label: "Spent after put back", cell: (w) => tokens(w.tokens.netSpentMilli), strong: true },
      { label: "Added by an admin", cell: (w) => tokens(w.tokens.adjustedInMilli) },
      { label: "Taken away by an admin", cell: (w) => tokens(w.tokens.adjustedOutMilli) },
    ],
  },
];

function Totals({ o }: { o: MoneyOverview }) {
  const windows = [o.windows.today, o.windows.last7, o.windows.last30];
  return (
    <div className="flex flex-col gap-5">
      {SECTIONS.map((s) => (
        <Card key={s.title} className="!p-0 overflow-hidden">
          <div className="px-6 pt-5">
            <CardTitle>{s.title}</CardTitle>
            {s.sub ? <p className="m-0 mb-2 text-caption text-ink-2">{s.sub}</p> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-body" aria-label={s.title}>
              <thead>
                <tr className="text-ink-2">
                  <Th>Figure</Th>
                  {windows.map((w) => (
                    <Th key={w.label} right>
                      {w.label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <Td>
                      <div className={r.strong ? "text-body-strong" : ""}>{r.label}</div>
                      {r.hint ? <div className="text-caption text-ink-2">{r.hint}</div> : null}
                    </Td>
                    {windows.map((w) => (
                      <Td key={w.label} right className={r.strong ? "text-body-strong" : ""}>
                        {r.cell(w)}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function OverviewBody() {
  const [data, setData] = useState<MoneyOverview | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getMoneyOverview());
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.windows.today;
  return (
    <div>
      <PageHead
        eyebrow="Admin only"
        title="Money"
        sub={data ? `Lagos days. Today is ${dayWords(data.lagosDay)}. The last 7 and 30 days include today.` : "Payments, VAT, charges and tokens."}
        right={
          <Button variant="secondary" icon="refresh-cw" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : !data ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-4">
            <Headline label="Received today" value={naira(t!.received.total.totalKobo)} sub={`${count(t!.payments.paid)} paid`} />
            <Headline label="WAWU revenue today" value={naira(t!.received.total.priceKobo)} sub="The price, without VAT or charges" />
            <Headline label="Tokens sold today" value={tokens(t!.tokens.soldMilli)} sub={`${tokens(t!.tokens.netSpentMilli)} spent`} />
            <Headline label="Tokens held by people" value={tokens(data.tokensHeldMilli)} sub="In every wallet now" />
          </div>
          <Totals o={data} />
        </div>
      )}
    </div>
  );
}

function Headline({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-display text-num-l text-ink">{value}</div>
      <div className="mt-1 text-caption text-ink-2">{sub}</div>
    </div>
  );
}

export function AdminMoneyOverviewPage() {
  return (
    <Gated page="money">
      <OverviewBody />
    </Gated>
  );
}
