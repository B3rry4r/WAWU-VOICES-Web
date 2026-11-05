"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Icon, TextField, TopicChip, WeeklyReportCard } from "@/components/vx";
import { approveWeekly, editWeekly, holdWeekly, listWeekly } from "@/lib/api/admin";
import type { AdminWeeklyReport } from "@/lib/api/admin";
import { readPollSummary, readThemes } from "@/features/reach/weekly-map";
import { useAdmin } from "./AdminFrame";
import { clock, dayMonth, fromLocalInput, slot, toLocalInput } from "./time";
import { Card, CardTitle, ErrorLine, ListSkeleton, LoadFailed, PageHead, SavedLine, StatePill, useAction, Gated, DateTimeField } from "./ui";

const STATUS_WORDS: Record<string, string> = { DRAFT: "Draft", HELD: "Held", APPROVED: "Approved", PUBLISHED: "Published" };

function nextSixPm(): string {
  const d = new Date(Date.now() + 3600_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d);
  let at = new Date(`${day}T18:00:00+01:00`);
  if (at.getTime() < Date.now() + 600_000) at = new Date(at.getTime() + 86400000);
  return at.toISOString();
}

function statusPill(r: AdminWeeklyReport) {
  if (r.status === "PUBLISHED") return <StatePill tone="green" icon="circle-check">Published</StatePill>;
  if (r.status === "APPROVED") return <StatePill tone="green" icon="clock">{`Approved · publishes ${r.publishAt ? slot(r.publishAt) : "soon"}`}</StatePill>;
  if (r.status === "HELD") return <StatePill tone="red" icon="pause">Held · nothing is public</StatePill>;
  return <StatePill tone="sun" icon="clock">Draft · nothing is public yet</StatePill>;
}

function WeeklyBody() {
  const { reloadToday } = useAdmin();
  const [reports, setReports] = useState<AdminWeeklyReport[] | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await listWeekly();
      const list = [...p.items].sort((a, b) => b.weekNumber - a.weekNumber);
      setReports(list);
      setId((cur) => cur ?? (list.find((r) => r.status !== "PUBLISHED") ?? list[0])?.id ?? null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);


  const report = reports?.find((r) => r.id === id) ?? null;
  const replace = (r: AdminWeeklyReport) => {
    setReports((x) => (x ?? []).map((o) => (o.id === r.id ? r : o)));
    reloadToday();
  };

  return (
    <div>
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : reports === null ? (
        <>
          <PageHead title="Weekly report approval" />
          <ListSkeleton />
        </>
      ) : !report ? (
        <>
          <PageHead title="Weekly report approval" />
          <EmptyState icon="chart-column" title="No draft yet" body="The report drafts itself after the week's poll closes." />
        </>
      ) : (
        <>
          <PageHead
            eyebrow={`Week ${report.weekNumber} · drafted ${slot(report.draftedAt)}${report.pollClosedAt ? ", after the poll closed" : ""}`}
            title="Weekly report approval"
            right={statusPill(report)}
          />
          {reports.length > 1 ? (
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Reports">
              {reports.slice(0, 8).map((r) => (
                <TopicChip key={r.id} label={`Week ${r.weekNumber} · ${STATUS_WORDS[r.status] ?? r.status}`} selected={r.id === report.id} onClick={() => setId(r.id)} />
              ))}
            </div>
          ) : null}
          <Review key={report.id} r={report} onChange={replace} />
        </>
      )}
    </div>
  );
}

