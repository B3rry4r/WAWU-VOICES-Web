"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "@/components/shell/ShellSlots";
import { Badge, Button, EmptyState, Icon, ResultComment, Skeleton, Tabs, Toast } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { getResultThread, listResultPosts } from "@/lib/api/results";
import type { ResultFilter, ResultPost, ResultThread } from "@/lib/api/results";
import { ShareSheet } from "@/features/share";
import { toComment } from "./map";
import { ReportSheet } from "./ReportSheet";
import "./results.css";
import { AppBar, DesktopBack, LabelsPanel, longDate, shortDate, useSignedIn } from "./shared";

export const POLL_MS = 20000;

type Load = { kind: "loading" } | { kind: "error"; missing: boolean } | { kind: "ready" };

export function LiveResultsPage({ threadId }: { threadId: string }) {
  const signedIn = useSignedIn();
  const [thread, setThread] = useState<ResultThread | null>(null);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [posts, setPosts] = useState<ResultPost[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [newest, setNewest] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const [more, setMore] = useState(false);
  const [posted, setPosted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const newestRef = useRef<string | null>(null);
  newestRef.current = newest;

  const fetchFirst = useCallback(async (f: ResultFilter, markNew: boolean) => {
    const [t, page] = await Promise.all([getResultThread(threadId), listResultPosts(threadId, { filter: f })]);
    if (filterRef.current !== f) return;
    setThread(t);
    setPosts((old) => {
      if (markNew) {
        const had = new Set(old.map((p) => p.id));
        setFresh(new Set(page.items.filter((p) => !had.has(p.id)).map((p) => p.id)));
      } else setFresh(new Set());
      return page.items;
    });
    setNext(page.nextCursor);
    setNewest(page.newestCursor);
    setNewCount(0);
    setLoad({ kind: "ready" });
  }, [threadId]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("posted") === "1") {
      setPosted(true);
      window.history.replaceState(null, "", window.location.pathname);
      const t = window.setTimeout(() => setPosted(false), 6000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, []);

  useEffect(() => {
    setLoad({ kind: "loading" });
    fetchFirst(filter, false).catch((e: unknown) => {
      if (filterRef.current === filter) setLoad({ kind: "error", missing: e instanceof ApiError && e.status === 404 });
    });
  }, [filter, fetchFirst]);

  // "N new results": no stream exists for result posts, so ask the list how many are newer than the newest shown.
  useEffect(() => {
    if (load.kind !== "ready") return undefined;
    const id = window.setInterval(() => {
      if (document.hidden || !newestRef.current) return;
      listResultPosts(threadId, { filter: filterRef.current, after: newestRef.current, limit: 1 })
        .then((p) => setNewCount(p.newCount))
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load.kind, threadId]);

  async function showNew() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      await fetchFirst(filter, true);
    } catch {
      /* the pill stays; the next tap tries again */
    }
  }

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const page = await listResultPosts(threadId, { filter, cursor: next });
      setPosts((old) => old.concat(page.items));
      setNext(page.nextCursor);
    } catch {
      /* leave the button to try again */
    } finally {
      setMore(false);
    }
  }

  const postHref = `/live/${threadId}/post`;
  const canPost = signedIn === true && thread?.status === "OPEN";

  if (load.kind === "error") {
    return (
      <>
        <AppBar href="/" backLabel="Back" title="Live results" />
        <DesktopBack href="/" label="Back" />
        <EmptyState icon={load.missing ? "radio" : "wifi-off"} title={load.missing ? "This thread is not open" : "Could not load the results"} body={load.missing ? undefined : "Check your connection and try again."} action={load.missing ? undefined : "Try again"} actionIcon="refresh-cw" onAction={() => { setLoad({ kind: "loading" }); fetchFirst(filter, false).catch(() => setLoad({ kind: "error", missing: false })); }} />
      </>
    );
  }

  return (
    <>
      <AppBar href="/" backLabel="Back" title="Live results" subtitle={thread ? `Election day · ${shortDate(thread.heldOn)}` : undefined} right={thread ? <button type="button" aria-label="Share this thread" onClick={() => setSharing(true)} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-ink hover:bg-surface-2"><Icon name="share-2" size={24} /></button> : null} />
      <DesktopBack href="/" label="Back" />
      {load.kind === "loading" || !thread ? (
        <div className="flex flex-col gap-4 pt-2" aria-busy="true">
          <Skeleton variant="line" width="60%" />
          <Skeleton variant="line" />
          <Skeleton variant="answer" />
          <Skeleton variant="answer" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-2 pb-40 dt:pb-0">
          {posted ? <Toast>Posted. Until it is checked, your post shows Not verified.</Toast> : null}
          <header className="flex flex-col gap-1.5">
            <span className="text-eyebrow uppercase text-green-text">{thread.title}</span>
            {thread.subtitle ? <h1 className="m-0 font-display text-display-l dt:text-display-xl">{thread.subtitle}</h1> : <h1 className="sr-only">{thread.title}</h1>}
            <p className="m-0 text-caption text-ink-2">{longDate(thread.heldOn)}</p>
          </header>

          <section className="flex flex-col gap-3" aria-label="Polling unit results">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 font-display text-display-m">Polling unit results</h2>
              {thread.status === "OPEN" ? <Badge tone="live" /> : null}
            </div>
            <p className="m-0 text-caption text-ink-2">People post the numbers they see. Verified means the WAWU team checked them. WAWU does not publish its own count.</p>

            <div className="sticky top-[calc(var(--topbar-h)+env(safe-area-inset-top,0px))] z-sticky -mx-1 flex flex-col items-stretch gap-2 bg-bg px-1 py-2 dt:top-0">
              <Tabs
                variant="segmented"
                label="Show"
                value={filter}
                onChange={(id) => setFilter(id === "verified" ? "verified" : "all")}
                items={[
                  { id: "all", label: "All", count: thread.postCount },
                  { id: "verified", label: "Verified only", icon: "badge-check", count: thread.verifiedCount },
                ]}
              />
              {newCount > 0 ? (
                <button type="button" className="vx-newpill" aria-live="polite" onClick={showNew}>
                  <Icon name="arrow-up" size={18} strokeWidth={2.5} />
                  {newCount + (newCount === 1 ? " new result" : " new results")}
                </button>
              ) : null}
            </div>

            <div className="rs-comments flex flex-col gap-3">
              {posts.length ? (
                posts.map((p) => <ResultComment key={p.id} {...toComment(p, fresh.has(p.id))} onReport={() => setReporting(p.id)} />)
              ) : filter === "verified" ? (
                <EmptyState icon="badge-check" title="Nothing verified yet" body="The WAWU team checks numbers as they come in. Switch to All to see every post." />
              ) : (
                <EmptyState icon="radio" title="No results posted yet" body={canPost ? "Be the first to post the numbers you see." : undefined} />
              )}
              {next ? (
                <Button variant="secondary" block loading={more} onClick={loadMore}>Show more</Button>
              ) : null}
            </div>
          </section>

          {canPost ? (
            <div className="fixed inset-x-0 bottom-[calc(var(--bottombar-h)+env(safe-area-inset-bottom,0px))] z-sticky bg-surface px-3 pb-[34px] pt-2.5 shadow-[0_-1px_0_var(--line)] dt:hidden">
              <Button size="l" block icon="plus" href={postHref}>Post the numbers you see</Button>
            </div>
          ) : null}
        </div>
      )}

      {reporting ? <ReportSheet postId={reporting} signedIn={signedIn} onClose={() => setReporting(null)} /> : null}
      {sharing ? <ShareSheet objectType="RESULT_THREAD" objectId={threadId} onClose={() => setSharing(false)} /> : null}
      <Rail>
        {canPost ? (
          <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="Were you at a polling unit?">
            <h2 className="m-0 font-display text-display-s">Were you at a polling unit?</h2>
            <p className="m-0 text-caption text-ink-2">Copy them from the result sheet. The WAWU team checks every post.</p>
            <Button block icon="plus" href={postHref}>Post the numbers you see</Button>
          </section>
        ) : null}
        <LabelsPanel />
      </Rail>
    </>
  );
}
