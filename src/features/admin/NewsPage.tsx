"use client";

import { countText } from "@/lib/format/plural";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, Icon, NewsTag, Tabs, TextField } from "@/components/vx";
import { decideNews, listNews } from "@/lib/api/admin";
import type { AdminNewsItem, NewsDecision } from "@/lib/api/admin";
import { useAdmin } from "./AdminFrame";
import { ago, clock } from "./time";
import { AuditList, Card, CardTitle, ErrorLine, Eyebrow, ListSkeleton, LoadFailed, PageHead, SavedLine, queueRow, useAction, Gated } from "./ui";

type NewsTagId = "VERIFIED_NEWS" | "UNVERIFIED_NEWS" | "GOSSIP";
const KIND: Record<NewsTagId, "verified" | "unverified" | "gossip"> = { VERIFIED_NEWS: "verified", UNVERIFIED_NEWS: "unverified", GOSSIP: "gossip" };
const WORDS: Record<NewsTagId, string> = { VERIFIED_NEWS: "Verified News", UNVERIFIED_NEWS: "Unverified News", GOSSIP: "Gossip" };
const TAB_QUERY: Record<string, string> = { flagged: "flagged", asking: "asking-verified", changes: "all-changes" };

const tagOf = (it: AdminNewsItem): NewsTagId => (it.answer.news?.tag as NewsTagId | undefined) ?? "UNVERIFIED_NEWS";

function NewsBody() {
  const { reloadToday } = useAdmin();
  const [tab, setTab] = useState("flagged");
  const [items, setItems] = useState<AdminNewsItem[] | null>(null);
  const [counts, setCounts] = useState({ flagged: 0, askingVerified: 0, allChanges: 0 });
  const [waiting, setWaiting] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setItems(null);
    setError(null);
    try {
      const p = await listNews({ tab: TAB_QUERY[tab] });
      if (my !== seq.current) return;
      setItems(p.items);
      setNext(p.nextCursor);
      setCounts(p.counts);
      setWaiting(p.waiting);
      setSelected(p.items[0]?.answer.id ?? null);
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);


  const it = items?.find((i) => i.answer.id === selected) ?? null;

  async function more() {
    if (!next) return;
    const p = await listNews({ tab: TAB_QUERY[tab], cursor: next });
    setItems((x) => [...(x ?? []), ...p.items]);
    setNext(p.nextCursor);
  }

  function decided(id: string, word: string, queueTab: string) {
    setSaved(word);
    setItems((x) => {
      const rest = (x ?? []).filter((i) => i.answer.id !== id);
      const at = (x ?? []).findIndex((i) => i.answer.id === id);
      setSelected(rest[Math.min(at, rest.length - 1)]?.answer.id ?? null);
      return rest;
    });
    setCounts((c) => ({ ...c, [queueTab === "flagged" ? "flagged" : "askingVerified"]: Math.max(0, c[queueTab === "flagged" ? "flagged" : "askingVerified"] - 1), allChanges: c.allChanges + 1 }));
    setWaiting((w) => Math.max(0, w - 1));
    reloadToday();
  }

  return (
    <div>
      <PageHead eyebrow={`Editorial · ${waiting} waiting`} title="News tag review" sub="Only editors can mark Verified News, and only with a named source. Every change is logged and the poster is told why." />
      <div className="mb-5">
        <Tabs
          label="News queues"
          items={[
            { id: "flagged", label: "Flagged as misleading", count: counts.flagged },
            // lead ruling WF (RW3), 6 Nov: "Asking for Verified News" stays hidden until a route creates those requests.
            { id: "changes", label: "All changes", count: counts.allChanges },
          ]}
          value={tab}
          onChange={(id) => {
            setSaved(null);
            setTab(id);
          }}
        />
      </div>
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon="shield-check" title={tab === "changes" ? "No changes yet" : "Nothing is waiting here"} body={tab === "changes" ? "Every tag change will be listed here." : "Posts people flag as misleading land here."} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
          <div className="overflow-hidden rounded-xl border border-line bg-surface" role="list" aria-label="Queue">
            {items.map((i) => (
              <button key={i.answer.id} type="button" role="listitem" className={queueRow(selected === i.answer.id)} onClick={() => setSelected(i.answer.id)} aria-current={selected === i.answer.id ? "true" : undefined}>
                <span className="flex flex-wrap items-center gap-2">
                  <NewsTag kind={KIND[tagOf(i)]} />
                  <span className={`text-count ${i.verifiedRequested ? "text-verified" : "text-danger"}`}>
                    {i.verifiedRequested ? "Source sent for Verified News" : `Flagged ${i.flagCount} ${i.flagCount === 1 ? "time" : "times"}`}
                  </span>
                </span>
                <span className="mt-2 block whitespace-pre-wrap break-words text-body">{i.answer.body}</span>
                <span className="mt-1 block text-caption text-ink-2">{`@${i.answer.author?.handle ?? "removed"} · ${ago(i.answer.createdAt)} · ${countText(i.answer.likeCount, "like")}${i.evidenceUrl ? " · source photo attached" : ""}`}</span>
              </button>
            ))}
            {next ? (
              <div className="p-3 text-center">
                <Button variant="ghost" onClick={more}>Show more</Button>
              </div>
            ) : null}
          </div>
          {it ? <Decide key={it.answer.id} item={it} readOnly={tab === "changes"} onDone={(w) => decided(it.answer.id, w, tab)} /> : null}
        </div>
      )}
    </div>
  );
}

