"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState } from "@/components/vx";
import { listSubscriptions } from "@/lib/api/admin";
import type { AdminSubscription } from "@/lib/api/admin";
import { Gated, ListSkeleton, LoadFailed, PageHead, Pill } from "../ui";
import { count, dayWords, naira, statusWord, tokens } from "./format";
import { SelectField, StatusPill, TableFrame, Td, Th } from "./parts";

const OPTIONS = [
  { value: "", label: "All plans" },
  ...["ACTIVE", "QUEUED", "ENDED", "CANCELLED_DELETED"].map((v) => ({ value: v, label: statusWord(v) })),
];

function SubscriptionsBody() {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminSubscription[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const p = await listSubscriptions({ status, limit: 20 });
      setItems(p.items);
      setCounts((p.counts ?? {}) as Record<string, number>);
      setNext(p.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, [status]);
  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const p = await listSubscriptions({ status, cursor: next, limit: 20 });
      setItems((x) => [...(x ?? []), ...p.items]);
      setNext(p.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setMore(false);
    }
  }

  return (
    <div>
      <PageHead eyebrow="Admin only" title="Subscriptions" sub="Current and ended plans. Read only: a plan is bought at checkout and credited every month by itself." />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-[260px]">
          <SelectField id="sub-status" label="Show" value={status} onChange={setStatus} options={OPTIONS} />
        </div>
        <div className="flex flex-wrap gap-2 pb-2">
          {Object.entries(counts).map(([k, n]) => (
            <Pill key={k}>{`${statusWord(k)}: ${count(n)}`}</Pill>
          ))}
        </div>
      </div>
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon="clipboard-list" title="No plans here" body="Plans show up once someone buys one." />
      ) : (
        <>
          <TableFrame label="Subscriptions">
            <thead>
              <tr className="text-ink-2">
                <Th>Person</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Starts</Th>
                <Th>Ends</Th>
                <Th right>Months credited</Th>
                <Th>Next credit</Th>
                <Th right>Tokens a month</Th>
                <Th right>Price</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <Td>
                    <Link href={`/admin/money/wallets?handle=${encodeURIComponent(s.user.handle)}`} className="text-body-strong text-ink">
                      {s.user.handle}
                    </Link>
                  </Td>
                  <Td>{s.plan.name}</Td>
                  <Td>
                    <StatusPill status={s.status} />
                  </Td>
                  <Td className="whitespace-nowrap">{dayWords(s.startDay)}</Td>
                  <Td className="whitespace-nowrap">{dayWords(s.endDay)}</Td>
                  <Td right>{`${s.creditedMonths} of ${s.months}`}</Td>
                  <Td className="whitespace-nowrap">{dayWords(s.nextCreditDay)}</Td>
                  <Td right>{tokens(s.monthlyMilli)}</Td>
                  <Td right>{naira(s.priceKobo)}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
          {next ? (
            <div className="mt-4">
              <Button variant="secondary" loading={more} onClick={() => void loadMore()}>
                Show more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function AdminSubscriptionsPage() {
  return (
    <Gated page="money-subscriptions">
      <SubscriptionsBody />
    </Gated>
  );
}
