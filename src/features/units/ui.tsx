"use client";

import type { ReactNode } from "react";
import { Banner, Button, EmptyState, Skeleton } from "@/components/vx";
import { readErrorText } from "./hooks";

export function Card({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)] ${className}`}>
      {children}
    </section>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="m-0 text-body-strong">
      {children}
    </h2>
  );
}

export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`m-0 text-caption text-ink-2 ${className}`}>{children}</p>;
}

/** "Label ... value" row used by the cost lists and the payment details. */
export function Line({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: "free" }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-[10px] text-body dt:text-label last:border-b-0">
      <span>{label}</span>
      <span className={`whitespace-nowrap text-body-strong tabular-nums ${tone === "free" ? "text-green-text" : ""}`}>{value}</span>
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="tile" />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <Banner tone="danger" title="Could not load this" action="Try again" actionIcon="refresh-cw" onAction={onRetry}>{readErrorText(error)}</Banner>;
}

/** Signed out: Voice Units belong to an account. */
export function SignInNeeded() {
  return <EmptyState icon="coins" title="Sign in to see your Voice Units" body="Voice Units belong to your VOICES account." />;
}

export function BackRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="s" icon="arrow-left" onClick={onClick}>
      {label}
    </Button>
  );
}
