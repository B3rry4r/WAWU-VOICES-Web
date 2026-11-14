"use client";

import { needsNewKey } from "@/lib/api/keys";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { useAdmin } from "./AdminFrame";
import { canOpen } from "./roles";
import type { AdminPageId } from "./roles";
import { fromLocalInput, slot } from "./time";
import { Banner, EmptyState, Icon, Skeleton } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { BUSY_TEXT, BUSY_TITLE, isBusy } from "@/lib/api/busy";

/** The words the API refused with, or a plain line when it never answered. Never an internal code. */
export function refusalWords(e: unknown): string {
  if (e instanceof ApiError) {
    // lead ruling WF, 6 Nov (C-L6): a suspended admin person is told so plainly, not "cannot post".
    if (e.code === "ACCOUNT_SUSPENDED") return "This account is suspended, so changes are paused. Ask an admin for help.";
    if (needsNewKey(e)) return "That did not go through. Tap the button to try again.";
    if (e.explained) {
      // A 422 carries the useful words in details.fields[].message; the top message is only "Some details need fixing."
      const f = (e.details as { fields?: { message?: unknown }[] } | undefined)?.fields;
      const lines = Array.isArray(f) ? f.map((x) => (typeof x?.message === "string" ? x.message : "")).filter(Boolean) : [];
      return lines.length ? lines.join(" ") : e.message;
    }
    if (e.status === 0) return "VOICES could not be reached. Check the connection and try again.";
    if (e.status === 403) return "Your role cannot do this.";
  }
  return "That did not go through. Try again.";
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="vx-eyebrow text-ink-2">{eyebrow}</div> : null}
        <h1 className="m-0 mt-1 font-display text-display-xl text-ink">{title}</h1>
        {sub ? <p className="m-0 mt-1 text-body text-ink-2">{sub}</p> : null}
      </div>
      {right ? <div className="flex flex-none items-center gap-3 pt-2">{right}</div> : null}
    </header>
  );
}

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: "mint" | "plain" }) {
  const bg = tone === "mint" ? "bg-surface-2" : "bg-surface";
  return <section className={`rounded-xl border border-line ${bg} p-6 ${className}`}>{children}</section>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 mb-3 font-display text-display-m text-ink">{children}</h2>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`vx-eyebrow text-ink-2 ${className}`}>{children}</div>;
}

type Tone = "neutral" | "green" | "sun" | "red" | "blue" | "sponsor";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  green: "bg-success-bg text-success",
  sun: "bg-sun text-forest",
  red: "bg-danger-bg text-danger",
  blue: "bg-verified-bg text-verified",
  sponsor: "bg-unverified-bg text-unverified",
};

/** A small uppercase status pill: SCHEDULED, LIVE, CLOSED. */
export function Pill({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-s px-2 py-1 text-eyebrow uppercase ${TONES[tone]}`}>
      {dot ? <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** The rounded status pill next to a title: "Normal flow running". */
export function StatePill({ tone, icon, children }: { tone: "green" | "sun" | "red"; icon: IconName; children: ReactNode }) {
  const c = tone === "green" ? "bg-success-bg text-success" : tone === "sun" ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger";
  return (
    <span className={`inline-flex items-center gap-2 rounded-pill px-4 py-2 text-label ${c}`}>
      <Icon name={icon} size={20} />
      {children}
    </span>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3">
      <div className="min-w-0">
        <div className="text-label text-ink">{label}</div>
        {hint ? <div className="text-caption text-ink-2">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 flex-none cursor-pointer rounded-pill border-0 p-0 transition-colors ${checked ? "bg-green" : "bg-surface-3"} disabled:opacity-50`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-pill bg-surface shadow-1 transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

/** One button-tap at a time with an Idempotency-Key kept for the tap (a retry of the same tap reuses it). */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const run = useCallback(async <T,>(fn: (idempotencyKey: string) => Promise<T>): Promise<T | undefined> => {
    if (busy) return undefined;
    if (!key.current) key.current = crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const out = await fn(key.current);
      key.current = null;
      return out;
    } catch (e) {
      // A refused tap is a finished tap; a network failure keeps the key so the retry cannot double up.
      if (e instanceof ApiError && e.status > 0) key.current = null;
      setError(refusalWords(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [busy]);
  const clear = useCallback(() => setError(null), []);
  return { busy, error, run, clear };
}

export function ErrorLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-m bg-danger-bg px-3 py-2 text-count text-danger">
      <Icon name="circle-x" size={18} className="mt-0.5 flex-none" />
      <span>{children}</span>
    </div>
  );
}

export function SavedLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-m bg-success-bg px-3 py-2 text-count text-success">
      <Icon name="circle-check" size={18} className="mt-0.5 flex-none" />
      <span>{children}</span>
    </div>
  );
}

