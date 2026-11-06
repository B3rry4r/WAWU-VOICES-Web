"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Banner, EmptyState, Icon, Skeleton } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { sessionStorage } from "@/lib/auth/session-storage";
import "./vote.css";

/** True once the browser holds a WAWU ID access token. Null before the first browser read. */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    setV(!!sessionStorage.getToken());
  }, []);
  return v;
}

/** The phone app bar the boards draw: a round back button, a title with a small line under it, an optional right action. Hidden from 1024 px. */
export function AppBar({ href, backLabel, title, sub, right, close }: { href: string; backLabel: string; title: string; sub?: string; right?: ReactNode; close?: boolean }) {
  return (
    <div className="flex items-center gap-2 pb-3 pt-1 dt:hidden">
      <Link href={href} aria-label={backLabel} className="flex h-11 w-11 flex-none items-center justify-center rounded-pill text-ink no-underline a-plain hover:bg-surface-2">
        <Icon name={close ? "x" : "arrow-left"} size={22} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="t-bar-title truncate text-ink">{title}</div>
        {sub ? <div className="truncate text-caption text-ink-2">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

/** The 1440 "Back to ..." link and its right action, above the stage bar. Hidden on the phone (the app bar does it). */
export function DeskBack({ href, label, right }: { href: string; label: string; right?: ReactNode }) {
  return (
    <div className="hidden items-center justify-between gap-3 pb-3 pt-1 dt:flex">
      <Link href={href} className="inline-flex items-center gap-2 text-label text-ink no-underline a-plain hover:text-green-text">
        <Icon name="arrow-left" size={20} />
        {label}
      </Link>
      {right}
    </div>
  );
}

export function ShareButton({ label, onClick, variant = "icon" }: { label: string; onClick: () => void; variant?: "icon" | "text" }) {
  if (variant === "text") {
    return (
      <button type="button" onClick={onClick} className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-label text-green-text hover:text-ink">
        <Icon name="share-2" size={20} />
        {label}
      </button>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-11 w-11 flex-none items-center justify-center rounded-pill border-0 bg-transparent text-ink hover:bg-surface-2 dt:border dt:border-solid dt:border-line dt:bg-surface">
      <Icon name="share-2" size={20} />
    </button>
  );
}

export function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton variant="tile" />
      <Skeleton variant="answer" />
    </div>
  );
}

export function LoadFailed({ error, retry, what }: { error: unknown; retry: () => void; what: string }) {
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState icon="info" title={`We could not find ${what}`} body="It may have been removed." />;
  }
  const offline = error instanceof ApiError && error.status === 0;
  return (
    <Banner tone={offline ? "offline" : "danger"} title={offline ? "You are offline" : "This did not load"} action="Try again" onAction={retry}>
      {offline ? "Check your connection and try again." : "Something went wrong on our side. Try again in a moment."}
    </Banner>
  );
}

/** Units as the screens say them: 0.2 units, 1 unit, 12.5 units. Milli-units in, never naira (V-9). */
export function unitsText(milli: number): string {
  const u = milli / 1000;
  const s = Number.isInteger(u) ? String(u) : String(Math.round(u * 100) / 100);
  return `${s} ${u === 1 ? "unit" : "units"}`;
}

/** The question's page title line the boards print under the app bar title, e.g. "Week 4 poll". */
export function weekPollLine(q: { weekNumber?: number | null } | null | undefined): string {
  return q?.weekNumber ? `Week ${q.weekNumber} poll` : "Open poll";
}

export type Loaded<T> = { state: "loading" } | { state: "error"; error: unknown; retry: () => void } | { state: "ready"; data: T; reload: () => void };

/** Loads on the client once `enabled` (the session is read from the browser first), with a retry and a quiet reload. */
export function useLoadWhen<T>(fn: () => Promise<T>, deps: unknown[], enabled: boolean): Loaded<T> {
  const [res, setRes] = useState<Loaded<T>>({ state: "loading" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    fn().then(
      (data) => live && setRes({ state: "ready", data, reload: () => setN((x) => x + 1) }),
      (error: unknown) => live && setRes({ state: "error", error, retry: () => { setRes({ state: "loading" }); setN((x) => x + 1); } }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, n]);
  return res;
}

/** "12.5K", "9.7K", "214": the stage bar counts the 1440 boards draw. */
export function shortCount(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

/** The heading block the 1440 boards draw under the stage bar: a small green line, the title, and one line of guidance. Hidden on the phone. */
export function PageHead({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string }) {
  return (
    <div className="hidden flex-col gap-1 dt:flex">
      {eyebrow ? <span className="vx-eyebrow text-green-text">{eyebrow}</span> : null}
      <h1 className="m-0 font-display text-display-l">{title}</h1>
      {lead ? <p className="vt-lead">{lead}</p> : null}
    </div>
  );
}


/** The soonest start among polls that are still SCHEDULED, or null. */
export function nextOpening(polls: Array<{ status: string; startsAt: string } | null | undefined>): number | null {
  let t: number | null = null;
  for (const p of polls) {
    if (!p || p.status !== "SCHEDULED") continue;
    const at = Date.parse(p.startsAt);
    if (Number.isFinite(at) && (t === null || at < t)) t = at;
  }
  return t;
}

/** Calls onOpen once the clock passes `at` (a poll's startsAt) while the page stays open. One timer, no polling before then. */
export function useOpensAt(at: number | null, onOpen: () => void): void {
  const cb = useRef(onOpen);
  cb.current = onOpen;
  useEffect(() => {
    if (at === null) return undefined;
    let id: ReturnType<typeof setTimeout>;
    const arm = () => {
      const left = at - Date.now();
      // setTimeout cannot wait past about 24 days; wake early and look again. A moment after the start lets the server's clock agree.
      if (left > 0) id = setTimeout(arm, Math.min(left + 300, 2 ** 31 - 1));
      else cb.current();
    };
    arm();
    // A tab that slept past the start flips as soon as it wakes.
    const wake = () => document.visibilityState === "visible" && Date.now() >= at && cb.current();
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [at]);
}
