"use client";

import { ApiError } from "@/lib/api/client";
import { Banner, Button, IconButton } from "@/components/vx";
import { getReceipt } from "@/lib/api/units";
import { useRouter } from "next/navigation";
import { dateTimeLagos, methodLabel, naira, units } from "./format";
import { readErrorText, useLoad, useSignedIn } from "./hooks";
import { ErrorBlock, LoadingBlock, SignInNeeded } from "./ui";

export function ReceiptScreen({ paymentId }: { paymentId: string }) {
  const signedIn = useSignedIn();
  const router = useRouter();
  const { result, reload } = useLoad(() => getReceipt(paymentId), signedIn === true);
  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="-ml-2 flex items-center gap-1">
        <IconButton icon="arrow-left" label="Back to your tokens" variant="ghost" onClick={() => router.push("/units")} />
        <h1 className="m-0 flex-1 font-display text-display-m dt:text-display-l">Receipt</h1>
      </header>
      {signedIn === null ? (
        <LoadingBlock rows={1} />
      ) : !signedIn ? (
        <SignInNeeded />
      ) : result.state === "loading" ? (
        <LoadingBlock rows={2} />
      ) : result.state === "error" ? (
        result.error instanceof ApiError && (result.error.status === 404 || result.error.status === 409) ? (
          <Banner tone="info" title={result.error.status === 404 ? "We could not find that receipt" : "No receipt yet"}>
            {result.error.status === 404 ? "It is not on this account." : readErrorText(result.error)}
          </Banner>
        ) : (
          <ErrorBlock error={result.error} onRetry={reload} />
        )
      ) : (
        (() => {
          const r = result.data;
          const rows: Array<[string, string]> = [
            ["Receipt", r.reference ?? r.receiptNo],
            ["Item", r.title],
            ...(r.unitsMilli !== null ? ([["Tokens", units(r.unitsMilli)]] as Array<[string, string]>) : []),
            ["Paid", naira(r.amountKobo)],
            ...((methodLabel(r) ? [["Method", methodLabel(r) as string]] : []) as Array<[string, string]>),
            ["Time", dateTimeLagos(r.paidAt)],
            ["Account", r.buyerHandle.startsWith("@") ? r.buyerHandle : "@" + r.buyerHandle],
          ];
          return (
            <>
              <dl className="m-0 flex flex-col rounded-l bg-surface px-4 py-1 text-body shadow-[inset_0_0_0_1px_var(--line)]">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line py-[10px] last:border-b-0">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="m-0 break-all text-right text-body-strong tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <Button variant="secondary" href="/units">
                  Back to your tokens
                </Button>
              </div>
            </>
          );
        })()
      )}
    </div>
  );
}
