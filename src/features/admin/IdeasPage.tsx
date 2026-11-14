"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, TextField } from "@/components/vx";
import { confirmGroup, listProposalQuestions, listProposals } from "@/lib/api/admin";
import type { AdminProposalItem, AdminProposalQuestion, AdminProposals } from "@/lib/api/admin";
import { Card, CardTitle, ErrorLine, Eyebrow, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction, Gated, queueRow } from "./ui";

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;

function IdeasBody() {
  const [questions, setQuestions] = useState<AdminProposalQuestion[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await listProposalQuestions();
      setQuestions(r.items);
      setSelected((cur) => cur ?? r.items[0]?.questionId ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHead
        eyebrow="What Next?"
        title="Group ideas"
        sub="Similar proposals are grouped here. A group is shown on What Next only after a moderator confirms it."
      />
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : questions === null ? (
        <ListSkeleton />
      ) : questions.length === 0 ? (
        <EmptyState icon="messages-square" title="No proposals yet" body="Questions show here once people propose next steps." />
      ) : (
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] items-start gap-5">
          <div className="overflow-hidden rounded-xl border border-line bg-surface" role="list" aria-label="Questions with proposals">
            {questions.map((q) => (
              <button key={q.questionId} type="button" role="listitem" aria-current={selected === q.questionId ? "true" : undefined} className={queueRow(selected === q.questionId)} onClick={() => { setSelected(q.questionId); setSaved(null); }}>
                <div className="vx-eyebrow text-ink-2">{q.weekNumber ? `Week ${q.weekNumber}` : "No week"}</div>
                <div className="mt-1 text-body-strong">{q.text}</div>
                <div className="mt-1 text-caption text-ink-2">{`${count(q.proposalCount, "proposal", "proposals")}, ${count(q.groupCount, "group", "groups")}, ${q.ungroupedCount.toLocaleString("en-NG")} not grouped`}</div>
              </button>
            ))}
          </div>
          {selected ? <Proposals key={selected} questionId={selected} onDone={(msg) => { setSaved(msg); void load(); }} /> : null}
        </div>
      )}
    </div>
  );
}

function Proposals({ questionId, onDone }: { questionId: string; onDone: (msg: string) => void }) {
  const [d, setD] = useState<AdminProposals | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");

  useEffect(() => {
    let live = true;
    setError(null);
    listProposals(questionId).then(
      (x) => live && setD(x),
      (e: Error) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [questionId, n]);

  if (error) return <LoadFailed error={error} retry={() => setN((x) => x + 1)} />;
  if (!d) return <ListSkeleton rows={3} />;

  const loose = d.items.filter((p) => !p.groupId);
  const byId = new Map(d.items.map((p) => [p.id, p]));
  const done = (msg: string) => {
    setPicked(new Set());
    setTitle("");
    setN((x) => x + 1);
    onDone(msg);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <Eyebrow>Question</Eyebrow>
        <h2 className="m-0 mt-1 font-display text-display-m">{d.question.text}</h2>
      </Card>

      <Card>
        <CardTitle>Suggested groups</CardTitle>
        {d.suggestions.length === 0 ? (
          <p className="m-0 text-body text-ink-2">No similar proposals found. You can still group some by hand below.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {d.suggestions.map((s, i) => (
              <Suggestion key={s.proposalIds.join()} index={i} title={s.title} items={s.proposalIds.map((id) => byId.get(id)).filter((p): p is AdminProposalItem => !!p)} onDone={done} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Group by hand</CardTitle>
        {loose.length === 0 ? (
          <p className="m-0 text-body text-ink-2">Every proposal is in a group.</p>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col p-0" aria-label="Proposals not in a group">
              {loose.map((p) => (
                <li key={p.id} className="flex items-start gap-3 border-t border-line py-3 first:border-t-0">
                  <input
                    id={`pick-${p.id}`}
                    type="checkbox"
                    className="mt-1 h-5 w-5 flex-none"
                    checked={picked.has(p.id)}
                    onChange={(e) => setPicked((o) => { const x = new Set(o); if (e.target.checked) x.add(p.id); else x.delete(p.id); return x; })}
                  />
                  <label htmlFor={`pick-${p.id}`} className="min-w-0 flex-1 cursor-pointer text-body">
                    {p.text || "A spoken proposal with no transcript yet"}
                    <span className="ml-2 text-caption text-ink-2">{`${p.supportCount.toLocaleString("en-NG")} support, ${p.challengeCount.toLocaleString("en-NG")} challenge`}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Confirm picked={[...picked]} title={title} setTitle={setTitle} label="Name this group" onDone={done} />
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Confirmed groups</CardTitle>
        {d.groups.length === 0 ? (
          <p className="m-0 text-body text-ink-2">No group yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {d.groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
                <span className="text-body">{g.title}</span>
                <span className="flex items-center gap-2">
                  <span className="text-caption text-ink-2">{count(g.proposalCount, "proposal", "proposals")}</span>
                  {g.confirmed ? <Pill tone="green">Confirmed</Pill> : <Pill tone="sun">Suggested</Pill>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-3 text-caption text-ink-2">To change a group, confirm a new one with the proposals you want. They move, and an empty group goes away.</p>
      </Card>
    </div>
  );
}

function Suggestion({ index, title, items, onDone }: { index: number; title: string; items: AdminProposalItem[]; onDone: (msg: string) => void }) {
  const [t, setT] = useState(title);
  return (
    <section className="rounded-l bg-surface-2 p-4" aria-label={`Suggested group ${index + 1}`}>
      <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0 text-body">
        {items.map((p) => (
          <li key={p.id} className="border-l-2 border-line pl-3">
            {p.text}
            <span className="ml-2 text-caption text-ink-2">{`${p.supportCount.toLocaleString("en-NG")} support`}</span>
          </li>
        ))}
      </ul>
      <Confirm picked={items.map((p) => p.id)} title={t} setTitle={setT} label="Group name" onDone={onDone} />
    </section>
  );
}

function Confirm({ picked, title, setTitle, label, onDone }: { picked: string[]; title: string; setTitle: (v: string) => void; label: string; onDone: (msg: string) => void }) {
  const act = useAction();
  const ok = picked.length >= 2 && title.trim().length >= 3;
  async function go() {
    const g = await act.run(() => confirmGroup(title.trim(), picked));
    if (g) onDone(`Group confirmed: “${g.title}”. It now shows on What Next.`);
  }
  return (
    <div className="mt-3 flex flex-col gap-3">
      <TextField label={label} value={title} onChange={setTitle} maxLength={160} hint={picked.length < 2 ? "Pick at least two proposals." : `${count(picked.length, "proposal", "proposals")} picked.`} />
      <ErrorLine>{act.error}</ErrorLine>
      <div>
        <Button icon="check" loading={act.busy} disabled={!ok || act.busy} onClick={() => void go()}>Confirm this group</Button>
      </div>
    </div>
  );
}

export function AdminIdeasPage() {
  return (
    <Gated page="ideas">
      <IdeasBody />
    </Gated>
  );
}
