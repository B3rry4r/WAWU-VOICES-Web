"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/vx";
import { listResultThreads } from "@/lib/api/results";

const CARD = "flex items-center gap-3 rounded-[var(--radius-l)] bg-[var(--surface)] p-4 text-[var(--ink)] no-underline shadow-[inset_0_0_0_1px_var(--line)]";

/** The weekly report on a phone. Desktop has it in the side bar, and phone has no room for a sixth tab, so Home and Discover carry this row. */
export function WeeklyReportLink({ className }: { className?: string }) {
  return (
    <Link href="/weekly" className={`${CARD} ${className ?? ""}`}>
      <Icon name="chart-column" size={24} />
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <b className="font-display text-display-s">Weekly report</b>
        <span className="text-caption text-[var(--ink-2)]">What Nigeria said this week, and how the poll ended.</span>
      </span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

/** A link to the live results thread while it is open, where people post the numbers they see. Shows nothing when no thread is open. */
export function LiveResultsLink({ className }: { className?: string }) {
  const [t, setT] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    let live = true;
    listResultThreads().then(
      (p) => { const o = p.items.find((x) => x.status === "OPEN"); if (live && o) setT({ id: o.id, title: o.title }); },
      () => undefined,
    );
    return () => { live = false; };
  }, []);
  if (!t) return null;
  return (
    <Link href={`/live/${t.id}`} className={`${CARD} ${className ?? ""}`} data-testid="live-results-link">
      <Icon name="radio" size={24} />
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <b className="font-display text-display-s">Live results</b>
        <span className="text-caption text-[var(--ink-2)]">{`${t.title}. See the numbers people post, or post yours.`}</span>
      </span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}
