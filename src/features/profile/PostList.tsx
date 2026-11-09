"use client";
import { BUSY_WORDS, isBusy } from "@/lib/api/busy";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, EmptyState } from "@/components/vx";
import type { Page } from "@/lib/api/profile";
import { LoadError, LoadingBlock } from "./states";

/** A cursor-paged list: first page on mount (and when `reloadKey` changes), "Show more" for the next. */
export function PagedList<T>({ load, row, empty, reloadKey }: {
  load: (cursor?: string) => Promise<Page<T>>;
  row: (item: T) => ReactNode;
  empty: { title: string; body?: string; icon?: Parameters<typeof EmptyState>[0]["icon"] };
  reloadKey?: string;
}) {
  const [items, setItems] = useState<T[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const run = useRef(0);

  const first = useCallback(() => {
    const id = ++run.current;
    setItems(null); setError(null);
    load().then((p) => { if (id === run.current) { setItems(p.items); setNext(p.nextCursor); } }, (e: unknown) => { if (id === run.current) setError(e); });
  }, [load]);
  useEffect(() => { first(); }, [first, reloadKey]);

  async function showMore() {
    if (!next) return;
    setMore(true);
    try { const p = await load(next); setItems((cur) => [...(cur ?? []), ...p.items]); setNext(p.nextCursor); } catch (e) { setError(e); } finally { setMore(false); }
  }

  if (error && !items?.length) return <LoadError error={error} onRetry={first} />;
  if (!items) return <LoadingBlock />;
  if (!items.length) return <EmptyState icon={empty.icon ?? "mic"} title={empty.title} body={empty.body} />;
  return (
    <div className="pf-list">
      {items.map((it, i) => <div key={i}>{row(it)}</div>)}
      {error ? <p className="pf-note pf-note--err" role="alert">{isBusy(error) ? BUSY_WORDS : "Could not load more. Try again."}</p> : null}
      {next ? <Button variant="secondary" block loading={more} onClick={showMore}>Show more</Button> : null}
    </div>
  );
}
