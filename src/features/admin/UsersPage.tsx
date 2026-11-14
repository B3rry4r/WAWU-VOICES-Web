"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, TextField } from "@/components/vx";
import { listAdminUsers } from "@/lib/api/admin";
import type { AdminUserCounts, AdminUserRow } from "@/lib/api/admin";
import { VerifiedTick } from "@/features/verify/VerifiedTick";
import { dateTime } from "@/lib/format/date";
import { Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead, Pill } from "./ui";
import { count } from "./money/format";
import { SelectField, TableFrame, Td, Th } from "./money/parts";

const PAGE = 25;

const STATUS_WORDS: Record<string, string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
  DELETION_PENDING: "Leaving soon",
  DELETED: "Deleted",
};
const STATUS_OPTIONS = [{ value: "", label: "Any status" }, ...Object.entries(STATUS_WORDS).map(([value, label]) => ({ value, label }))];

function StatusChip({ status }: { status: string }) {
  const tone = status === "ACTIVE" ? "green" : status === "SUSPENDED" ? "sun" : status === "BANNED" ? "red" : "neutral";
  return <Pill tone={tone}>{STATUS_WORDS[status] ?? status}</Pill>;
}

function Figure({ label, value, testId }: { label: string; value: number | null; testId: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-5 py-4" data-testid={testId}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-display text-num-l text-ink [overflow-wrap:anywhere]">{value === null ? "-" : count(value)}</div>
    </div>
  );
}

function UsersBody() {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<AdminUserRow[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [counts, setCounts] = useState<AdminUserCounts | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [more, setMore] = useState(false);
  // Only the newest request may fill the screen: an older answer that arrives late is dropped.
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    setItems(null);
    try {
      const p = await listAdminUsers({ q, status, limit: PAGE });
      if (mine !== seq.current) return;
      setItems(p.items);
      setNext(p.nextCursor ?? null);
      setTotal(p.total);
      setCounts(p.counts);
    } catch (e) {
      if (mine === seq.current) setError(e as Error);
    }
  }, [q, status]);
  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!next) return;
    const mine = seq.current;
    setMore(true);
    try {
      const p = await listAdminUsers({ q, status, cursor: next, limit: PAGE });
      if (mine !== seq.current) return;
      setItems((x) => [...(x ?? []), ...p.items]);
      setNext(p.nextCursor ?? null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setMore(false);
    }
  }

  const searching = q !== "" || status !== "";

  return (
    <div>
      <PageHead eyebrow="Admin only" title="Users" sub="Everyone who has registered, newest first." />
      <div className="mb-5 grid grid-cols-1 gap-3 dt:grid-cols-3 dt:gap-4">
        <Figure label="All users" value={counts?.total ?? null} testId="users-all" />
        <Figure label="Joined today" value={counts?.today ?? null} testId="users-today" />
        <Figure label="Verified" value={counts?.verified ?? null} testId="users-verified" />
      </div>
      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft.trim());
        }}
      >
        <div className="min-w-[240px] max-w-[420px] flex-1">
          <TextField label="Search" value={draft} onChange={setDraft} placeholder="Handle, name, whole email or phone" />
        </div>
        <div className="w-[200px]">
          <SelectField id="users-status" label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
        <Button type="submit" icon="search" disabled={draft.trim() === q}>
          Search
        </Button>
        {searching ? (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft("");
              setQ("");
              setStatus("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        searching ? (
          <EmptyState icon="search" title="No one found" body="Check the spelling, or clear the search. An email only matches when it is written in full." />
        ) : (
          <EmptyState icon="user" title="No one has registered yet" body="People show up here as soon as they sign up." />
        )
      ) : (
        <>
          {searching && total !== null ? (
            <p className="m-0 mb-3 text-caption text-ink-2" data-testid="users-match">{`${count(total)} ${total === 1 ? "person matches" : "people match"}`}</p>
          ) : null}
          <TableFrame label="Users">
            <thead>
              <tr className="text-ink-2">
                <Th>Person</Th>
                <Th>Email</Th>
                <Th>State</Th>
                <Th>Joined</Th>
                <Th right>Posts</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.profile.id} className="border-t border-line">
                  <Td>
                    <Link href={`/admin/money/wallets?handle=${encodeURIComponent(u.profile.handle)}`} className="text-ink max-dt:flex max-dt:min-h-[44px] max-dt:flex-col max-dt:justify-center">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-body-strong">{u.displayName ?? "No name yet"}</span>
                        <VerifiedTick verified={u.verified} />
                      </span>
                      <span className="block text-ink-2">{`@${u.profile.handle}`}</span>
                    </Link>
                  </Td>
                  <Td>{u.mailTo ?? "-"}</Td>
                  <Td>{u.state ?? "-"}</Td>
                  <Td className="whitespace-nowrap">{dateTime(u.createdAt)}</Td>
                  <Td right>{count(u.postCount)}</Td>
                  <Td>
                    <StatusChip status={u.status} />
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

export function AdminUsersPage() {
  return (
    <Gated page="users">
      <UsersBody />
    </Gated>
  );
}
