"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Banner, Button, Dialog, EmptyState, Icon } from "@/components/vx";
import { getSurveyFreeAnswers, getSurveyReport, hideSurveyFreeAnswer, releaseSurvey } from "@/lib/api/admin-surveys";
import type { SurveyFreeAnswers, SurveyFreeItem, SurveyReport } from "@/lib/api/admin-surveys";
import { ApiError } from "@/lib/api/client";
import { dayMonth, slot } from "./time";
import { csvFileName, isReleased, reportToCsv, scrub, showsPeople } from "./survey-csv";
import { Card, CardTitle, ErrorLine, Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead, SavedLine, refusalWords, useAction } from "./ui";

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

const num = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n.toLocaleString("en-NG"));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "-" : `${n}%`);
const people = (n: number) => `${n.toLocaleString("en-NG")} ${n === 1 ? "person has" : "people have"} answered so far`;

function span(r: SurveyReport): string {
  return [r.survey.startsOn, r.survey.endsOn].filter(Boolean).map((d) => dayMonth(d + "T12:00:00+01:00")).join(" to ");
}

/** Running, or not live: how many have answered, and when the results will be ready. Nothing else exists to show. */
function RunningStage({ r }: { r: SurveyReport }) {
  const s = r.survey;
  const ends = s.endsOn ? dayMonth(s.endsOn + "T12:00:00+01:00") : null;
  const when =
    ends && s.responseTarget
      ? `The results are ready when the survey ends on ${ends}, or when ${num(s.responseTarget)} people have answered, whichever comes first.`
      : ends
        ? `The results are ready when the survey ends on ${ends}.`
        : s.responseTarget
          ? `The results are ready when ${num(s.responseTarget)} people have answered.`
          : "The results are ready when the survey ends.";
  return (
    <Card>
      <div data-testid="stage-running" className="flex flex-col gap-3">
        <Eyebrow>{r.stage === "NOT_LIVE" ? "Not live" : "Running"}</Eyebrow>
        <p className="m-0 font-display text-display-m" data-testid="answered-so-far">{people(r.answeredSoFar ?? 0)}</p>
        <p className="m-0 text-body text-ink-2">{r.stage === "NOT_LIVE" ? "This survey is not live, so nobody can answer it yet. " : ""}{when}</p>
        <p className="m-0 text-caption text-ink-2">Choices, shares and written answers are fixed when the survey is over. They are not worked out while it runs.</p>
      </div>
    </Card>
  );
}

