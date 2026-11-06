"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Banner } from "@/components/vx";
import { dayMonth, date as fullDate } from "@/lib/format/date";
import { listNotifications } from "@/lib/api/reach";

/** The end day of a suspension for a banner: "30 Nov", with the year only when it is not this year. */
export function untilLabel(iso: string, now: Date = new Date()): string {
  const thisYear = String(now.getFullYear());
  return fullDate(iso).endsWith(thisYear) ? dayMonth(iso) : fullDate(iso);
}

/** The end day the suspension notice already carries in its title ("Your account is suspended until 13 Nov 2026"). */
export function untilFromNoticeTitle(title: string, now: Date = new Date()): string | null {
  const m = /^Your account is suspended until (.+?)\.?$/.exec(title.trim());
  if (!m) return null;
  const y = ` ${now.getFullYear()}`;
  return m[1].endsWith(y) ? m[1].slice(0, -y.length) : m[1];
}

/**
 * Lead ruling WF-6, 6 Nov (RX2): a suspended person sees this on Home and Profile, so they learn it before a post
 * fails. Me carries no suspendedUntil, so `until` stays empty and the end day is read from the
 * suspension notice's own title (suspensionTitle), the one place the API already carries it.
 */
export function SuspendedBanner({ status, until }: { status?: string | null; until?: string | null }) {
  const suspended = status === "SUSPENDED";
  const [fromNotice, setFromNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!suspended || until) return;
    let live = true;
    listNotifications({ filter: "all", limit: 20 }).then(
      (p) => {
        if (!live) return;
        for (const n of p.items) {
          const d = n.type === "MODERATION_NOTICE" ? untilFromNoticeTitle(n.title) : null;
          if (d) { setFromNotice(d); return; }
        }
      },
      () => undefined,
    );
    return () => { live = false; };
  }, [suspended, until]);
  if (!suspended) return null;
  if (until && Date.parse(until) <= Date.now()) return null;
  const day = until ? untilLabel(until) : fromNotice;
  return (
    <Banner tone="warning" title={day ? `Your account is suspended until ${day.replace(/ /g, "\u00A0")}.` : "Your account is suspended."}>
      <span data-testid="suspended-banner"> You can still read, and appeal from your <Link href="/notifications" className="link">notifications</Link>.</span>
    </Banner>
  );
}
