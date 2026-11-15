"use client";
import Link from "next/link";
import { countChars, textCostMilli, tokensLabel } from "@/lib/shared/text-price";
import type { Allowances } from "@/lib/api/talk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Banner, Button, Icon, IconButton, NotFoundState } from "@/components/vx";
import { signInHref } from "@/lib/auth/entry-draft";
import { ApiError } from "@/lib/api/client";
import { needsNewKey, newKeyLine } from "@/lib/api/keys";
import { BUSY_TEXT, BUSY_TITLE, isBusy } from "@/lib/api/busy";
import { isSignedIn } from "@/lib/api/auth";
import { getPlayUrl } from "@/lib/api/talk";
import { trackListen } from "./listen-track";
import { makePlayer, playWithResign } from "@/lib/audio-ref/player";
import { claimPlayback } from "@/features/profile/playback";
import { currentOwner, signedInAsSomeoneElse, type Owner } from "@/features/speak/draft";

/** Signed in or not, read in the browser (the session lives in local storage). null until the first effect. */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    setV(isSignedIn());
    // The same person signing in on another tab (a code link opens a new one) must not leave this screen asking them to sign in.
    const on = (e: StorageEvent) => { if (e.key === "voices-web-session") setV((cur) => (cur === false || cur === null ? isSignedIn() : cur)); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
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
export { needsNewKey };

/** `word` is the button's own word on the screen (default "Post"). */
export function failText(e: unknown, word = "Post"): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again in a moment.";
  if (needsNewKey(e)) return newKeyLine(word);
  if (e.status === 0) return "You are offline. Check your connection and try again.";
  switch (e.code) {
    case "DAILY_LIMIT_REACHED": return "You have sent the most messages one day allows. Come back after midnight.";
    case "RATE_LIMITED": return "You are going fast. Wait a moment and try again.";
    case "QUESTION_CLOSED": return "This question has closed.";
    case "ACCOUNT_SUSPENDED": return "Your account is suspended, so you cannot post right now.";
    case "BLOCKED_BY_USER": return "You cannot reply to this person.";
    case "CONTENT_REMOVED": return "This voice was removed.";
    case "VALIDATION_FAILED": return (e.details as { fields?: { message?: string }[] } | undefined)?.fields?.[0]?.message || (e.explained && e.message.trim() ? e.message : "Check what you wrote and try again.");
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
    <Banner tone={off ? "offline" : "danger"} title={off ? "You are offline" : isBusy(error) ? BUSY_TITLE : "This did not load"} action={onRetry ? "Try again" : undefined} onAction={onRetry}>
      {off ? "Check your connection and try again." : isBusy(error) ? BUSY_TEXT : "Something went wrong on our side. Try again in a moment."}
    </Banner>
  );
}

/** `from` (the page to come back to) adds a Sign in button under the note, so a guest on a phone has a way in (the header link is desktop only). */
export function SignInNote({ children, from }: { children: ReactNode; from?: string }) {
  return (
    <>
      <Banner tone="info" title="Sign in to continue.">
        {children}
      </Banner>
      {from ? <div className="mt-3"><Button size="l" block href={signInHref(from)}>Sign in</Button></div> : null}
    </>
  );
}

/** What a person has typed so far on the Write screen, kept in this browser only (V-19). One per question or per reply.
 *  Given a person, the words live in that person's own table (`TYPING_V2`): nobody else's words are ever shown, block, overwrite or clear
 *  them, and a guest's words move to the person who signs in. Words in main's table (`TYPING`, no person) are taken, once, by the first
 *  person or guest who opens that slot. Not given a person: main's table, exactly as before. */
