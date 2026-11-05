"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Banner, Icon, IconButton } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { isSignedIn } from "@/lib/api/auth";

/** Signed in or not, read in the browser (the session lives in local storage). null until the first effect. */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => setV(isSignedIn()), []);
  return v;
}

/** Hides the shell's phone bars the page replaces: always the logo bar (the page has its own app bar, V-5), the tab bar on full-screen tasks. */
export function ShellTweaks({ tabBar }: { tabBar: boolean }) {
  return (
    <style>{`@media (max-width:1023px){.sh-topbar{display:none}${tabBar ? "" : ".sh-bottombar{display:none}.sh-main{padding-bottom:calc(var(--space-8) + env(safe-area-inset-bottom,0px))}"}}`}</style>
  );
}

export function uuidKey(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Page app bar: back, title (and subtitle), actions on the right. */
export function AppBar({ title, sub, back, close, children }: { title: string; sub?: string; back?: string; close?: string; children?: ReactNode }) {
  const router = useRouter();
  const href = back ?? close;
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] -mx-4 flex min-h-14 items-center gap-1 border-b border-[var(--line)] bg-[var(--bg)] px-2 dt:static dt:mx-0 dt:border-0 dt:px-0">
      <Link href={href ?? "/"} aria-label={close ? "Close without posting" : "Back"} className="sh-iconbtn border-0 bg-transparent shadow-none" onClick={(e) => { if (!href) { e.preventDefault(); router.back(); } }}>
        <Icon name={close ? "x" : "arrow-left"} size={24} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col pl-1">
        <span className="truncate text-[17px] font-bold leading-[22px]">{title}</span>
        {sub ? <span className="truncate text-[13px] leading-[18px] text-[var(--ink-2)]">{sub}</span> : null}
      </div>
      {children}
    </header>
  );
}

export function BarButton({ icon, label, pressed, onClick }: { icon: "bookmark" | "share-2"; label: string; pressed?: boolean; onClick: () => void }) {
  return <IconButton icon={icon} label={label} variant="ghost" pressed={pressed} iconSize={24} onClick={onClick} />;
}

export function offline(e: unknown): boolean {
  return e instanceof ApiError && e.status === 0;
}

/** Plain copy for a failed call, keyed on the code (the server's message is never shown raw). */
export function failText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again in a moment.";
  if (e.status === 0) return "You are offline. Check your connection and try again.";
  switch (e.code) {
    case "RATE_LIMITED": return "You are going fast. Wait a moment and try again.";
    case "QUESTION_CLOSED": return "This question has closed.";
    case "ACCOUNT_SUSPENDED": return "Your account is paused, so you cannot post right now.";
    case "BLOCKED_BY_USER": return "You cannot reply to this person.";
    case "CONTENT_REMOVED": return "This voice was removed.";
    case "VALIDATION_FAILED": return "Check what you wrote and try again.";
    case "FORBIDDEN": return "Finish setting up your profile first.";
    case "UNAUTHENTICATED": case "TOKEN_EXPIRED": return "Sign in to continue.";
    default: return "Something went wrong on our side. Try again in a moment.";
  }
}

export function Problem({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const off = offline(error);
  return (
    <Banner tone={off ? "offline" : "danger"} title={off ? "You are offline" : "This did not load"} action={onRetry ? "Try again" : undefined} onAction={onRetry}>
      {off ? "Check your connection and try again." : "Something went wrong on our side. Try again in a moment."}
    </Banner>
  );
}

export function SignInNote({ children }: { children: ReactNode }) {
  return (
    <Banner tone="info" title="Sign in to continue.">
      {children}
    </Banner>
  );
}

/** Held drafts share one store with the Voice Units screens (same key and shape as features/units/draft.ts, V-19). */
const HELD = "voices-held-drafts";
export interface HeldDraft { questionId: string; body: string; key: string; savedAt: number; awaitingUnits: boolean }
function heldRead(): Record<string, HeldDraft> {
  try { const t = JSON.parse(window.localStorage.getItem(HELD) ?? "{}"); return t && typeof t === "object" ? t : {}; } catch { return {}; }
}
/** `key` is the Idempotency-Key of the post that was just refused, so the post after a purchase reuses it. */
export function holdDraft(questionId: string, body: string, key?: string): HeldDraft {
  const t = heldRead();
  const prev = t[questionId];
  const d: HeldDraft = { questionId, body: body.trim(), key: key ?? (prev && prev.body === body.trim() ? prev.key : uuidKey()), savedAt: Date.now(), awaitingUnits: prev?.awaitingUnits ?? false };
  t[questionId] = d;
  try { window.localStorage.setItem(HELD, JSON.stringify(t)); } catch { /* blocked storage: this page only */ }
  return d;
}
export function heldDraft(questionId: string): HeldDraft | undefined { return heldRead()[questionId]; }
export function dropHeld(questionId: string): void {
  const t = heldRead(); delete t[questionId];
  try { window.localStorage.setItem(HELD, JSON.stringify(t)); } catch { /* ignore */ }
}

/** What a person has typed so far on the Write screen, kept in this browser only (V-19). One per question or per reply. */
const TYPING = "voices-typing-drafts";
export function typedDraft(slot: string): string {
  try { return (JSON.parse(window.localStorage.getItem(TYPING) ?? "{}") as Record<string, string>)[slot] ?? ""; } catch { return ""; }
}
export function saveTyped(slot: string, text: string): void {
  try {
    const t = JSON.parse(window.localStorage.getItem(TYPING) ?? "{}") as Record<string, string>;
    if (text) t[slot] = text; else delete t[slot];
    window.localStorage.setItem(TYPING, JSON.stringify(t));
  } catch { /* ignore */ }
}

export function outOfPostsHref(questionId: string): string {
  return `/units/out-of-posts?question=${encodeURIComponent(questionId)}`;
}

/** 402 codes that mean "no free post and not enough units". */
export function isOutOfPosts(e: unknown): boolean {
  return e instanceof ApiError && e.status === 402 && (e.code === "FREE_POSTS_EXHAUSTED" || e.code === "INSUFFICIENT_UNITS");
}

export function unitsText(milli: number): string {
  const u = milli / 1000;
  return `${Number.isInteger(u) ? u : u.toFixed(1)} ${u <= 1 ? "unit" : "units"}`;
}
export function nairaOfMilli(milli: number, baseKoboPerUnit: number): string {
  const kobo = (milli * baseKoboPerUnit) / 1000;
  return `₦${(kobo / 100).toFixed(2).replace(/\.00$/, "")}`;
}
