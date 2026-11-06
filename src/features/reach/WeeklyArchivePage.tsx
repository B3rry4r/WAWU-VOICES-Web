"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, EmptyState, Icon, Skeleton } from "@/components/vx";
import { fmt } from "@/components/vx/helpers";
import { listWeeklyReports } from "@/lib/api/reach";
import type { WeeklyReportCard } from "@/lib/api/reach";
import { AppBar, lagosSlot, monthOf, useSignedIn } from "./shared";

type Load = "loading" | "error" | "ready";

const counts = (r: WeeklyReportCard) => `${fmt(r.basedOnVoices)} ${r.basedOnVoices === 1 ? "voice" : "voices"} · ${fmt(r.basedOnVotes)} ${r.basedOnVotes === 1 ? "vote" : "votes"}`;

/** /weekly/archive: every published report, newest first, the latest on top in green, the rest under their month. */
export function WeeklyArchivePage() {
  const signedIn = useSignedIn();
  const [load, setLoad] = useState<Load>("loading");
  const [latest, setLatest] = useState<WeeklyReportCard | null>(null);
  const [items, setItems] = useState<WeeklyReportCard[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    setLoad("loading");
    listWeeklyReports()
      .then((a) => {
        if (stop) return;
        setLatest(a.latest);
        setItems(a.items.filter((r) => r.id !== a.latest?.id));
        setNext(a.nextCursor);
        setNextAt(a.nextPublishAt);
        setLoad("ready");
      })
      .catch(() => { if (!stop) setLoad("error"); });
    return () => { stop = true; };
  }, [tick, signedIn]);

  async function loadMore() {
    if (!next) return;
    setMore(true);
    setMoreFailed(false);
    try {
      const a = await listWeeklyReports({ cursor: next });
      setItems((old) => old.concat(a.items));
      setNext(a.nextCursor);
    } catch {
      setMoreFailed(true);
    } finally {
      setMore(false);
    }
  }

  const bar = <AppBar href="/weekly" backLabel="Back" title="Weekly report" />;
  const head = (
    <div className="flex flex-col gap-2 pb-4">
      <h1 className="m-0 font-display text-display-l dt:text-display-xl">Past reports</h1>
      <p className="m-0 text-body text-ink-2">One report a week, from the week’s poll and voices. Each is AI-assisted and checked by a WAWU editor before it goes out.</p>
    </div>
  );

  if (load === "loading") return <div>{bar}{head}<Skeleton variant="tile" /></div>;
  if (load === "error") {
    return (
      <div>
        {bar}
        {head}
        <EmptyState icon="wifi-off" title="We could not load the reports" body="Check your connection and try again." action="Try again" actionIcon="refresh-cw" onAction={() => setTick((n) => n + 1)} />
      </div>
    );
  }

  const groups: { month: string; rows: WeeklyReportCard[] }[] = [];
  for (const r of items) {
    const m = monthOf(r.publishedAt);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.rows.push(r);
    else groups.push({ month: m, rows: [r] });
  }

  return (
    <div className="flex flex-col gap-4">
      {bar}
      {head}
      {nextAt ? (
        <p className="m-0 flex items-start gap-2 rounded-m bg-info-bg p-3 text-label text-info">
          <Icon name="clock" size={20} className="mt-px flex-none" />
          <span>{`Week ${(latest?.weekNumber ?? items[0]?.weekNumber ?? 0) + 1} publishes ${lagosSlot(nextAt)}`}<span className="dt:hidden">, after the poll closes.</span></span>
        </p>
      ) : null}
      {!latest && items.length === 0 ? (
        <EmptyState icon="chart-column" title="No reports yet" body="The first report goes out after the first week’s poll closes." />
      ) : null}
      {latest ? (
        <article className="flex flex-col gap-3 rounded-xl bg-forest p-5 text-forest-on" aria-label="Latest report">
          <span className="vx-eyebrow text-sun">{`Latest · Week ${latest.weekNumber} · ${latest.range}`}</span>
          <h2 className="m-0 font-display text-display-m"><Link href={`/weekly/${latest.id}`} className="text-inherit no-underline hover:underline">{latest.title}</Link></h2>
          {latest.mood ? <p className="m-0 text-body text-[color:var(--on-forest-2)]">{"The mood: " + lower(latest.mood)}</p> : null}
          <span className="text-caption text-[color:var(--on-forest-2)]">{counts(latest)}</span>
        </article>
      ) : null}
      {groups.map((g) => (
        <section key={g.month} className="flex flex-col gap-2" aria-label={g.month}>
          <h3 className="vx-eyebrow m-0 text-ink-2 dt:hidden">{g.month}</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {g.rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-l bg-surface p-4 shadow-1">
                <span className="vx-eyebrow text-ink-2">{`Week ${r.weekNumber} · ${r.range}`}</span>
                <h4 className="m-0 font-display text-display-m"><Link href={`/weekly/${r.id}`} className="text-inherit no-underline hover:underline">{r.title}</Link></h4>
                {r.mood ? <p className="m-0 text-body text-ink"><span className="dt:hidden">{r.mood}</span><span className="hidden dt:inline">{"The mood: " + lower(r.mood)}</span></p> : null}
                <span className="text-caption text-ink-2">{counts(r)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {next ? (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" loading={more} onClick={() => void loadMore()}>Show older reports</Button>
          {moreFailed ? <p className="m-0 text-caption text-danger" role="alert">Could not load more. Try again.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** "Tired of showing off" after "The mood: ": the board lowercases the first letter of the mood line. */
function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
