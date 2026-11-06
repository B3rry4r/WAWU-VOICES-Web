"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, EmptyState, Icon, Poll, ShareCard, Skeleton, WeeklyReportCard } from "@/components/vx";
import { getLatestWeeklyReport, getPollResults, getWeeklyReport } from "@/lib/api/reach";
import type { PollResults, WeeklyReport } from "@/lib/api/reach";
import { ApiError } from "@/lib/api/client";
import { ShareSheet } from "@/features/share";
import { AppBar, lagosDay, lagosPublished, useSignedIn } from "./shared";
import { cardRows, moodRows, readPollSummary, readThemes } from "./weekly-map";

type Load = "loading" | "error" | "none" | "ready";

const PastLink = ({ className }: { className?: string }) => (
  <Link href="/weekly/archive" className={"inline-flex items-center gap-1 text-label text-green-text no-underline hover:text-ink " + (className ?? "")}>
    <Icon name="clock" size={20} />
    Past reports
  </Link>
);

/** /weekly (the latest published report) and /weekly/[reportId]. Guests read it too. */
export function WeeklyPage({ reportId }: { reportId?: string }) {
  const signedIn = useSignedIn();
  const [load, setLoad] = useState<Load>("loading");
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [poll, setPoll] = useState<PollResults | null>(null);
  const [share, setShare] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    setLoad("loading");
    (reportId ? getWeeklyReport(reportId) : getLatestWeeklyReport())
      .then(async (r) => {
        if (stop) return;
        setReport(r);
        setLoad("ready");
        const id = readPollSummary(r.pollSummary)?.pollId;
        setPoll(null);
        if (id) {
          try {
            const p = await getPollResults(id);
            if (!stop) setPoll(p);
          } catch {
            /* the poll in full is left out when it cannot be read */
          }
        }
      })
      .catch((e) => {
        if (stop) return;
        setLoad(e instanceof ApiError && e.status === 404 ? "none" : "error");
      });
    return () => { stop = true; };
  }, [reportId, tick, signedIn]);

  const header = (
    <>
      <AppBar href={reportId ? "/weekly/archive" : "/discover"} backLabel="Back" title="Weekly report" right={<PastLink />} />
      <div className="hidden items-end justify-between gap-4 pb-4 dt:flex">
        <div className="min-w-0">
          {report ? <span className="vx-eyebrow text-green-text">{report.title}</span> : null}
          <h1 className="m-0 font-display text-display-l dt:text-display-xl">Weekly report</h1>
        </div>
        <PastLink />
      </div>
    </>
  );

  if (load === "loading") {
    return (
      <div>
        {header}
        <Skeleton variant="tile" />
      </div>
    );
  }
  if (load === "error") {
    return (
      <div>
        {header}
        <EmptyState icon="wifi-off" title="We could not load the report" body="Check your connection and try again." action="Try again" actionIcon="refresh-cw" onAction={() => setTick((n) => n + 1)} />
      </div>
    );
  }
  if (load === "none" || !report) {
    return (
      <div>
        {header}
        <EmptyState icon="chart-column" title="No weekly report yet" body="The first report goes out after the first week’s poll closes." />
      </div>
    );
  }

  const summary = readPollSummary(report.pollSummary);
  const themes = readThemes(report.themes);
  const published = `Published ${lagosPublished(report.publishedAt)}.`;
  const rows = cardRows(report, poll);
  const weekLine = `Week ${report.weekNumber} · ${report.range}`;

  return (
    <div className="flex flex-col gap-5">
      {header}
      <div>
        <WeeklyReportCard
          week={weekLine}
          moodLine={report.mood ?? ""}
          mood={moodRows(report)}
          themes={themes}
          poll={summary ? { pct: summary.pct, text: summary.text } : undefined}
          voices={report.basedOnVoices}
          votes={report.basedOnVotes}
          updated={published}
          onShare={() => setShare(true)}
        />
      </div>

      <div className={"grid gap-5 dt:items-start " + "dt:grid-cols-2"}>
        {poll ? (
          <section className="flex flex-col gap-2" aria-label="The poll in full">
            <h2 className="vx-eyebrow m-0 text-ink-2">The poll in full</h2>
            <Poll question={summary?.title ?? "Poll results"} options={poll.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes ?? 0 }))} total={poll.totalVotes} state="results" live={false} onExplain={false} />
          </section>
        ) : null}
        {report.quotes.length ? (
          <section className="flex flex-col gap-3" aria-label="In their own words">
            <h2 className="vx-eyebrow m-0 text-ink-2">In their own words</h2>
            {report.quotes.map((q, i) => (
              <figure key={i} className="m-0 flex flex-col gap-2 rounded-l bg-surface p-4 shadow-1">
                <blockquote className="m-0 text-body text-ink">{`"${q.excerpt}"`}</blockquote>
                <figcaption className="text-caption text-ink-2">{q.placeLabel + " · shared with consent"}</figcaption>
              </figure>
            ))}
            <p className="m-0 hidden text-caption text-ink-2 dt:block">Quotes are shared only with the speaker’s consent. No names, no handles, and no group too small to stay anonymous.</p>
          </section>
        ) : null}
      </div>

      <section className="flex flex-col gap-3 dt:flex-row dt:items-center dt:gap-6 dt:rounded-l dt:bg-surface dt:p-6 dt:shadow-1" aria-label="Share this week">
        <div className="dt:w-1/2">
          <ShareCard
            kind="weekly"
            topic={`Week ${report.weekNumber} report`}
            question={report.mood ?? report.title}
            poll={rows}
            summary={summary ? firstSentence(summary.text) : undefined}
            voices={report.basedOnVoices}
            updated={lagosDay(report.publishedAt)}
          />
        </div>
        <div className="flex flex-col gap-3 dt:w-1/2">
          <h2 className="m-0 font-display text-display-m dt:text-display-l">Share this week</h2>
          <p className="m-0 hidden text-body text-ink-2 dt:block">The card carries the mood, the poll and a link back to the full report. Journalists and brands can quote it with the label.</p>
          <div>
            <Button icon="share-2" onClick={() => setShare(true)}>Share the card</Button>
          </div>
        </div>
      </section>

      {share ? <ShareSheet objectType="WEEKLY_REPORT" objectId={report.id} onClose={() => setShare(false)} /> : null}
    </div>
  );
}

function firstSentence(t: string): string {
  const m = /^[^.!?]*[.!?]/.exec(t);
  return m ? m[0] : t;
}