function Review({ r, onChange }: { r: AdminWeeklyReport; onChange: (r: AdminWeeklyReport) => void }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ cardTitle: r.cardTitle ?? "", headline: r.headline ?? "", mood: r.mood ?? "", summary: r.summary ?? "" });
  const [notes, setNotes] = useState(r.editorNote ?? "");
  const [at, setAt] = useState(toLocalInput(r.publishAt ?? nextSixPm()));
  const [holding, setHolding] = useState(false);
  const [why, setWhy] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const act = useAction();
  const open = r.status === "DRAFT" || r.status === "HELD";

  const summary = readPollSummary(r.pollSummary);
  const themes = readThemes(r.themes);
  const when = clock(fromLocalInput(at));

  async function saveEdit() {
    const out = await act.run(() => editWeekly(r.id, { cardTitle: f.cardTitle || undefined, headline: f.headline, mood: f.mood, summary: f.summary, editorNote: notes || undefined }));
    if (out) {
      onChange(out);
      setEditing(false);
      setSaved("Draft saved.");
    }
  }
  async function approve() {
    setSaved(null);
    const out = await act.run(async () => {
      if (notes.trim() !== (r.editorNote ?? "").trim()) await editWeekly(r.id, { editorNote: notes.trim() });
      return approveWeekly(r.id, fromLocalInput(at));
    });
    if (out) {
      onChange(out);
      setSaved(`Approved. It goes out ${slot(out.publishAt ?? fromLocalInput(at))}.`);
    }
  }
  async function hold() {
    const out = await act.run(() => holdWeekly(r.id, why.trim()));
    if (out) {
      onChange(out);
      setHolding(false);
      setWhy("");
      setSaved("Held. Nothing was published.");
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-5">
      <div>
        <div className="vx-eyebrow mb-2 text-ink-2">AI draft, edit before publishing</div>
        <div className="ad-report">
          {editing ? (
            <Card className="flex flex-col gap-4">
              <TextField label="Card title" value={f.cardTitle} onChange={(v) => setF({ ...f, cardTitle: v })} placeholder="What Nigerians said this week" />
              <TextField label="Mood headline" value={f.headline} onChange={(v) => setF({ ...f, headline: v })} />
              <TextField label="Mood line" value={f.mood} onChange={(v) => setF({ ...f, mood: v })} />
              <TextField label="Summary" multiline value={f.summary} onChange={(v) => setF({ ...f, summary: v })} />
              <ErrorLine>{act.error}</ErrorLine>
              <div className="flex gap-3">
                <Button icon="check" loading={act.busy} onClick={saveEdit}>Save draft</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </Card>
          ) : (
            <WeeklyReportCard
              week={`Week ${r.weekNumber}${r.publishAt ? ` · publishes ${dayMonth(r.publishAt)}` : ""}`}
              title={r.cardTitle ?? "What Nigerians said this week"}
              moodLine={r.mood ?? r.headline ?? ""}
              mood={r.emotions.map((e) => ({ label: e.name, pct: Math.round(e.share), delta: Math.round(e.change) }))}
              themes={themes}
              poll={summary ? { pct: summary.pct, text: summary.text } : undefined}
              voices={r.basedOnVoices}
              votes={r.basedOnVotes}
              updated={r.publishAt ? `Publishes ${slot(r.publishAt)}.` : undefined}
            />
          )}
        </div>
        {r.summary && !editing ? <p className="m-0 mt-4 text-[15px] leading-6 text-ink-2">{r.summary}</p> : null}
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardTitle>Checks</CardTitle>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] leading-6">
                <Icon name={c.ok ? "circle-check" : "triangle-alert"} size={22} className={`mt-0.5 flex-none ${c.ok ? "text-success" : "text-warning"}`} label={c.ok ? "Passed" : "Needs a look"} />
                {c.text}
              </li>
            ))}
            {r.checks.length === 0 ? <li className="text-ink-2">No checks have run yet.</li> : null}
          </ul>
          <dl className="m-0 mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-[14px] leading-5">
            <dt className="text-ink-2">Based on</dt>
            <dd className="m-0">{`${r.basedOnVoices.toLocaleString("en-NG")} voices and ${r.basedOnVotes.toLocaleString("en-NG")} votes`}</dd>
            {r.pollClosedAt ? (
              <>
                <dt className="text-ink-2">Poll closed</dt>
                <dd className="m-0">{slot(r.pollClosedAt).replace(/^(\w+ \d+ \w+),/, "$1,")}</dd>
              </>
            ) : null}
            <dt className="text-ink-2">Label</dt>
            <dd className="m-0">AI-assisted · Human-reviewed</dd>
          </dl>
        </Card>

        {saved ? <SavedLine>{saved}</SavedLine> : null}

        {open ? (
          <>
            <TextField label="Editor notes (kept in the log)" multiline value={notes} onChange={setNotes} />
            <div>
              <DateTimeField label="Publish at" value={at} onChange={setAt} hint="Goes to the web, the app and the share card at once. Lagos time." />
            </div>
            <ErrorLine>{!editing && !holding ? act.error : null}</ErrorLine>
            {holding ? (
              <div className="flex flex-col gap-3">
                <TextField label="Why are you holding it?" multiline value={why} onChange={setWhy} hint="Required. It goes in the log." />
                <ErrorLine>{act.error}</ErrorLine>
                <div className="flex gap-3">
                  <Button variant="destructive" loading={act.busy} disabled={!why.trim() || act.busy} onClick={hold}>Hold the report</Button>
                  <Button variant="secondary" onClick={() => setHolding(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button icon="check" loading={act.busy && !editing} disabled={act.busy} onClick={approve}>{`Approve and publish at ${when}`}</Button>
                <Button variant="secondary" disabled={act.busy} onClick={() => setEditing(true)}>Edit draft</Button>
                {r.status === "DRAFT" ? <Button variant="ghost" disabled={act.busy} onClick={() => setHolding(true)}>Hold</Button> : null}
              </div>
            )}
          </>
        ) : r.editorNote ? (
          <div className="rounded-l bg-surface-2 p-4 text-[14px] leading-5">
            <div className="vx-eyebrow mb-1 text-ink-2">Editor notes</div>
            {r.editorNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminWeeklyPage() {
  return (
    <Gated page="weekly">
      <WeeklyBody />
    </Gated>
  );
}