function Decide({ item, readOnly, onDone }: { item: AdminNewsItem; readOnly: boolean; onDone: (word: string) => void }) {
  const cur = tagOf(item);
  const [tag, setTag] = useState<NewsTagId>(cur);
  const [url, setUrl] = useState(item.sourceUrl ?? "");
  const [name, setName] = useState(item.sourceName ?? "");
  const [reason, setReason] = useState("");
  const act = useAction();
  const a = item.answer;
  const needSource = tag === "VERIFIED_NEWS";
  const reasonOk = reason.trim().length > 0;

  async function go(body: NewsDecision, word: string) {
    const ok = await act.run(async () => {
      await decideNews(a.id, body);
      return true;
    });
    if (ok) onDone(word);
  }
  const base = { reason: reason.trim() };
  const source = needSource ? { sourceName: name.trim() || undefined, sourceUrl: url.trim() || undefined } : {};

  return (
    <Card>
      <CardTitle>Decide the tag</CardTitle>
      <div className="rounded-l border border-line p-4">
        <div className="flex items-center gap-3">
          <Avatar name={a.author?.displayName || a.author?.handle || "?"} size="m" />
          <div>
            <div className="text-body-strong">{`@${a.author?.handle ?? "removed"}`}</div>
            <div className="text-caption text-ink-2">{[ago(a.createdAt) + " ago", a.author?.state].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="mt-3"><NewsTag kind={KIND[cur]} /></div>
        <p className="m-0 mt-3 whitespace-pre-wrap break-words text-body-l">{a.body}</p>
        <div className="mt-3 flex gap-5 text-caption text-ink-2">
          <span className="inline-flex items-center gap-1.5"><Icon name="heart" size={18} />{a.likeCount}</span>
          <span className="inline-flex items-center gap-1.5"><Icon name="message-circle" size={18} />{a.replyCount}</span>
        </div>
      </div>

      {item.flagReasons.length ? (
        <div className="mt-4 rounded-l bg-surface-2 p-4">
          <Eyebrow className="mb-1">What the flags say</Eyebrow>
          <p className="m-0 text-caption">{item.flagReasons.join("  ·  ")}</p>
        </div>
      ) : null}
      {item.verifiedRequested && item.evidenceUrl ? (
        <p className="m-0 mt-3 text-caption">
          <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer" className="link">Open the source photo</a>
        </p>
      ) : null}

      {readOnly ? null : (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <div className="mb-2 text-label">Tag</div>
            <Tabs variant="segmented" block label="Choose the tag" items={(Object.keys(WORDS) as NewsTagId[]).map((k) => ({ id: k, label: WORDS[k] }))} value={tag} onChange={(v) => setTag(v as NewsTagId)} />
          </div>
          {needSource || item.verifiedRequested ? (
            <>
              <TextField label="Source name (needed for Verified News)" value={name} onChange={setName} placeholder="The outlet or office" />
              <TextField label="Source link (needed for Verified News)" value={url} onChange={setUrl} placeholder="https://" inputMode="url" hint="A named source WAWU checked. Shown on the post." />
            </>
          ) : null}
          <TextField label="Reason (the poster sees this)" multiline value={reason} onChange={setReason} hint="Required." />
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex flex-wrap items-center gap-3">
            {item.verifiedRequested ? (
              <>
                <Button icon="check" loading={act.busy} disabled={!reasonOk || act.busy} onClick={() => go({ decision: "APPROVE_VERIFIED", ...base, sourceName: name.trim() || undefined, sourceUrl: url.trim() || undefined }, "Verified News approved. The poster is told why.")}>Approve Verified News</Button>
                <Button variant="secondary" disabled={!reasonOk || act.busy} onClick={() => go({ decision: "DECLINE_VERIFIED", ...base }, "Request declined. The poster is told why.")}>Decline</Button>
              </>
            ) : (
              <>
                <Button icon="check" loading={act.busy} disabled={!reasonOk || act.busy} onClick={() => go({ decision: "KEEP", ...base }, `Kept as ${WORDS[cur]}. The reason is logged.`)}>{`Keep ${WORDS[cur]}`}</Button>
                <Button variant="secondary" disabled={!reasonOk || act.busy || tag === cur} onClick={() => go({ decision: "CHANGE_TAG", newTag: tag, ...source, ...base }, `Changed to ${WORDS[tag]}. The poster is told why.`)}>Change tag</Button>
              </>
            )}
          </div>
          <div>
            <Button variant="ghost" icon="flag" disabled={!reasonOk || act.busy} onClick={() => go({ decision: "SEND_TO_MODERATION", ...base }, "Sent to moderation.")}>Send to moderation</Button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <AuditList title="Change log" lines={item.changeLog.map((l) => ({ ...l, text: `${clock(l.at)} · ${l.text}` }))} />
      </div>
    </Card>
  );
}

export function AdminNewsPage() {
  return (
    <Gated page="news">
      <NewsBody />
    </Gated>
  );
}
