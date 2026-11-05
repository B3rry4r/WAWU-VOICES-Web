"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, Icon, TextField, TopicChip } from "@/components/vx";
import { createTopic, getTopic, listTopics, updateQuestion, updateTopic } from "@/lib/api/admin";
import type { AdminQuestion, AdminTopic, AdminTopicList, CalendarWeek, TopicStatus } from "@/lib/api/admin";
import { useAdmin } from "./AdminFrame";
import { canOpen } from "./roles";
import { dayMonth, dayStringShort, dayStringWeekday, slot, weekRange } from "./time";
import { Card, ErrorLine, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction } from "./ui";

const STATUS_WORDS: Record<TopicStatus, string> = { DRAFT: "Draft", IN_REVIEW: "In review", SCHEDULED: "Scheduled", LIVE: "Live", CLOSED: "Closed" };

function StatusPill({ s }: { s: TopicStatus }) {
  const tone = s === "LIVE" ? "red" : s === "SCHEDULED" ? "green" : s === "IN_REVIEW" ? "sun" : "neutral";
  return <Pill tone={tone} dot={s === "LIVE"}>{STATUS_WORDS[s]}</Pill>;
}

type Filter = "all" | "LIVE" | "SCHEDULED" | "IN_REVIEW" | "DRAFT" | "sensitive";

