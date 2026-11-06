"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, Icon, Tabs, TextField, TopicChip } from "@/components/vx";
import { decideResult, listResultPostsAdmin, listResultThreads } from "@/lib/api/admin";
import type { AdminResultPost, ResultThread } from "@/lib/api/admin";
import { useAdmin } from "./AdminFrame";
import { clock } from "./time";
import { Card, CardTitle, ErrorLine, ListSkeleton, LoadFailed, PageHead, SavedLine, queueRow, useAction, Gated } from "./ui";

function Mark({ post }: { post: AdminResultPost["post"] }) {
  const ok = post.status === "VERIFIED";
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 text-count ${ok ? "text-verified" : "text-warning"}`}>
      <Icon name={ok ? "circle-check" : "circle-dashed"} size={18} />
      {ok ? "Verified" : "Not verified"}
    </span>
  );
}

function ResultsBody() {
  const { reloadToday } = useAdmin();
  const [threads, setThreads] = useState<ResultThread[] | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [items, setItems] = useState<AdminResultPost[] | null>(null);
  const [toCheck, setToCheck] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const seq = useRef(0);

  const loadThreads = useCallback(async () => {
    setError(null);
    try {
      const t = await listResultThreads();
      setThreads(t.items);
      setThreadId((cur) => cur ?? t.items.find((x) => x.toCheck > 0)?.id ?? t.items[0]?.id ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const loadPosts = useCallback(async () => {
    if (!threadId) return;
    const my = ++seq.current;
    setItems(null);
    try {
      const p = await listResultPostsAdmin({ threadId });
      if (my !== seq.current) return;
      setItems(p.items);
      setToCheck(p.toCheck);
      setNext(p.nextCursor);
      setSelected(p.items[0]?.post.id ?? null);
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    }
  }, [threadId]);
  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);


  const total = (threads ?? []).reduce((n, t) => n + t.toCheck, 0);
  const it = items?.find((i) => i.post.id === selected) ?? null;

  async function more() {
    if (!next || !threadId) return;
    const p = await listResultPostsAdmin({ threadId, cursor: next });
    setItems((x) => [...(x ?? []), ...p.items]);
    setNext(p.nextCursor);
  }

  /** A saved row stays in the list with its new mark; the next unchecked row opens. */
  function saveDone(postId: string, row: AdminResultPost, word: string, gone: boolean) {
    setSaved(word);
    setItems((x) => {
      const list = x ?? [];
      const at = list.findIndex((i) => i.post.id === postId);
      const after = list.slice(at + 1).find((i) => !i.post.checkedAt && i.post.id !== postId) ?? list.find((i) => !i.post.checkedAt && i.post.id !== postId);
      setSelected(after?.post.id ?? null);
      return gone ? list.filter((i) => i.post.id !== postId) : list.map((i) => (i.post.id === postId ? row : i));
    });
    setToCheck((n) => Math.max(0, n - 1));
    setThreads((ts) => (ts ?? []).map((t) => (t.id === threadId ? { ...t, toCheck: Math.max(0, t.toCheck - 1) } : t)));
    reloadToday();
  }

  return (
    <div>
      <PageHead eyebrow={`Live results threads · ${total} to check`} title="Posted results" sub="People post the numbers they see. You mark each one Verified or Not verified. WAWU never publishes a count of its own." />
      {error && !threads ? (
        <LoadFailed error={error} retry={loadThreads} />
      ) : threads === null ? (
        <ListSkeleton />
      ) : threads.length === 0 ? (
        <EmptyState icon="map-pin" title="No results threads yet" body="Open a thread for an election or a price watch and people can post their numbers." />
      ) : (
        <>
          <div className="mb-5" role="group" aria-label="Threads">
            <div className="flex flex-wrap gap-2">
              {threads.map((t) => (
                <TopicChip key={t.id} label={t.title} count={t.toCheck} selected={threadId === t.id} onClick={() => { setSaved(null); setThreadId(t.id); }} />
              ))}
            </div>
          </div>
          {saved ? (
            <div className="mb-4">
              <SavedLine>{saved}</SavedLine>
            </div>
          ) : null}
          {error ? (
            <LoadFailed error={error} retry={loadPosts} />
          ) : items === null ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            <EmptyState icon="circle-check" title="Nothing to check in this thread" body="New results show up here as people post them." />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
              <div className="overflow-hidden rounded-xl border border-line bg-surface" role="list" aria-label="Queue">
                {items.map((i) => {
                  const p = i.post;
                  return (
                    <button key={p.id} type="button" role="listitem" className={queueRow(selected === p.id)} onClick={() => setSelected(p.id)} aria-current={selected === p.id ? "true" : undefined}>
                      <span className="flex items-center gap-3">
                        <Icon name="map-pin" size={22} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-label">{`PU ${p.pollingUnit}, Ward ${p.ward}, ${p.lga}, ${p.state}`}</span>
                          <span className="block text-caption text-ink-2">{`@${p.author.handle} · ${clock(p.createdAt)} · ${i.hasPhoto ? "photo attached" : "no photo"}${i.checkedBy ? ` · checked by ${i.checkedBy}` : ""}`}</span>
                        </span>
                        <Mark post={p} />
                      </span>
                    </button>
                  );
                })}
                {next ? (
                  <div className="p-3 text-center">
                    <Button variant="ghost" onClick={more}>{`${Math.max(1, toCheck - items.filter((i) => !i.post.checkedAt).length)} more waiting in this thread`}</Button>
                  </div>
                ) : null}
              </div>
              {it ? <Check key={it.post.id} row={it} onDone={(row, w, gone) => saveDone(it.post.id, row, w, gone)} /> : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Check({ row, onDone }: { row: AdminResultPost; onDone: (row: AdminResultPost, word: string, gone: boolean) => void }) {
  const p = row.post;
  const [mark, setMark] = useState<"VERIFIED" | "NOT_VERIFIED" | null>(null);
  const [note, setNote] = useState("");
  const act = useAction();
  const checked = !!p.checkedAt;

  async function save(decision: "VERIFIED" | "NOT_VERIFIED" | "SEND_TO_MODERATION") {
    const ok = await act.run(async () => {
      await decideResult(p.id, decision, note.trim() || undefined);
      return true;
    });
    if (!ok) return;
    const now = new Date().toISOString();
    const updated: AdminResultPost = { ...row, post: { ...p, status: decision === "VERIFIED" ? "VERIFIED" : "NOT_VERIFIED", checkedAt: now, label: decision === "VERIFIED" ? "Verified" : "Not verified" } };
    onDone(updated, decision === "SEND_TO_MODERATION" ? "Sent to moderation." : decision === "VERIFIED" ? "Marked Verified." : "Marked Not verified.", decision === "SEND_TO_MODERATION");
  }

  return (
    <Card>
      <CardTitle>Check this result</CardTitle>
      <div className="rounded-l border border-line p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={p.author.displayName || p.author.handle} size="s" />
            <div>
              <div className="text-body-strong">{`@${p.author.handle}`}</div>
              <div className="text-caption text-ink-2">{clock(p.createdAt)}</div>
            </div>
          </div>
          <span className={`rounded-pill px-3 py-1 ${p.status === "VERIFIED" ? "bg-verified-bg" : "bg-unverified-bg"}`}><Mark post={p} /></span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-body-strong"><Icon name="map-pin" size={20} />{`PU ${p.pollingUnit}, Ward ${p.ward}, ${p.lga}, ${p.state}`}</div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            ["Accredited", p.accredited],
            ["Votes cast", p.votesCast],
            ["Rejected", p.rejected],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-m bg-surface-2 px-3 py-2">
              <div className="text-caption text-ink-2">{l}</div>
              <div className="font-display text-num-l">{Number(v).toLocaleString("en-NG")}</div>
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-caption text-ink-2">{p.checkedLine ?? "Not checked yet. Treat with care."}</p>
      </div>

      {row.hasPhoto && row.photoUrl ? (
        <a href={row.photoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-[96px] items-center justify-center gap-2 rounded-l bg-surface-2 p-6 text-count text-ink no-underline a-plain hover:bg-surface-3">
          <Icon name="eye" size={20} />
          {`Photo of the result sheet, from @${p.author.handle}`}
        </a>
      ) : (
        <div className="mt-4 flex min-h-[64px] items-center justify-center rounded-l bg-surface-2 p-4 text-caption text-ink-2">No photo with this result</div>
      )}

      {checked ? (
        <p className="m-0 mt-4 text-caption text-ink-2">{row.checkedBy ? `Checked by ${row.checkedBy}.` : "Checked."}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <div className="mb-2 text-label">Your decision</div>
            <Tabs variant="segmented" block label="Mark this result" items={[{ id: "VERIFIED", label: "Verified", icon: "circle-check" }, { id: "NOT_VERIFIED", label: "Not verified", icon: "circle-dashed" }]} value={mark ?? ""} onChange={(v) => setMark(v as "VERIFIED" | "NOT_VERIFIED")} />
          </div>
          <TextField label="Reason" value={note} onChange={setNote} hint="Kept in the log. Not shown to the public." />
          {mark ? (
            <div className="flex items-center gap-2 rounded-m bg-verified-bg px-4 py-3 text-count text-verified">
              <Icon name="circle-check" size={18} />
              {mark === "VERIFIED" ? `People will see: Checked by the WAWU team at ${clock(new Date())}` : "People will see: Not verified. Treat with care."}
            </div>
          ) : null}
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex flex-wrap items-center gap-4">
            <Button icon="check" loading={act.busy} disabled={!mark || act.busy} onClick={() => mark && save(mark)}>Save and next</Button>
            <Button variant="ghost" icon="flag" disabled={act.busy} onClick={() => save("SEND_TO_MODERATION")}>Send to moderation</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function AdminResultsPage() {
  return (
    <Gated page="results">
      <ResultsBody />
    </Gated>
  );
}
