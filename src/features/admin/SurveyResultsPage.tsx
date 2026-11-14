"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Banner, Button, EmptyState, Icon } from "@/components/vx";
import { getSurveyReport } from "@/lib/api/admin-surveys";
import type { SurveyReport } from "@/lib/api/admin-surveys";
import { ApiError } from "@/lib/api/client";
import { dayMonth } from "./time";
import { csvFileName, reportToCsv } from "./survey-csv";
import { Card, CardTitle, Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead } from "./ui";

const KIND_WORDS = { SINGLE_CHOICE: "Pick one choice", TEXT: "Short written answer", VOICE: "Short voice answer" } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-l bg-surface-2 p-4">
      <div className="text-caption text-ink-2">{label}</div>
      <div className="font-display text-num-l tabular-nums">{value}</div>
    </div>
  );
}

/** Saves the CSV the report page is built from. Nothing leaves the browser. */
export function saveCsv(r: SurveyReport): void {
  const blob = new Blob([reportToCsv(r)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFileName(r);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ResultsBody({ id }: { id: string }) {
  const [r, setR] = useState<SurveyReport | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setR(await getSurveyReport(id));
    } catch (e) {
      setError(e as Error);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const back = <Link href="/admin/surveys" className="text-label text-green-text">Back to Sponsored Surveys</Link>;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <EmptyState icon="compass" title="We could not find that survey" body="Go back to the list and pick another." />;
    }
    return (
      <div className="flex flex-col gap-4">
        {back}
        <LoadFailed error={error} retry={load} />
      </div>
    );
  }
  if (!r) return <ListSkeleton />;

  const pct = (n: number | null) => (n === null ? "-" : `${n}%`);
  const num = (n: number | null) => (n === null ? "-" : n.toLocaleString("en-NG"));
  const span = [r.survey.startsOn, r.survey.endsOn].filter(Boolean).map((d) => dayMonth(d + "T12:00:00+01:00")).join(" to ");

  return (
    <div className="flex flex-col gap-5">
      {back}
      <PageHead
        eyebrow={`Results for the brand · ${r.survey.brandName}`}
        title={r.survey.title}
        sub={span || undefined}
        right={<Button icon="file-down" onClick={() => saveCsv(r)}>Save as CSV</Button>}
      />

      {r.belowMinimum ? (
        <Banner tone="info" title={`Fewer than ${r.minGroupSize} answers so far`} data-testid="below-minimum">
          {`Nothing about the people who answered is shown until ${r.minGroupSize} have answered. Only the counts below are.`}
        </Banner>
      ) : null}

      <div className={`grid gap-4 ${r.belowMinimum ? "grid-cols-3" : "grid-cols-5"}`}>
        <Stat label="Seen" value={num(r.totals.views)} />
        <Stat label="Started" value={num(r.totals.starts)} />
        <Stat label="Skipped" value={num(r.totals.skips)} />
        {r.belowMinimum ? null : (
          <>
            <Stat label="Answered" value={num(r.totals.responses)} />
            <Stat label="Finished" value={pct(r.totals.completionRate)} />
          </>
        )}
      </div>

      {r.belowMinimum ? null : (
        <>
          {r.questions.map((q) => (
            <Card key={q.id}>
              <Eyebrow>{`Question ${q.position} · ${KIND_WORDS[q.kind]}`}</Eyebrow>
              <CardTitle>{q.prompt}</CardTitle>
              {q.answered !== null ? <p className="m-0 mb-3 text-caption text-ink-2">{`${num(q.answered)} answered this question`}</p> : null}
              {q.kind === "SINGLE_CHOICE" ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {q.options.map((o) => (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1">
                      <span className="text-body-strong">{o.label}</span>
                      {o.hidden ? (
                        <span className="text-caption text-ink-2">{`Fewer than ${r.minGroupSize} answers, not shown`}</span>
                      ) : (
                        <span className="text-body-strong tabular-nums">{`${num(o.count)} · ${pct(o.share)}`}</span>
                      )}
                      <div className="col-span-2 h-3 overflow-hidden rounded-pill bg-surface-2" aria-hidden="true">
                        <div className="h-full rounded-pill bg-green" style={{ width: `${o.hidden || o.share === null ? 0 : Math.min(100, o.share)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : q.kind === "TEXT" ? (
                q.texts.length ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {q.texts.map((t, i) => <li key={i} className="rounded-m bg-surface-2 p-3 text-body">{t}</li>)}
                  </ul>
                ) : <p className="m-0 text-body text-ink-2">No written answers to show.</p>
              ) : q.voices.length ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {q.voices.map((v, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-m bg-surface-2 p-3 text-body">
                      <Icon name="mic" size={18} className="mt-1 flex-none" />
                      <span className="min-w-0 flex-1">{v.transcript}</span>
                      <span className="text-caption text-ink-2 tabular-nums">{`${v.seconds}s`}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="m-0 text-body text-ink-2">No voice answers to show.</p>}
            </Card>
          ))}

          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardTitle>By state</CardTitle>
              <p className="m-0 mb-3 text-caption text-ink-2">Only people who chose to share their state.</p>
              {r.byState.length ? (
                <table className="w-full border-collapse text-left text-body">
                  <thead><tr className="text-ink-2"><th className="vx-eyebrow py-2">State</th><th className="vx-eyebrow py-2 text-right">Answers</th><th className="vx-eyebrow py-2 text-right">Share</th></tr></thead>
                  <tbody>{r.byState.map((s) => <tr key={s.state} className="border-t border-line"><td className="py-2">{s.state}</td><td className="py-2 text-right tabular-nums">{s.responses}</td><td className="py-2 text-right tabular-nums">{`${s.share}%`}</td></tr>)}</tbody>
                </table>
              ) : <p className="m-0 text-body text-ink-2">No state is shown yet.</p>}
            </Card>
            <Card>
              <CardTitle>By age band</CardTitle>
              <p className="m-0 mb-3 text-caption text-ink-2">Only people who chose to share their age band.</p>
              {r.byAgeBand.length ? (
                <table className="w-full border-collapse text-left text-body">
                  <thead><tr className="text-ink-2"><th className="vx-eyebrow py-2">Age band</th><th className="vx-eyebrow py-2 text-right">Answers</th><th className="vx-eyebrow py-2 text-right">Share</th></tr></thead>
                  <tbody>{r.byAgeBand.map((a) => <tr key={a.ageBand} className="border-t border-line"><td className="py-2">{a.ageBand}</td><td className="py-2 text-right tabular-nums">{a.responses}</td><td className="py-2 text-right tabular-nums">{`${a.share}%`}</td></tr>)}</tbody>
                </table>
              ) : <p className="m-0 text-body text-ink-2">No age band is shown yet.</p>}
            </Card>
          </div>
        </>
      )}
      {r.note ? <p className="m-0 text-caption text-ink-2" data-testid="report-note">{r.note}</p> : null}
    </div>
  );
}

export function AdminSurveyResultsPage({ id }: { id: string }) {
  return (
    <Gated page="surveys">
      <ResultsBody id={id} />
    </Gated>
  );
}

