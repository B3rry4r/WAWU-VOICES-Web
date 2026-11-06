"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Banner, Icon, IconButton, NotFoundState } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { isSignedIn } from "@/lib/api/auth";
import { getPlayUrl } from "@/lib/api/talk";
import { trackListen } from "./listen-track";
import { makePlayer, playWithResign } from "@/lib/audio-ref/player";

/** Signed in or not, read in the browser (the session lives in local storage). null until the first effect. */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => setV(isSignedIn()), []);
  return v;
}

export function uuidKey(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Page app bar: back, title (and subtitle), actions on the right. */
export function AppBar({ title, sub, back, close, children, phoneOnly }: { title: string; sub?: string; back?: string; close?: string; children?: ReactNode; phoneOnly?: boolean }) {
  const router = useRouter();
  const href = back ?? close;
  return (
    <header className={`sticky top-0 z-[var(--z-sticky)] -mx-4 flex min-h-14 items-center gap-1 border-b border-[var(--line)] bg-[var(--bg)] px-2 dt:static dt:mx-0 dt:border-0 dt:px-0 ${phoneOnly ? "dt:hidden" : ""}`}>
      <Link href={href ?? "/"} aria-label={close ? "Close without posting" : "Back"} className="sh-iconbtn border-0 bg-transparent shadow-none" onClick={(e) => { if (!href) { e.preventDefault(); router.back(); } }}>
        <Icon name={close ? "x" : "arrow-left"} size={24} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col pl-1">
        <span className="t-bar-title truncate">{title}</span>
        {sub ? <span className="truncate text-caption text-[var(--ink-2)]">{sub}</span> : null}
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
    case "ACCOUNT_SUSPENDED": return "Your account is suspended, so you cannot post right now.";
    case "BLOCKED_BY_USER": return "You cannot reply to this person.";
    case "CONTENT_REMOVED": return "This voice was removed.";
    case "VALIDATION_FAILED": return "Check what you wrote and try again.";
    case "FORBIDDEN": return "Finish setting up your profile first.";
    case "UNAUTHENTICATED": case "TOKEN_EXPIRED": return "Sign in to continue.";
    default: return "Something went wrong on our side. Try again in a moment.";
  }
}

/** Lead ruling WF-6 RX1, 6 Nov: a 404 (missing, removed, hidden) is "We could not find that." with a way back, never an error and never Try again. A real 5xx or a lost connection keeps the error words and Try again. */
export function Problem({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && error.status === 404) return <NotFoundState />;
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
  return `${Number.isInteger(u) ? u : u.toFixed(1)} ${u === 1 ? "unit" : "units"}`;
}
export function nairaOfMilli(milli: number, baseKoboPerUnit: number): string {
  const kobo = (milli * baseKoboPerUnit) / 1000;
  return `₦${(kobo / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** One voice plays at a time: starting one stops the one before it and puts its button back. */
let playing: { stop: () => void } | null = null;

/** Playback for one clip. `rev` changes whenever the player button must go back to its start state
 *  (the voice ended, another voice took over, or the URL could not be played): use it as the key of the player. */
export function useClipPlayback(clipId: string | undefined, onFail: (e: unknown) => void, onStart?: () => void, answerId?: string) {
  const audio = useRef<HTMLAudioElement | null>(null);
  /** Stops listen tracking of the current audio (and sends its last stretch). */
  const untrack = useRef<(() => void) | null>(null);
  const expires = useRef(0);
  const [rev, setRev] = useState(0);
  const reset = useCallback(() => setRev((r) => r + 1), []);
  const me = useRef({ stop: () => undefined as void });
  me.current.stop = () => { audio.current?.pause(); reset(); };
  useEffect(() => () => { untrack.current?.(); untrack.current = null; audio.current?.pause(); if (playing === me.current) playing = null; }, []);

  const toggle = useCallback(async (start: boolean) => {
    if (!clipId) return;
    if (!start) { audio.current?.pause(); return; }
    try {
      if (playing && playing !== me.current) playing.stop();
      playing = me.current;
      const sign = async () => { const p = await getPlayUrl(clipId); expires.current = Date.parse(p.expiresAt) || 0; return p.url; };
      if (!audio.current || (expires.current && Date.now() > expires.current - 20000)) {
        audio.current?.pause();
        audio.current = makePlayer(await sign());
        const el = audio.current;
        el.onended = () => { if (playing === me.current) playing = null; reset(); };
        // An answer's clip counts a start and reports how far the person got (LISTEN-1); a reply's clip does not.
        untrack.current?.();
        untrack.current = answerId ? trackListen(answerId, el) : null;
        onStart?.();
      }
      await playWithResign(audio.current, sign);
    } catch (e) {
      if (playing === me.current) playing = null;
      audio.current = null;
      reset();
      onFail(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId, onFail, reset, answerId]);
  return { rev, toggle };
}
