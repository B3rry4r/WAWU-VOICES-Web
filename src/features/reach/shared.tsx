"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/vx";
import { sessionStorage } from "@/lib/auth/session-storage";
import { clock, clock24, dayKey, dayMonth, monthYear, weekday } from "@/lib/format/date";
import "./reach.css";

/** True once the browser holds a WAWU ID access token. Null before the first browser read (server render). */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    setV(!!sessionStorage.getToken());
  }, []);
  return v;
}

export function useDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return d;
}

/** The page's own phone app bar (the boards draw one): a round back button, a title, an optional right action. Hidden on desktop. */
export function AppBar({ href, backLabel, title, right, big }: { href: string; backLabel: string; title: string; right?: ReactNode; big?: boolean }) {
  return (
    <div className="flex items-center gap-2 pb-3 pt-1 dt:hidden">
      <Link href={href} aria-label={backLabel} className="flex h-11 w-11 flex-none items-center justify-center rounded-pill border border-line bg-surface text-ink no-underline hover:bg-surface-2">
        <Icon name="arrow-left" size={22} />
      </Link>
      {big ? (
        <h1 className="m-0 min-w-0 flex-1 truncate font-display text-display-l">{title}</h1>
      ) : (
        <div className="min-w-0 flex-1 t-bar-title truncate text-ink-2">{title}</div>
      )}
      {right}
    </div>
  );
}

/** "30 Nov, 6pm" in Lagos time. */
export function lagosPublished(iso: string): string {
  return `${dayMonth(iso)}, ${clock(iso, { short: true })}`;
}

/** "Sunday 3 Jan, 6pm" in Lagos time. */
export function lagosSlot(iso: string): string {
  return `${weekday(iso, "long")} ${lagosPublished(iso)}`;
}

/** "December 2026" from a publish time, in Lagos time (the archive heading). */
export function monthOf(iso: string): string {
  return monthYear(iso, "long");
}

/** "30 Nov" in Lagos time. */
export function lagosDay(iso: string): string {
  return dayMonth(iso);
}

/** "8:00", "12 min", "1 h", "3 h", "Yesterday", "Mon", then a date: the time label under a notification (Lagos time). */
export function whenLabel(iso: string, now = new Date()): string {
  const t = new Date(iso);
  const mins = Math.floor((now.getTime() - t.getTime()) / 60000);
  if (dayKey(t) === dayKey(now)) {
    if (mins < 1) return "Now";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 6) return `${hrs} h`;
    return clock24(t);
  }
  const yest = new Date(now.getTime() - 86400000);
  if (dayKey(t) === dayKey(yest)) return "Yesterday";
  const days = Math.floor((now.getTime() - t.getTime()) / 86400000);
  if (days < 7) return weekday(t);
  return dayMonth(iso);
}

/** Today or Earlier, by Lagos calendar day. */
export function isToday(iso: string, now = new Date()): boolean {
  return dayKey(iso) === dayKey(now);
}
