import { ApiError } from "@/lib/api/client";
import type { DmLimits } from "@/lib/api/dm";
import { countChars, textCostMilli, tokensLabel } from "@/lib/shared/text-price";

/** The longest text message, in characters (the same 5,000 as the server). */
export const DM_MAX_CHARS = 5000;
/** How often the unread number on the messages icon is asked for while a page is open. */
export const UNREAD_POLL_MS = 30_000;
/** The page a refused sender is sent to for the subscription plans. */
export const PLANS_HREF = "/units/buy";

/** What a direct message costs, from GET /dm/limits (config on the server, 0 is free). Never typed into a screen. */
export type DmCosts = Pick<DmLimits, "textPriceMilli" | "textPriceChars" | "voicePriceMilli" | "voiceMaxSeconds" | "messagesLeftToday">;

export function textPrice(text: string, c: DmCosts): { chars: number; milli: number } {
  const chars = countChars(text.trim());
  return { chars, milli: textCostMilli(chars, c.textPriceMilli, c.textPriceChars) };
}

/** One price for a voice message of any length up to the longest. */
export function voicePrice(_seconds: number, c: DmCosts): number {
  return c.voicePriceMilli;
}

/** The line under the composer. The design says "Messages are free. Voice messages are up to 10 seconds."; the number is the configured one. */
export function caption(c: DmCosts | null): string {
  if (!c) return "";
  if (c.textPriceMilli === 0 && c.voicePriceMilli === 0) return `Messages are free. Voice messages are up to ${c.voiceMaxSeconds} seconds.`;
  const text = c.textPriceMilli === 0 ? "Text messages are free." : `Text costs ${tokensText(c.textPriceMilli)} for every ${c.textPriceChars} characters.`;
  const voice = c.voicePriceMilli === 0 ? "Voice messages are free" : `A voice message costs ${tokensText(c.voicePriceMilli)}`;
  return `${text} ${voice} and can be up to ${c.voiceMaxSeconds} seconds.`;
}

export function tokensText(milli: number): string {
  return `${tokensLabel(milli)} ${milli === 1000 ? "token" : "tokens"}`;
}

/** What each refusal says on the screen. `plans` means the screen also shows the "See subscription plans" link. */
export interface DmFailure { text: string; plans: boolean; buy: boolean }

export function dmFailure(e: unknown): DmFailure {
  const f = (text: string, o: Partial<DmFailure> = {}): DmFailure => ({ text, plans: false, buy: false, ...o });
  if (!(e instanceof ApiError)) return f("Something went wrong. Try again in a moment.");
  if (e.status === 0) return f("You are offline. Check your connection and try again.");
  switch (e.code) {
    case "verification_required": return f("Subscribe and get verified to send messages.", { plans: true });
    case "blocked":
    case "recipient_unavailable": return f("You can't message this person.");
    case "dm_closed": return f("This person is not taking messages.");
    case "ACCOUNT_SUSPENDED": return f("Your account is suspended, so you cannot send messages right now.");
    case "DAILY_LIMIT_REACHED": return f("You have sent the most messages one day allows. Come back after midnight.");
    case "RATE_LIMITED": return f("You are going fast. Wait a moment and try again.");
    case "INSUFFICIENT_UNITS":
    case "FREE_POSTS_EXHAUSTED": return f("You need more tokens to send this message.", { buy: true });
    case "VOICE_TOO_LONG": return f(`That voice message is too long.`);
    case "VALIDATION_FAILED": return f("Check your message and try again.");
    case "UNAUTHENTICATED":
    case "TOKEN_EXPIRED": return f("Sign in to continue.");
    default: return f("Something went wrong on our side. Try again in a moment.");
  }
}

/** The inbox's time label: 2m, 3h, Yesterday, Mon, then the date. */
export function when(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24 && d.getDate() === now.getDate()) return `${Math.round(mins / 60)}h`;
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days <= 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-NG", { weekday: "short" });
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/** The chat's time under a bubble: 9:41am. */
export function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s/g, "").toLowerCase();
}

/** The chat's day divider: Today, Yesterday, then the date. */
export function dayLabel(iso: string, now = new Date()): string {
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(new Date(iso).toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" });
}

export const personName = (p: { handle: string; displayName: string | null; deleted: boolean }) => (p.deleted ? "Deleted account" : p.displayName ?? `@${p.handle}`);