/** A suspended admin person is told so; a retry cannot help, so none is offered (WF-7b, C-N-c6). */
export const isSuspendedError = (e: unknown): boolean => e instanceof ApiError && e.code === "ACCOUNT_SUSPENDED";

export function LoadFailed({ error, retry }: { error: Error; retry: () => void }) {
  if (isSuspendedError(error)) {
    return (
      <Banner tone="danger" title="This account is suspended">
        {refusalWords(error)}
      </Banner>
    );
  }
  return (
    <Banner tone="danger" title={isBusy(error) ? BUSY_TITLE : "This did not load"} action="Try again" actionIcon="refresh-cw" onAction={retry}>
      {isBusy(error) ? BUSY_TEXT : refusalWords(error)}
    </Banner>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="tile" />
      ))}
    </div>
  );
}

export function AuditList({ lines, title }: { lines: { at: string; text: string; by: string | null }[]; title: string }) {
  if (!lines.length) return null;
  return (
    <div className="border-t border-line pt-4">
      <Eyebrow className="mb-2">{title}</Eyebrow>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-caption text-ink-2">
        {lines.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ul>
    </div>
  );
}

export const queueRow = (selected: boolean) =>
  `block w-full cursor-pointer border-0 border-b border-line bg-surface p-4 text-left text-ink last:border-b-0 ${selected ? "!bg-mint shadow-[inset_0_0_0_2px_var(--green)]" : "hover:bg-surface-2"}`;

/** Renders the page only for a role that may open it; nothing is fetched before this passes. */
export function Gated({ page, children }: { page: AdminPageId; children: ReactNode }) {
  const { roles } = useAdmin();
  if (!canOpen(roles, page)) return <EmptyState icon="compass" title="We could not find that" body="Go back to Today." />;
  return <>{children}</>;
}

/** A date and time that reads like the board ("Mon 30 Nov, 10:30am", Lagos time). The picker opens from the field. `value` is a datetime-local string in Lagos time. */
export function DateTimeField({ label, value, onChange, hint, error }: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const id = label.toLowerCase().replace(/\W+/g, "-");
  let shown = "Pick a time";
  try {
    shown = slot(fromLocalInput(value));
  } catch {
    /* an unfinished value keeps the prompt */
  }
  return (
    <div className={`vx-field ${error ? "is-error" : ""}`}>
      <label className="vx-field__label" htmlFor={id}>{label}</label>
      <div className="relative">
        <button
          id={id}
          type="button"
          className="vx-field__box w-full cursor-pointer border-0 bg-transparent px-4 text-left text-body text-ink"
          onClick={() => {
            try {
              input.current?.showPicker();
            } catch {
              input.current?.focus();
            }
          }}
        >
          {shown}
        </button>
        <input ref={input} type="datetime-local" tabIndex={-1} aria-hidden="true" value={value} onChange={(e) => onChange(e.target.value)} className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0" />
      </div>
      {error || hint ? <div className="vx-field__hint">{error ?? hint}</div> : null}
    </div>
  );
}
