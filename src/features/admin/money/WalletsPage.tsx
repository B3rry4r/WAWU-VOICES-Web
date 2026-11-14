"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Tabs, TextField } from "@/components/vx";
import { adjustWallet, findPeople, getAdminWallet } from "@/lib/api/admin";
import type { AdminUserPage, AdminWallet } from "@/lib/api/admin";
import { slot } from "../time";
import { Card, CardTitle, ErrorLine, Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction } from "../ui";
import { kindWord, milliFromTokens, naira, signedTokens, statusWord, tokens } from "./format";
import { ConfirmPanel, StatusPill, TableFrame, Td, Th } from "./parts";

/** V-18: at most 1,000 tokens a call. The API checks it too. */
const MAX_TOKENS = 1000;

interface Done {
  auditId: string;
  txnId: string;
  balanceMilli: number;
  deltaMilli: number;
}

function AdjustForm({ wallet, onDone }: { wallet: AdminWallet; onDone: (w: AdminWallet, d: Done) => void }) {
  const [dir, setDir] = useState<"add" | "take">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const act = useAction();
  const milli = milliFromTokens(amount);
  const amountError =
    amount.trim() === ""
      ? null
      : milli === null || milli <= 0
        ? "Use a number above 0, like 50 or 12.5."
        : milli > MAX_TOKENS * 1000
          ? `At most ${MAX_TOKENS.toLocaleString("en-NG")} tokens at a time.`
          : dir === "take" && milli > wallet.balanceMilli
            ? `They only have ${tokens(wallet.balanceMilli)} tokens. A balance cannot go below zero.`
            : null;
  const delta = milli === null ? null : dir === "add" ? milli : -milli;
  const ready = delta !== null && milli! > 0 && !amountError && reason.trim().length >= 1;
  const handle = wallet.user.handle;
  const status: string = wallet.status ?? "ACTIVE"; // an older answer has no status

  async function confirm() {
    if (delta === null) return;
    const out = await act.run((key) => adjustWallet(wallet.user.id, { deltaMilli: delta, reason: reason.trim() }, key));
    if (!out) return;
    const a = out.adjustment;
    setReview(false);
    setAmount("");
    setReason("");
    onDone(out, { auditId: a?.auditId ?? "", txnId: a?.txnId ?? "", balanceMilli: a?.balanceMilli ?? out.balanceMilli, deltaMilli: a?.deltaMilli ?? delta });
  }

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Change their balance</CardTitle>
        <div className="flex items-center gap-2" data-testid="wallet-account-status">
          <span className="text-caption text-ink-2">Account</span>
          <Pill tone={status === "ACTIVE" ? "green" : "sun"}>{statusWord(status)}</Pill>
        </div>
      </div>
      {status !== "ACTIVE" ? <p className="m-0 mb-4 rounded-m bg-warning-bg px-4 py-3 text-caption text-warning">{`This account is ${statusWord(status).toLowerCase()}. You can still change their balance.`}</p> : null}
      <p className="m-0 mb-4 text-caption text-ink-2">{`For a goodwill credit or to fix a mistake. At most ${MAX_TOKENS.toLocaleString("en-NG")} tokens at a time, a reason is required, and you cannot change your own balance.`}</p>
      <div className="flex max-w-[520px] flex-col gap-4">
        <Tabs variant="segmented" block label="Direction" items={[{ id: "add", label: "Add tokens" }, { id: "take", label: "Take tokens away" }]} value={dir} onChange={(v) => { setDir(v as "add" | "take"); setReview(false); }} />
        <TextField label="Tokens" value={amount} onChange={(v) => { setAmount(v); setReview(false); }} inputMode="decimal" placeholder="50" error={amountError ?? undefined} />
        <TextField label="Reason" multiline value={reason} onChange={(v) => { setReason(v); setReview(false); }} maxLength={500} hint="Required. It is kept in the audit log with your name." />
        {review && ready ? (
          <ConfirmPanel title={dir === "add" ? `Add ${tokens(milli)} tokens to ${handle}?` : `Take ${tokens(milli)} tokens from ${handle}?`} confirmLabel={dir === "add" ? "Add the tokens" : "Take the tokens"} destructive={dir === "take"} busy={act.busy} onConfirm={() => void confirm()} onCancel={() => { setReview(false); act.clear(); }}>
            <p className="m-0">{`Their balance goes from ${tokens(wallet.balanceMilli)} to ${tokens(wallet.balanceMilli + (delta ?? 0))} tokens. Reason: ${reason.trim()}`}</p>
            <div className="mt-3">
              <ErrorLine>{act.error}</ErrorLine>
            </div>
          </ConfirmPanel>
        ) : (
          <div>
            <Button disabled={!ready} onClick={() => setReview(true)}>
              Review the change
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function WalletView({ userId }: { userId: string }) {
  const [wallet, setWallet] = useState<AdminWallet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [more, setMore] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setWallet(null);
    try {
      setWallet(await getAdminWallet(userId, { limit: 20 }));
    } catch (e) {
      setError(e as Error);
    }
  }, [userId]);
  useEffect(() => {
    setDone(null);
    void load();
  }, [load]);

  async function loadMore() {
    if (!wallet?.nextCursor) return;
    setMore(true);
    try {
      const p = await getAdminWallet(userId, { cursor: wallet.nextCursor, limit: 20 });
      setWallet({ ...wallet, ledger: [...wallet.ledger, ...p.ledger], nextCursor: p.nextCursor });
    } catch (e) {
      setError(e as Error);
    } finally {
      setMore(false);
    }
  }

  if (error) return <LoadFailed error={error} retry={load} />;
  if (!wallet) return <ListSkeleton rows={3} />;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-line bg-surface px-5 py-4">
          <Eyebrow>Person</Eyebrow>
          <div className="mt-2 font-display text-num-m text-ink">{wallet.user.handle}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface px-5 py-4">
          <Eyebrow>Balance</Eyebrow>
          <div className="mt-2 font-display text-num-l text-ink">{`${tokens(wallet.balanceMilli)} tokens`}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface px-5 py-4">
          <Eyebrow>Free posts left</Eyebrow>
          <div className="mt-2 font-display text-num-l text-ink">{wallet.freePostsRemaining}</div>
        </div>
      </div>

      {done ? (
        <SavedLine>
          {`Done. ${signedTokens(done.deltaMilli)} tokens, balance now ${tokens(done.balanceMilli)}. Audit id ${done.auditId}. Ledger transaction ${done.txnId}.`}
        </SavedLine>
      ) : null}

      <AdjustForm wallet={wallet} onDone={(w, d) => { setWallet(w); setDone(d); }} />

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-5">
          <CardTitle>Ledger</CardTitle>
        </div>
        {wallet.ledger.length === 0 ? (
          <p className="m-0 px-6 pb-5 text-body text-ink-2">Nothing in the ledger yet.</p>
        ) : (
          <>
            <TableFrame label="Ledger">
              <thead>
                <tr className="text-ink-2">
                  <Th>When</Th>
                  <Th>What</Th>
                  <Th right>Tokens</Th>
                  <Th right>Balance after</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {wallet.ledger.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <Td className="whitespace-nowrap">{slot(l.createdAt)}</Td>
                    <Td>{l.title}</Td>
                    <Td right>{l.free ? "Free" : signedTokens(l.deltaMilli)}</Td>
                    <Td right>{l.balanceAfterMilli === null ? "-" : tokens(l.balanceAfterMilli)}</Td>
                    <Td className="text-ink-2">{l.note ?? ""}</Td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            {wallet.nextCursor ? (
              <div className="p-4">
                <Button variant="secondary" loading={more} onClick={() => void loadMore()}>
                  Show more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-5">
          <CardTitle>Recent payments</CardTitle>
        </div>
        {wallet.payments.length === 0 ? (
          <p className="m-0 px-6 pb-5 text-body text-ink-2">No payments.</p>
        ) : (
          <TableFrame label="Payments">
            <thead>
              <tr className="text-ink-2">
                <Th>When</Th>
                <Th>Kind</Th>
                <Th right>Price</Th>
                <Th right>Total</Th>
                <Th>Status</Th>
                <Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {wallet.payments.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <Td className="whitespace-nowrap">{slot(p.createdAt)}</Td>
                  <Td>{`${kindWord(p.kind)}, ${p.title}`}</Td>
                  <Td right>{naira(p.amountKobo)}</Td>
                  <Td right>{naira(p.totalKobo ?? p.amountKobo)}</Td>
                  <Td>
                    <StatusPill status={p.status} />
                  </Td>
                  <Td className="break-all font-mono text-ink-2">{p.txRef}</Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </Card>
    </div>
  );
}

function WalletsBody() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<AdminUserPage["items"] | null>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    const t = term.trim().replace(/^@/, "");
    if (!t) return;
    setFinding(true);
    setFindError(null);
    try {
      const p = await findPeople(t);
      setFound(p.items);
      const exact = p.items.filter((i) => i.profile.handle === t.toLowerCase());
      if (exact.length === 1) setOpen(exact[0].profile.id);
      else setOpen(null);
    } catch {
      setFound(null);
      setFindError("We could not look that up. Try again.");
    } finally {
      setFinding(false);
    }
  }, []);

  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get("handle");
    if (h) {
      setQ(h);
      void search(h);
    }
  }, [search]);

  return (
    <div>
      <PageHead eyebrow="Admin only" title="A person's wallet" sub="Find someone by their handle to see their balance and ledger, or to change their balance." />
      <form
        className="mb-5 flex max-w-[560px] items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField label="Handle" value={q} onChange={setQ} placeholder="ngozi.e" prefix="@" />
        </div>
        <Button type="submit" icon="search" loading={finding} disabled={!q.trim()}>
          Find
        </Button>
      </form>
      <ErrorLine>{findError}</ErrorLine>
      {found && found.length === 0 ? <EmptyState icon="search" title="No one with that handle" body="Check the spelling. A part of a handle works too." /> : null}
      {found && found.length > 0 && !open ? (
        <ul className="m-0 mb-5 flex max-w-[560px] list-none flex-col overflow-hidden rounded-xl border border-line bg-surface p-0">
          {found.map((p) => (
            <li key={p.profile.id} className="border-t border-line first:border-t-0">
              <button type="button" className="flex w-full cursor-pointer items-center justify-between border-0 bg-surface px-4 py-3 text-left text-body text-ink hover:bg-surface-2" onClick={() => setOpen(p.profile.id)}>
                <span className="text-body-strong">{p.profile.handle}</span>
                <span className="text-caption text-ink-2">{p.profile.displayName ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? <WalletView userId={open} /> : null}
    </div>
  );
}

export function AdminWalletsPage() {
  return (
    <Gated page="money-wallets">
      <WalletsBody />
    </Gated>
  );
}