const TYPING = "voices-typing-drafts";
const TYPING_V2 = "voices-typing-v2";
type TypedItem = { t: string; at: number };
type TypedPeople = Record<string, Record<string, TypedItem>>;
const readJson = <T,>(key: string): T => { try { return JSON.parse(window.localStorage.getItem(key) ?? "{}") as T; } catch { return {} as T; } };
const typedMemory: TypedPeople = {}; // when storage throws, this page keeps its own copy
let typedBlocked = false;
const readPeopleTyped = (): TypedPeople => { if (typedBlocked) return typedMemory; const v = readJson<TypedPeople>(TYPING_V2); return v && typeof v === "object" ? v : {}; };
function writePeopleTyped(all: TypedPeople): void {
  Object.keys(typedMemory).forEach((k) => delete typedMemory[k]);
  Object.assign(typedMemory, all);
  try { window.localStorage.setItem(TYPING_V2, JSON.stringify(all)); } catch { typedBlocked = true; }
}
/** A real person's table for this slot, after taking main's words for this slot if there are any (the guest claim, and the first opener after the update). */
function typedTable(person: string, slot: string): { all: TypedPeople; mine: Record<string, TypedItem> } {
  const all = readPeopleTyped();
  const mine = (all[person] ??= {});
  const legacy = readJson<Record<string, string>>(TYPING);
  if (currentOwner() === person && typeof legacy[slot] === "string" && legacy[slot] && !mine[slot]) {
    mine[slot] = { t: legacy[slot], at: Date.now() };
    delete legacy[slot];
    try { window.localStorage.setItem(TYPING, JSON.stringify(legacy)); } catch { /* ignore */ }
    writePeopleTyped(all);
  }
  return { all, mine };
}
export function typedDraft(slot: string, person?: Owner): string {
  if (person === undefined || person === null) { try { return readJson<Record<string, string>>(TYPING)[slot] ?? ""; } catch { return ""; } }
  if (signedInAsSomeoneElse(person)) return "";
  return typedTable(person, slot).mine[slot]?.t ?? "";
}
export function saveTyped(slot: string, text: string, person?: Owner): void {
  if (person === undefined || person === null) {
    try {
      const t = readJson<Record<string, string>>(TYPING);
      if (text) t[slot] = text; else delete t[slot];
      window.localStorage.setItem(TYPING, JSON.stringify(t));
    } catch { /* ignore */ }
    return;
  }
  if (signedInAsSomeoneElse(person)) return;
  const { all, mine } = typedTable(person, slot);
  if (text) mine[slot] = { t: text, at: Date.now() }; else delete mine[slot];
  writePeopleTyped(all);
}
/** App start: typed words kept more than 7 days are removed, whoever's they are. */
export function sweepOldTyped(now = Date.now()): void {
  const all = readPeopleTyped();
  let ch = false;
  for (const k of Object.keys(all)) {
    for (const slot of Object.keys(all[k])) if (now - all[k][slot].at > 7 * 24 * 3600 * 1000) { delete all[k][slot]; ch = true; }
    if (!Object.keys(all[k]).length) delete all[k];
  }
  if (ch) writePeopleTyped(all);
}

export function outOfPostsHref(questionId: string): string {
  return `/units/out-of-posts?question=${encodeURIComponent(questionId)}`;
}

/** 402 codes that mean "no free post and not enough tokens". */
export function isOutOfPosts(e: unknown): boolean {
  return e instanceof ApiError && e.status === 402 && (e.code === "FREE_POSTS_EXHAUSTED" || e.code === "INSUFFICIENT_UNITS");
}

/** Tokens as the screens say them: "5 tokens", "1 token", "3.33 tokens" (up to 2 decimals). */
export function unitsText(milli: number): string {
  return `${tokensLabel(milli)} ${milli === 1000 ? "token" : "tokens"}`;
}
/** What this text costs to post, with the same character count and rounding as the server (LCH-10). */
export function postPrice(text: string, allow: Allowances) {
  const c = allow.costs;
  const chars = countChars(text.trim());
  const cost = textCostMilli(chars, c.textPostMilli, c.textPriceChars ?? 150);
  const covered = allow.freePostsRemaining > 0 && chars <= (c.freePostTextChars ?? 500);
  return {
    chars,
    cost,
    covered,
    /** Free posts remain, but this text is too long for one: it pays in full. */
    paid: allow.freePostsRemaining > 0 && !covered,
    text: `${unitsText(cost)} (${nairaOfMilli(cost, c.baseKoboPerUnit)})`,
    short: unitsText(cost),
    label: covered || chars === 0 ? "Post" : `Post · ${unitsText(cost)}`,
  };
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
      claimPlayback(audio.current, me.current.stop);
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
