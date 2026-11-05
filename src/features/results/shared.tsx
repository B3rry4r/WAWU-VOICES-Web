"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Icon, VerifyMark } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { sessionStorage } from "@/lib/auth/session-storage";

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
        <div className="truncate font-body text-[16px] font-bold leading-5 text-ink">{title}</div>
        {subtitle ? <div className="truncate text-[13px] leading-4 text-ink-2">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

export function DesktopBack({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 hidden items-center gap-1 text-[14px] font-semibold text-green-text no-underline hover:text-ink dt:inline-flex">
      <Icon name="arrow-left" size={18} />
      {label}
    </Link>
  );
}

/** Puts content in the desktop right rail (the shell's empty aside). The rail is hidden below 1024 px, so phones never see it. */
export function RailPortal({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<Element | null>(null);
  useEffect(() => {
    setNode(document.querySelector(".sh-rail"));
  }, []);
  return node ? createPortal(children, node) : null;
}

export function LabelsPanel() {
  return (
    <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="What the labels mean">
      <h2 className="m-0 font-display text-[18px] font-normal leading-6">What the labels mean</h2>
      <div className="flex flex-col gap-1">
        <VerifyMark status="verified" pill />
        <p className="m-0 text-[14px] leading-5 text-ink-2">The WAWU team checked these numbers against the result sheet.</p>
      </div>
      <div className="flex flex-col gap-1">
        <VerifyMark status="unverified" pill />
        <p className="m-0 text-[14px] leading-5 text-ink-2">Not checked yet. Treat with care.</p>
      </div>
      <p className="m-0 border-t border-line pt-3 text-[14px] leading-5 text-ink-2">WAWU does not add these up or publish a count of its own.</p>
    </section>
  );
}

const LAGOS = "Africa/Lagos";

/** "6:42pm", in Lagos time. */
export function lagosClock(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-NG", { timeZone: LAGOS, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
  return parts.replace(/\s?am\b/i, "am").replace(/\s?pm\b/i, "pm");
}

/** "Saturday 16 January 2027" from a date-only value. */
export function longDate(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(d);
  return `${wd} ${shortDate(day)}`;
}

/** "16 January 2027". */
export function shortDate(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(day + "T12:00:00Z"));
}

/** "Just now", "40 min", "2h", or a Lagos date. */
export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, day: "numeric", month: "short" }).format(new Date(iso));
}

