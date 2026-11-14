"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/vx";
import { Pill } from "../ui";
import { statusWord } from "./format";

/** The question a person must answer on the page before money moves or a price changes. Not a browser dialog. */
export function ConfirmPanel({
  title,
  children,
  confirmLabel,
  busy,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="group" aria-label="Confirm" className="rounded-xl border border-line-strong bg-surface-2 p-5">
      <h3 className="m-0 font-display text-display-s text-ink">{title}</h3>
      {children ? <div className="mt-2 text-body text-ink-2">{children}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant={destructive ? "destructive" : "primary"} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "green" | "sun" | "red" | "neutral" | "blue"> = {
  SUCCEEDED: "green",
  PENDING: "sun",
  INITIATED: "neutral",
  FAILED: "red",
  EXPIRED: "neutral",
  REFUNDED: "blue",
  ACTIVE: "green",
  QUEUED: "sun",
  ENDED: "neutral",
  CANCELLED_DELETED: "red",
};

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? "neutral"}>{statusWord(status)}</Pill>;
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`vx-eyebrow whitespace-nowrap px-4 py-4 ${right ? "text-right" : ""}`}>{children}</th>;
}

export function Td({ children, right, className = "" }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

/** A framed, horizontally scrollable table. */
export function TableFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-caption" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="vx-field">
      <label className="vx-field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="vx-field__input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
