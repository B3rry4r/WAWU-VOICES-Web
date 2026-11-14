"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState } from "@/components/vx";
import { listAdminPayments, reverifyPayment } from "@/lib/api/admin";
import type { AdminPayment } from "@/lib/api/admin";
import { slot } from "../time";
import { ErrorLine, Gated, ListSkeleton, LoadFailed, PageHead, SavedLine, useAction } from "../ui";
import { kindWord, naira, statusWord, tokens } from "./format";
import { ConfirmPanel, SelectField, StatusPill, TableFrame, Td, Th } from "./parts";

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  ...["SUCCEEDED", "PENDING", "INITIATED", "FAILED", "EXPIRED", "REFUNDED"].map((v) => ({ value: v, label: statusWord(v) })),
];
const KIND_OPTIONS = [
  { value: "", label: "Any kind" },
  { value: "UNITS", label: "Token pack" },
  { value: "SUBSCRIPTION", label: "Subscription" },
];

function PaymentsBody() {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<AdminPayment[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [more, setMore] = useState(false);
  const [asking, setAsking] = useState<AdminPayment | null>(null);
  const [result, setResult] = useState<{ id: string; text: string } | null>(null);
  const act = useAction();

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const p = await listAdminPayments({ status, kind, limit: 20 });
      setItems(p.items);
      setNext(p.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, [status, kind]);
  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const p = await listAdminPayments({ status, kind, cursor: next, limit: 20 });
      setItems((x) => [...(x ?? []), ...p.items]);
      setNext(p.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setMore(false);
    }
  }

  async function confirm() {
    if (!asking) return;
    const p = asking;
    const out = await act.run((key) => reverifyPayment(p.id, key));
    if (!out) return;
    setItems((x) => (x ?? []).map((r) => (r.id === out.id ? out : r)));
    setAsking(null);
    setResult({
      id: out.id,
      text:
        out.status === "SUCCEEDED"
          ? `Checked with the provider: paid.${out.balanceMilli === null ? "" : ` The person now has ${tokens(out.balanceMilli)} tokens.`}`
          : `Checked with the provider: ${statusWord(out.status).toLowerCase()}. Nothing was credited.`,
    });
  }

  return (
    <div>
      <PageHead eyebrow="Admin only" title="Payments" sub="Newest first. Each row shows what that payment was started with, never today's prices." />
      <div className="mb-4 grid max-w-[520px] grid-cols-2 gap-4">
        <SelectField id="pay-status" label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <SelectField id="pay-kind" label="Kind" value={kind} onChange={setKind} options={KIND_OPTIONS} />
      </div>
      {result ? (
        <div className="mb-4">
          <SavedLine>{result.text}</SavedLine>
        </div>
      ) : null}
      {asking ? (
        <div className="mb-4">
          <ConfirmPanel title="Ask the provider about this payment again?" confirmLabel="Check it now" busy={act.busy} onConfirm={() => void confirm()} onCancel={() => { setAsking(null); act.clear(); }}>
            <p className="m-0">
              {`${asking.user.handle}, ${kindWord(asking.kind)}, ${naira(asking.totalKobo ?? asking.amountKobo)}, reference ${asking.txRef}. If the provider says it was paid, the person gets their tokens once. If not, nothing changes.`}
            </p>
            <div className="mt-3">
              <ErrorLine>{act.error}</ErrorLine>
            </div>
          </ConfirmPanel>
        </div>
      ) : null}
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon="coins" title="No payments here" body="Change the filters to see others." />
      ) : (
        <>
          <TableFrame label="Payments">
            <thead>
              <tr className="text-ink-2">
                <Th>Person</Th>
                <Th>Kind</Th>
                <Th right>Price</Th>
                <Th right>VAT</Th>
                <Th right>Charge</Th>
                <Th right>Total</Th>
                <Th>Status</Th>
                <Th>Reference</Th>
                <Th>Time</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <Td>
                    <Link href={`/admin/money/wallets?handle=${encodeURIComponent(p.user.handle)}`} className="text-body-strong text-ink">
                      {p.user.handle}
                    </Link>
                  </Td>
                  <Td>
                    <div>{kindWord(p.kind)}</div>
                    <div className="text-ink-2">{p.title}</div>
                  </Td>
                  <Td right>{naira(p.amountKobo)}</Td>
                  <Td right>{naira(p.vatKobo)}</Td>
                  <Td right>{naira(p.chargeKobo)}</Td>
                  <Td right className="text-body-strong">
                    {naira(p.totalKobo ?? p.amountKobo)}
                  </Td>
                  <Td>
                    <StatusPill status={p.status} />
                    {p.refundNeeded ? <div className="mt-1 text-warning">{`Paid ${naira(p.overpaidKobo)} too much. Refund by hand.`}</div> : null}
                    {p.failureReason ? <div className="mt-1 text-ink-2">{p.failureReason}</div> : null}
                    {result?.id === p.id ? <div className="mt-1 text-success">Checked just now</div> : null}
                  </Td>
                  <Td className="break-all font-mono text-ink-2">{p.txRef}</Td>
                  <Td className="whitespace-nowrap">{slot(p.createdAt)}</Td>
                  <Td>
                    <Button size="s" variant="secondary" icon="refresh-cw" onClick={() => { setAsking(p); setResult(null); act.clear(); }}>
                      Re-verify
                    </Button>
                  </Td>
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

export function AdminPaymentsPage() {
  return (
    <Gated page="money-payments">
      <PaymentsBody />
    </Gated>
  );
}
