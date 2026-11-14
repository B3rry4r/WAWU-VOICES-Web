"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Icon, TextField, TopicChip, WeeklyReportCard } from "@/components/vx";
import { approveWeekly, editWeekly, holdWeekly, listWeekly, weeklyInstagramZip } from "@/lib/api/admin";
import type { AdminWeeklyReport, Emotion } from "@/lib/api/admin";
import { readPollSummary, readThemes } from "@/features/reach/weekly-map";
import { useAdmin } from "./AdminFrame";
import { published } from "@/lib/format/date";
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
          <EmptyState icon="chart-column" title="No draft yet" body="The report drafts itself after the week’s poll closes." />
        </>
      ) : (
        <>
          <PageHead
            eyebrow={`Week ${report.weekNumber} · drafted ${slot(report.draftedAt)}${report.pollClosedAt ? ", after the poll closed" : ""}`}
            title={report.status === "PUBLISHED" ? "Weekly report" : "Weekly report approval"}
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
  const [rows, setRows] = useState<{ name: string; share: string; change: string }[]>(r.emotions.map((e) => ({ name: e.name, share: String(e.share), change: String(e.change) })));
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

  const emotions: Emotion[] = rows
    .filter((x) => x.name.trim())
    .map((x) => ({ name: x.name.trim(), share: Math.min(100, Math.max(0, Number(x.share) || 0)), change: Math.min(100, Math.max(-100, Number(x.change) || 0)) }));
  const setRow = (i: number, k: "name" | "share" | "change", v: string) => setRows((o) => o.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function saveEdit() {
    const out = await act.run(() => editWeekly(r.id, { cardTitle: f.cardTitle || undefined, headline: f.headline, mood: f.mood, summary: f.summary, emotions, editorNote: notes || undefined }));
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
  async function downloadPictures() {
    setSaved(null);
    const blob = await act.run(() => weeklyInstagramZip(r.id));
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `voices-week-${r.weekNumber}-instagram.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setSaved("The pictures are saved. Nothing has been posted.");
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
        <div className="vx-eyebrow mb-2 text-ink-2">{r.status === "PUBLISHED" ? "Published, reviewed by a person" : r.status === "APPROVED" ? "Approved, publishes at its time" : "AI draft, edit before publishing"}</div>
        <div className="ad-report">
          {editing ? (
            <Card className="flex flex-col gap-4">
              <TextField label="Card title" value={f.cardTitle} onChange={(v) => setF({ ...f, cardTitle: v })} placeholder="What Nigerians said this week" />
              <TextField label="Mood headline" value={f.headline} onChange={(v) => setF({ ...f, headline: v })} />
              <TextField label="Mood line" value={f.mood} onChange={(v) => setF({ ...f, mood: v })} />
              <TextField label="Summary" multiline value={f.summary} onChange={(v) => setF({ ...f, summary: v })} />
              <fieldset className="m-0 border-0 p-0" aria-label="Leading emotions">
                <legend className="vx-eyebrow mb-1 text-ink-2">Leading emotions</legend>
                <p className="m-0 mb-3 text-caption text-ink-2">Drawn from this week’s mood answers. Share is the percent of people; change is the move in points since last week. These rows are the mood bars here, on the weekly page and on the Instagram pictures.</p>
                <div className="flex flex-col gap-3">
                  {rows.map((x, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3">
                      <TextField label={`Emotion ${i + 1}`} value={x.name} onChange={(v) => setRow(i, "name", v)} maxLength={40} />
                      <TextField label="Share (%)" inputMode="numeric" value={x.share} onChange={(v) => setRow(i, "share", v)} />
                      <TextField label="Change (points)" inputMode="numeric" value={x.change} onChange={(v) => setRow(i, "change", v)} />
                      <Button size="s" variant="ghost" onClick={() => setRows((o) => o.filter((_, j) => j !== i))}>Remove</Button>
                    </div>
                  ))}
                  {rows.length < 8 ? (
                    <div>
                      <Button size="s" variant="secondary" icon="plus" onClick={() => setRows((o) => [...o, { name: "", share: "0", change: "0" }])}>Add an emotion</Button>
                    </div>
                  ) : null}
                  {rows.length === 0 ? <p className="m-0 text-caption text-ink-2">No emotions yet. Too few people answered the mood question, or no mood question ran this week.</p> : null}
                </div>
              </fieldset>
              <ErrorLine>{act.error}</ErrorLine>
              <div className="flex gap-3">
                <Button icon="check" loading={act.busy} onClick={saveEdit}>Save draft</Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </Card>
          ) : (
            <WeeklyReportCard
              week={`Week ${r.weekNumber}${r.publishAt ? ` · ${r.status === "PUBLISHED" ? "published" : "publishes"} ${dayMonth(r.publishAt)}` : ""}`}
              title={r.cardTitle ?? "What Nigerians said this week"}
              moodLine={r.mood ?? r.headline ?? ""}
              summary={r.summary ?? undefined}
              mood={r.emotions.map((e) => ({ label: e.name, pct: Math.round(e.share), delta: Math.round(e.change) }))}
              themes={themes}
              poll={summary ? { pct: summary.pct, text: summary.text } : undefined}
              voices={r.basedOnVoices}
              votes={r.basedOnVotes}
              updated={r.publishAt ? `${r.status === "PUBLISHED" ? "Published" : "Publishes"} ${published(r.publishAt)}.` : undefined}
            />
          )}
        </div>
        <Card className="mt-5">
          <CardTitle>The poll by state</CardTitle>
          {r.regions && r.regions.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body">
              {r.regions.map((g) => (
                <li key={g.state} className="flex items-baseline justify-between gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0">
                  <span>{g.state}</span>
                  <span className="text-caption text-ink-2">{`${g.percent}% ${g.leading} (${g.votes.toLocaleString("en-NG")} votes)`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-body text-ink-2">No state had enough votes to show without naming people, or voters have not given a state. Nothing is shown on the public report.</p>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardTitle>Checks</CardTitle>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-body">
                <Icon name={c.ok ? "circle-check" : "triangle-alert"} size={22} className={`mt-0.5 flex-none ${c.ok ? "text-success" : "text-warning"}`} label={c.ok ? "Passed" : "Needs a look"} />
                {c.text}
              </li>
            ))}
            {r.checks.length === 0 ? <li className="text-ink-2">No checks have run yet.</li> : null}
          </ul>
          <dl className="m-0 mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-4 text-caption">
            <dt className="text-ink-2">Based on</dt>
            <dd className="m-0">{`${r.basedOnVoices.toLocaleString("en-NG")} ${r.basedOnVoices === 1 ? "voice" : "voices"} and ${r.basedOnVotes.toLocaleString("en-NG")} ${r.basedOnVotes === 1 ? "vote" : "votes"}`}</dd>
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

        {r.status === "PUBLISHED" ? (
          <div className="flex flex-col gap-2">
            <ErrorLine>{act.error}</ErrorLine>
            <div>
              <Button icon="share-2" variant="secondary" loading={act.busy} disabled={act.busy} onClick={downloadPictures}>Download Instagram pictures</Button>
            </div>
            <p className="m-0 text-caption text-ink-2">A set of pictures drawn from the approved report: the posts at 1080 by 1350 and a Story at 1080 by 1920. You post them yourself.</p>
          </div>
        ) : null}

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
          <div className="rounded-l bg-surface-2 p-4 text-caption">
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