export function AdminCalendarPage() {
  const { roles } = useAdmin();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState<AdminTopicList | null>(null);
  const [weeks, setWeeks] = useState<CalendarWeek[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const seq = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setError(null);
    try {
      const p = await listTopics({ status: filter === "all" || filter === "sensitive" ? undefined : filter, sensitive: filter === "sensitive", q, limit: 30 });
      if (my !== seq.current) return;
      setPage(p);
      setWeeks(p.items);
      if (first.current) {
        first.current = false;
        const live = p.counts.live > 0 ? await listTopics({ status: "LIVE", limit: 1 }).catch(() => null) : null;
        setSelected(live?.items[0]?.topicId ?? p.items[0]?.topicId ?? null);
      } else setSelected((cur) => (cur && p.items.some((w) => w.topicId === cur) ? cur : p.items[0]?.topicId ?? null));
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    }
  }, [filter, q]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!canOpen(roles, "calendar")) return <EmptyState icon="compass" title="We could not find that" body="Go back to Today." />;

  async function more() {
    if (!page?.nextCursor) return;
    const p = await listTopics({ status: filter === "all" || filter === "sensitive" ? undefined : filter, sensitive: filter === "sensitive", q, limit: 30, cursor: page.nextCursor });
    setPage(p);
    setWeeks((w) => [...w, ...p.items]);
  }

  const c = page?.counts;
  const chips: { id: Filter; label: string; count: number | undefined; icon?: "shield-alert" }[] = [
    { id: "all", label: "All", count: page?.totals.weeks },
    { id: "LIVE", label: "Live", count: c?.live },
    { id: "SCHEDULED", label: "Scheduled", count: c?.scheduled },
    { id: "IN_REVIEW", label: "In review", count: c?.inReview },
    { id: "DRAFT", label: "Draft", count: c?.draft },
    { id: "sensitive", label: "Sensitive", count: c?.sensitive, icon: "shield-alert" },
  ];

  return (
    <div>
      <PageHead
        eyebrow={page ? `${page.totals.weeks} weeks · ${page.totals.questions.toLocaleString("en-NG")} questions` : "Topic calendar"}
        title="Topic calendar"
        right={
          <>
            <div className="vx-field w-[260px]">
              <div className="vx-field__box">
                <span className="pl-4 text-ink-2"><Icon name="search" size={20} /></span>
                <input className="vx-field__input" aria-label="Search the calendar" placeholder="Find a week or question" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <Button icon="plus" onClick={() => { setAdding(true); setSaved(null); }}>Add a week</Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter weeks">
        {chips.map((ch) => (
          <TopicChip key={ch.id} label={ch.label} count={ch.count} icon={ch.icon} selected={filter === ch.id} onClick={() => setFilter(ch.id)} />
        ))}
      </div>
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}

      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : page === null ? (
        <ListSkeleton />
      ) : (
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-5">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {weeks.length === 0 ? (
              <div className="p-6">
                <EmptyState icon="search" title={q ? "Nothing matches that" : "No weeks here"} body={q ? "Try a week number, a topic word or part of a question." : "Add a week to start the calendar."} />
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-[14px] leading-5">
                <thead>
                  <tr className="text-ink-2">
                    <th className="vx-eyebrow px-4 py-4 font-bold">Week</th>
                    <th className="vx-eyebrow px-4 py-4 font-bold">Topic of the week</th>
                    <th className="vx-eyebrow px-4 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.topicId} onClick={() => { setSelected(w.topicId); setAdding(false); setSaved(null); }} className={`cursor-pointer border-t border-line ${selected === w.topicId && !adding ? "bg-mint" : "hover:bg-surface-2"}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-bold">{`${w.weekNumber} · ${dayStringShort(w.startsOn)}`}</td>
                      <td className="px-4 py-3">
                        <button type="button" className={`cursor-pointer border-0 bg-transparent p-0 text-left text-ink ${w.status === "LIVE" ? "font-bold" : ""}`} aria-current={selected === w.topicId ? "true" : undefined}>{w.title}</button>
                      </td>
                      <td className="px-4 py-3"><StatusPill s={w.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {page.nextCursor ? (
              <div className="border-t border-line p-3 text-center">
                <Button variant="ghost" onClick={more}>Show more weeks</Button>
              </div>
            ) : null}
          </div>

          {adding ? (
            <WeekForm
              mode="new"
              suggestedWeek={(page.totals.weeks || 0) + 1}
              onClose={() => setAdding(false)}
              onSaved={(t) => { setAdding(false); setSelected(t.topic.id); setSaved("Week added as a draft."); void load(); }}
            />
          ) : selected ? (
            <Panel key={selected} topicId={selected} onChanged={(msg) => { setSaved(msg); void load(); }} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Panel({ topicId, onChanged }: { topicId: string; onChanged: (msg: string) => void }) {
  const [d, setD] = useState<AdminTopic | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    getTopic(topicId).then(
      (x) => live && setD(x),
      (e: Error) => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [topicId, n]);

  if (error) return <LoadFailed error={error} retry={() => setN((x) => x + 1)} />;
  if (!d) return <ListSkeleton rows={3} />;
  const t = d.topic;

  if (editing)
    return <WeekForm mode="edit" topic={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setN((x) => x + 1); onChanged("Week saved."); }} />;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="vx-eyebrow text-ink-2">{`Week ${t.weekNumber} · ${weekRange(t.startsOn)}`}</div>
          <h2 className="m-0 mt-2 font-display text-[26px] font-normal leading-8">{t.title}</h2>
        </div>
        <Button variant="secondary" size="s" onClick={() => setEditing(true)}>Edit week</Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill s={t.status} />
        {t.sensitive ? <span className="rounded-s bg-warning-bg px-2 py-1 text-[12px] font-bold leading-4 text-warning">Sensitive. No ads beside it.</span> : null}
      </div>

      <ul className="m-0 mt-4 list-none p-0">
        {d.questions.map((q) => (
          <QuestionRow key={q.id} q={q} onSaved={() => { setN((x) => x + 1); onChanged("Question saved."); }} />
        ))}
        {d.spare.length ? (
          <li className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-t border-line py-3 text-[15px]">
            <span className="font-bold text-ink-2">Spare</span>
            <span className="text-ink-2">{`${d.spare.length} more ${d.spare.length === 1 ? "question" : "questions"} held for follow-ups and flash polls`}</span>
          </li>
        ) : null}
      </ul>

      {d.poll ? (
        <div className="mt-4 rounded-l bg-surface-2 p-4">
          <div className="vx-eyebrow mb-1 text-ink-2">{`Poll, closes ${slot(d.poll.endsAt)}`}</div>
          <div className="text-[16px] font-bold leading-6">{d.poll.title}</div>
          <p className="m-0 mt-1 text-[14px] leading-5 text-ink-2">{d.poll.options.map((o) => o.label).join(" · ")}</p>
        </div>
      ) : null}
      {t.whatNextPrompt ? <p className="m-0 mt-4 text-[14px] leading-5 text-ink-2">{`What Next? prompt: ${t.whatNextPrompt}`}</p> : null}
    </Card>
  );
}

function QuestionRow({ q, onSaved }: { q: AdminQuestion; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.text);
  const act = useAction();
  async function save() {
    const ok = await act.run(async () => {
      await updateQuestion(q.id, { kind: "DAILY", text: text.trim() });
      return true;
    });
    if (ok) {
      setEditing(false);
      onSaved();
    }
  }
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-3 border-t border-line py-3 first:border-t-0">
      <span className={`text-[14px] font-bold ${q.status === "LIVE" ? "text-green-text" : "text-ink-2"}`}>{q.day ? dayStringWeekday(q.day) : "Open"}</span>
      {editing ? (
        <div className="col-span-2 flex flex-col gap-2">
          <TextField label="Question" multiline value={text} onChange={setText} />
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex gap-2">
            <Button size="s" loading={act.busy} disabled={!text.trim() || act.busy} onClick={save}>Save</Button>
            <Button size="s" variant="secondary" onClick={() => { setEditing(false); setText(q.text); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => setEditing(true)} aria-label={`Edit question: ${q.text}`} className="cursor-pointer border-0 bg-transparent p-0 text-left text-[15px] leading-[22px] text-ink">{q.text}</button>
          <span className="flex gap-1">
            {q.status === "LIVE" ? <Pill tone="red" dot>Live</Pill> : null}
            {q.pinned ? <Pill tone="green">Pinned</Pill> : null}
          </span>
        </>
      )}
    </li>
  );
}

function WeekForm(p: { mode: "new"; suggestedWeek: number; onClose: () => void; onSaved: (t: AdminTopic) => void } | { mode: "edit"; topic: AdminTopic; onClose: () => void; onSaved: (t: AdminTopic) => void }) {
  const t = p.mode === "edit" ? p.topic.topic : null;
  const [f, setF] = useState({
    weekNumber: String(t?.weekNumber ?? (p.mode === "new" ? p.suggestedWeek : "")),
    title: t?.title ?? "",
    blurb: t?.blurb ?? "",
    startsOn: t?.startsOn ?? "",
    whatNextPrompt: t?.whatNextPrompt ?? "",
  });
  const [sensitive, setSensitive] = useState(t?.sensitive ?? false);
  const [status, setStatus] = useState<TopicStatus>(t?.status ?? "DRAFT");
  const act = useAction();
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function save() {
    const body = { weekNumber: Number(f.weekNumber), title: f.title.trim(), blurb: f.blurb.trim() || undefined, startsOn: f.startsOn, sensitive, whatNextPrompt: f.whatNextPrompt.trim() || undefined, status };
    const out = await act.run(() => (p.mode === "edit" ? updateTopic(p.topic.topic.id, body) : createTopic(body)));
    if (out) p.onSaved(out);
  }

  return (
    <Card>
      <h2 className="m-0 mb-1 font-display text-[22px] font-normal leading-7">{p.mode === "edit" ? "Edit week" : "Add a week"}</h2>
      {p.mode === "edit" ? <p className="m-0 mb-4 text-[13px] leading-[18px] text-ink-2">{`Changing the start date moves this week only (${dayMonth(f.startsOn ? f.startsOn + "T12:00:00+01:00" : new Date())} onward). Other weeks stay where they are.`}</p> : <div className="mb-4" />}
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Week number" inputMode="numeric" value={f.weekNumber} onChange={set("weekNumber")} />
        <TextField label="Starts on (a Thursday)" type="date" value={f.startsOn} onChange={set("startsOn")} />
        <TextField label="Topic of the week" value={f.title} onChange={set("title")} className="col-span-2" />
        <TextField label="One line about it (optional)" value={f.blurb} onChange={set("blurb")} className="col-span-2" />
        <TextField label="What Next? prompt (optional)" value={f.whatNextPrompt} onChange={set("whatNextPrompt")} className="col-span-2" />
        <div className="vx-field">
          <label className="vx-field__label" htmlFor="wk-status">Status</label>
          <div className="vx-field__box">
            <select id="wk-status" className="vx-field__input" value={status} onChange={(e) => setStatus(e.target.value as TopicStatus)}>
              {(Object.keys(STATUS_WORDS) as TopicStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_WORDS[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-3 pt-6 text-[15px] font-semibold">
          <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="h-5 w-5" />
          Sensitive topic: no ads beside it
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <ErrorLine>{act.error}</ErrorLine>
        <div className="flex gap-3">
          <Button icon="check" loading={act.busy} disabled={!f.title.trim() || !f.startsOn || !f.weekNumber || act.busy} onClick={save}>{p.mode === "edit" ? "Save week" : "Add week"}</Button>
          <Button variant="secondary" onClick={p.onClose}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}