/** Over, not released: staff read every free answer, hide what should not go to the brand, then release. */
function ReviewStage({ id, r, onReleased }: { id: string; r: SurveyReport; onReleased: () => void }) {
  const [data, setData] = useState<SurveyFreeAnswers | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const rel = useAction();
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getSurveyFreeAnswers(id));
    } catch (e) {
      setError(e as Error);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  // The next page of the list. The server counts the list as read only when its last page has been served, so the pages are walked in order.
  async function more() {
    const cursor = data?.nextCursor;
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    setMoreError(null);
    try {
      const page = await getSurveyFreeAnswers(id, cursor);
      setData((d) => (d ? { ...page, items: [...d.items, ...page.items], hiddenCount: Math.max(d.hiddenCount, page.hiddenCount) } : page));
    } catch (e) {
      setMoreError(refusalWords(e));
    } finally {
      setMoreBusy(false);
    }
  }
  const allRead = !!data && !data.nextCursor;

  async function toggle(item: SurveyFreeItem) {
    if (busyId) return;
    setBusyId(item.id);
    setRowError(null);
    try {
      const out = await hideSurveyFreeAnswer(id, item.id, !item.hidden);
      setData((d) => {
        if (!d) return d;
        const items = d.items.map((x) => (x.id === item.id ? { ...x, hidden: out.hidden } : x));
        const was = d.items.find((x) => x.id === item.id)?.hidden ?? false;
        return { ...d, items, hiddenCount: Math.max(0, d.hiddenCount + (out.hidden === was ? 0 : out.hidden ? 1 : -1)) };
      });
    } catch (e) {
      setRowError(refusalWords(e));
    } finally {
      setBusyId(null);
    }
  }

  async function release() {
    const out = await rel.run(() => releaseSurvey(id));
    setConfirm(false);
    if (out) onReleased();
  }

  const groups: { questionId: string; prompt: string; items: SurveyFreeItem[] }[] = [];
  for (const it of data?.items ?? []) {
    let g = groups.find((x) => x.questionId === it.questionId);
    if (!g) groups.push((g = { questionId: it.questionId, prompt: it.prompt, items: [] }));
    g.items.push(it);
  }

  return (
    <div className="flex flex-col gap-5" data-testid="stage-review">
      <Card>
        <Eyebrow>Review before release</Eyebrow>
        <p className="m-0 mt-1 font-display text-display-m">{people(r.answeredSoFar ?? 0).replace(" so far", "")}</p>
        <p className="m-0 mt-2 text-body text-ink-2">The survey is over and its results are fixed. Read every written answer and transcript below. Hide any that should not go to the brand, then release the results. Nothing reaches the brand until you release.</p>
        <p className="m-0 mt-2 text-caption text-ink-2">The server removes emails, links, handles and numbers. A name or address written in plain words cannot be found by a pattern, so read each one.</p>
      </Card>

      {error ? (
        error instanceof ApiError && error.status === 409 ? (
          <Banner tone="info" title="Not ready to review yet">{error.message}</Banner>
        ) : (
          <LoadFailed error={error} retry={load} />
        )
      ) : !data ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="m-0 text-body-strong" data-testid="hidden-count">{`${data.hiddenCount} of ${data.total} hidden`}</p>
            <Button icon="send" disabled={rel.busy || !allRead} onClick={() => setConfirm(true)}>Release the results</Button>
          </div>
          {!allRead ? <p className="m-0 text-caption text-ink-2" data-testid="read-first">Read the written answers before releasing the results.</p> : null}
          <ErrorLine>{rowError}</ErrorLine>
          <ErrorLine>{rel.error}</ErrorLine>
          {data.items.length === 0 ? (
            <p className="m-0 rounded-l bg-surface-2 p-4 text-body text-ink-2" data-testid="review-empty">There are no written or voice answers to read. You can release the results.</p>
          ) : (
            groups.map((g) => (
              <Card key={g.questionId}>
                <CardTitle>{g.prompt}</CardTitle>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {g.items.map((it) => (
                    <li key={it.id} className={`flex items-start gap-3 rounded-m bg-surface-2 p-3 text-body ${it.hidden ? "opacity-60" : ""}`}>
                      {it.kind === "VOICE" ? <Icon name="mic" size={18} className="mt-1 flex-none" /> : null}
                      <span className="min-w-0 flex-1 break-words">
                        {it.hidden ? <b className="mr-2 text-caption text-ink-2">Hidden</b> : null}
                        {it.text}
                      </span>
                      {it.kind === "VOICE" && it.seconds !== null ? <span className="text-caption text-ink-2 tabular-nums">{`${it.seconds}s`}</span> : null}
                      <Button variant="secondary" size="s" disabled={busyId !== null} loading={busyId === it.id} onClick={() => toggle(it)} aria-label={`${it.hidden ? "Show" : "Hide"}: ${it.text.slice(0, 40)}`}>
                        {it.hidden ? "Show" : "Hide"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
          {data.nextCursor ? (
            <div className="flex flex-col items-start gap-2">
              <p className="m-0 text-caption text-ink-2" data-testid="loaded-count">{`${data.items.length} of ${data.total} shown`}</p>
              <Button variant="secondary" loading={moreBusy} disabled={moreBusy} onClick={() => void more()}>Show more answers</Button>
              <ErrorLine>{moreError}</ErrorLine>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={confirm}
        title="Release the results?"
        confirmLabel={rel.busy ? "Releasing" : "Release the results"}
        cancelLabel="Not yet"
        onClose={() => setConfirm(false)}
        onConfirm={release}
      >
        {`The brand's results are fixed from this moment and cannot be changed. The "results ready" email goes to the brand's contact${data ? `. ${data.hiddenCount} written or voice ${data.hiddenCount === 1 ? "answer stays" : "answers stay"} hidden` : ""}.`}
      </Dialog>
    </div>
  );
}

/** Released: the stored report, as the server gives it. */
function ReleasedStage({ r }: { r: SurveyReport }) {
  const t = r.totals;
  const full = showsPeople(r);
  const floor = r.minGroupSize ?? 20;
  // A breakdown the server left out whole is not drawn at all, not even an empty frame.
  const hasState = (r.byState ?? []).length > 0 || !!r.byStateOther;
  const hasAge = (r.byAgeBand ?? []).length > 0 || !!r.byAgeBandOther;
  return (
    <div className="flex flex-col gap-5" data-testid="stage-released">
      {r.releasedAt ? <p className="m-0 text-caption text-ink-2" data-testid="released-at">{`Released on ${slot(r.releasedAt)}. These results are fixed.`}</p> : null}
      {!full ? (
        <div data-testid="below-minimum">
          <Banner tone="info" title={`Fewer than ${floor} answers so far`}>
            {`Nothing about the people who answered is shown until ${floor} have answered. Only the counts below are.`}
          </Banner>
        </div>
      ) : null}

      <div className={`grid gap-4 ${full ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"}`}>
        <Stat label="Seen" value={num(t?.views)} />
        <Stat label="Started" value={num(t?.starts)} />
        <Stat label="Skipped" value={num(t?.skips)} />
        {full ? (
          <>
            <Stat label="Answered" value={num(t?.responses)} />
            <Stat label="Finished" value={pct(t?.completionRate)} />
          </>
        ) : null}
      </div>

      {full ? (
        <>
          {(r.questions ?? []).map((q) => (
            <Card key={q.id}>
              <Eyebrow>{`Question ${q.position} · ${KIND_WORDS[q.kind]}`}</Eyebrow>
              <CardTitle>{q.prompt}</CardTitle>
              {q.answered === null || q.answered === undefined ? <p className="m-0 text-body text-ink-2" data-testid="too-few">Too few answers to show</p> : <p className="m-0 mb-3 text-caption text-ink-2">{`${num(q.answered)} answered this question`}</p>}
              {q.answered === null || q.answered === undefined ? null : q.kind === "SINGLE_CHOICE" ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {q.options.map((o) => (
                    <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1">
                      <span className="text-body-strong">{o.label}</span>
                      {o.hidden ? (
                        <span className="text-caption text-ink-2">{`Fewer than ${floor} answers, not shown`}</span>
                      ) : (
                        <span className="text-body-strong tabular-nums">{`${num(o.count)} · ${pct(o.share)}`}</span>
                      )}
                      <div className="col-span-2 h-3 overflow-hidden rounded-pill bg-surface-2" aria-hidden="true">
                        <div className="h-full rounded-pill bg-green" style={{ width: `${o.hidden || o.share === null ? 0 : Math.min(100, o.share)}%` }} />
                      </div>
                    </li>
                  ))}
                  {q.other ? (
                    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1" data-testid="other-line">
                      <span className="text-body-strong">{q.other.label}</span>
                      <span className="text-body-strong tabular-nums">{`${num(q.other.count)} · ${pct(q.other.share)}`}</span>
                      <div className="col-span-2 h-3 overflow-hidden rounded-pill bg-surface-2" aria-hidden="true">
                        <div className="h-full rounded-pill bg-green" style={{ width: `${Math.min(100, q.other.share)}%` }} />
                      </div>
                    </li>
                  ) : null}
                </ul>
              ) : q.kind === "TEXT" ? (
                q.texts.length ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {q.texts.map((x, i) => <li key={i} className="rounded-m bg-surface-2 p-3 text-body">{scrub(x)}</li>)}
                  </ul>
                ) : <p className="m-0 text-body text-ink-2">No written answers to show.</p>
              ) : q.voices.length ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {q.voices.map((v, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-m bg-surface-2 p-3 text-body">
                      <Icon name="mic" size={18} className="mt-1 flex-none" />
                      <span className="min-w-0 flex-1">{scrub(v.transcript)}</span>
                      <span className="text-caption text-ink-2 tabular-nums">{`${v.seconds}s`}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="m-0 text-body text-ink-2">No voice answers to show.</p>}
            </Card>
          ))}

          {hasState || hasAge ? <div className={`grid gap-5 ${hasState && hasAge ? "grid-cols-2" : "grid-cols-1"}`}>
            {hasState ? (
            <Card>
              <CardTitle>By state</CardTitle>
              <p className="m-0 mb-3 text-caption text-ink-2">Only people who chose to share their state.</p>
              {(r.byState ?? []).length || r.byStateOther ? (
                <table className="w-full border-collapse text-left text-body">
                  <thead><tr className="text-ink-2"><th className="vx-eyebrow py-2">State</th><th className="vx-eyebrow py-2 text-right">Answers</th><th className="vx-eyebrow py-2 text-right">Share</th></tr></thead>
                  <tbody>
                    {(r.byState ?? []).map((s) => <tr key={s.state} className="border-t border-line"><td className="py-2">{s.state}</td><td className="py-2 text-right tabular-nums">{s.responses}</td><td className="py-2 text-right tabular-nums">{`${s.share}%`}</td></tr>)}
                    {r.byStateOther ? <tr className="border-t border-line"><td className="py-2">Other</td><td className="py-2 text-right tabular-nums">{r.byStateOther.responses}</td><td className="py-2 text-right tabular-nums">{`${r.byStateOther.share}%`}</td></tr> : null}
                  </tbody>
                </table>
              ) : null}
            </Card>
            ) : null}
            {hasAge ? (
            <Card>
              <CardTitle>By age band</CardTitle>
              <p className="m-0 mb-3 text-caption text-ink-2">Only people who chose to share their age band.</p>
              {(r.byAgeBand ?? []).length || r.byAgeBandOther ? (
                <table className="w-full border-collapse text-left text-body">
                  <thead><tr className="text-ink-2"><th className="vx-eyebrow py-2">Age band</th><th className="vx-eyebrow py-2 text-right">Answers</th><th className="vx-eyebrow py-2 text-right">Share</th></tr></thead>
                  <tbody>
                    {(r.byAgeBand ?? []).map((a) => <tr key={a.ageBand} className="border-t border-line"><td className="py-2">{a.ageBand}</td><td className="py-2 text-right tabular-nums">{a.responses}</td><td className="py-2 text-right tabular-nums">{`${a.share}%`}</td></tr>)}
                    {r.byAgeBandOther ? <tr className="border-t border-line"><td className="py-2">Other</td><td className="py-2 text-right tabular-nums">{r.byAgeBandOther.responses}</td><td className="py-2 text-right tabular-nums">{`${r.byAgeBandOther.share}%`}</td></tr> : null}
                  </tbody>
                </table>
              ) : null}
            </Card>
            ) : null}
          </div> : null}
        </>
      ) : null}
    </div>
  );
}

function ResultsBody({ id }: { id: string }) {
  const [r, setR] = useState<SurveyReport | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [justReleased, setJustReleased] = useState(false);
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

  const back = <Link href="/admin/surveys" className="inline-flex min-h-[44px] items-center text-label text-green-text">Back to Sponsored Surveys</Link>;
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

  const released = isReleased(r);
  return (
    <div className="flex flex-col gap-5">
      {back}
      <PageHead
        eyebrow={`Results for the brand · ${r.survey.brandName}`}
        title={r.survey.title}
        sub={span(r) || undefined}
        right={released ? <Button icon="file-down" onClick={() => saveCsv(r)}>Save as CSV</Button> : undefined}
      />
      {justReleased ? <SavedLine>Released. The results are fixed and the brand is told by email.</SavedLine> : null}
      {released ? (
        <ReleasedStage r={r} />
      ) : r.stage === "REVIEW" ? (
        <ReviewStage id={id} r={r} onReleased={() => { setJustReleased(true); void load(); }} />
      ) : (
        <RunningStage r={r} />
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
