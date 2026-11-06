"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon, VerifyMark } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { sessionStorage } from "@/lib/auth/session-storage";
import { clock, date, dayMonth, weekday } from "@/lib/format/date";

/** True once the browser has a WAWU ID access token. Null while the first read has not happened (server render). */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    setV(!!sessionStorage.getToken());
  }, []);
  return v;
}

/** The page's own app bar (the boards draw one): back or close on the left, title and subtitle, optional right action. */
export function AppBar({ href, back = "back", backLabel, title, subtitle, right }: { href: string; back?: "back" | "close"; backLabel: string; title: string; subtitle?: string; right?: ReactNode }) {
  const icon: IconName = back === "close" ? "x" : "arrow-left";
  return (
    <div className="flex items-center gap-1 pb-2 pt-1 dt:hidden">
      <Link href={href} aria-label={backLabel} className="flex h-11 w-11 flex-none items-center justify-center rounded-pill text-ink no-underline hover:bg-surface-2">
        <Icon name={icon} size={24} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="t-bar-title truncate text-ink">{title}</div>
        {subtitle ? <div className="truncate text-caption text-ink-2">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

export function DesktopBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 hidden items-center gap-1 text-label text-green-text no-underline hover:text-ink dt:inline-flex">
      <Icon name="arrow-left" size={18} />
      {label}
    </Link>
  );
}

export function LabelsPanel() {
  return (
    <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="What the labels mean">
      <h2 className="m-0 font-display text-display-s">What the labels mean</h2>
      <div className="flex flex-col gap-1">
        <VerifyMark status="verified" pill />
        <p className="m-0 text-caption text-ink-2">The WAWU team checked these numbers against the result sheet.</p>
      </div>
      <div className="flex flex-col gap-1">
        <VerifyMark status="unverified" pill />
        <p className="m-0 text-caption text-ink-2">Not checked yet. Treat with care.</p>
      </div>
      <p className="m-0 border-t border-line pt-3 text-caption text-ink-2">WAWU does not add these up or publish a count of its own.</p>
    </section>
  );
}

/** "6:42pm", in Lagos time. */
export function lagosClock(iso: string): string {
  return clock(iso);
}

/** "Saturday 16 Jan 2027" from a date-only value. */
export function longDate(day: string): string {
  return `${weekday(dayNoon(day), "long")} ${shortDate(day)}`;
}

/** "16 Jan 2027". */
export function shortDate(day: string): string {
  return date(dayNoon(day));
}

/** A date-only value as midday UTC, which is the same calendar day in Lagos. */
const dayNoon = (day: string): Date => new Date(day + "T12:00:00Z");

/** "Just now", "40 min", "2h", or a Lagos date. */
export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return dayMonth(iso);
}

