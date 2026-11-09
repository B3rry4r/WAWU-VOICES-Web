"use client";
import type { ReactNode } from "react";
import { Button, EmptyState, Skeleton } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { BUSY_WORDS, isBusy } from "@/lib/api/busy";

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="pf-loading" role="status" aria-label="Loading">
      <Skeleton variant="answer" />
      {Array.from({ length: rows - 1 }, (_, i) => <Skeleton key={i} variant="answer" />)}
    </div>
  );
}

/** The one words-for-an-error rule: the server's own sentence when it explained, a plain line otherwise. */
export function errorLine(e: unknown, fallback = "Something went wrong. Try again."): string {
  if (e instanceof ApiError) {
    if (e.code === "OFFLINE" || e.code === "TIMEOUT") return "No connection. Check your internet and try again.";
    if (e.explained) return e.message;
  }
  return fallback;
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <EmptyState icon="triangle-alert" title="We could not load this" body={isBusy(error) ? BUSY_WORDS : errorLine(error)} action="Try again" actionIcon="refresh-cw" onAction={onRetry} />;
}

/** Shown to a guest. The sign-in screens are built by another task, so no button leads there yet. */
export function SignedOutNotice({ what }: { what: string }) {
  return <EmptyState icon="lock" title="Sign in to see this" body={`Sign in to VOICES to see ${what}.`} />;
}

export function NeedsProfileNotice() {
  return <EmptyState icon="user" title="Finish setting up your profile" body="Pick a handle and your topics to finish creating your VOICES profile." />;
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="pf-section">
      <h2 id={id} className="vx-eyebrow pf-eyebrow">{title}</h2>
      {children}
    </section>
  );
}

export { Button };
