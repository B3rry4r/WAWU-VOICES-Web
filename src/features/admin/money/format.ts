/** Display only. Every figure arrives from the API already summed; nothing here adds anything up. */

const NG = "en-NG";

/** Kobo as naira with separators: 1464000 reads "₦14,640", 19953 reads "₦199.53". */
export function naira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "-";
  const whole = kobo % 100 === 0;
  return `₦${(kobo / 100).toLocaleString(NG, whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Milli-tokens as tokens: 183000 reads "183", 16670 reads "16.67". */
export function tokens(milli: number | null | undefined): string {
  if (milli === null || milli === undefined) return "-";
  return (milli / 1000).toLocaleString(NG, { maximumFractionDigits: 3 });
}

/** A signed token amount for the ledger: "+50", "-5". */
export function signedTokens(milli: number): string {
  return `${milli > 0 ? "+" : ""}${tokens(milli)}`;
}

/** Basis points as a percent: 750 reads "7.5%". */
export function percent(bps: number): string {
  return `${(bps / 100).toLocaleString(NG, { maximumFractionDigits: 2 })}%`;
}

export const count = (n: number): string => n.toLocaleString(NG);

const KIND_WORDS: Record<string, string> = { UNITS: "Token pack", SUBSCRIPTION: "Subscription", EXTRA_VOICE: "Extra voice" };
export const kindWord = (k: string): string => KIND_WORDS[k] ?? k;

const STATUS_WORDS: Record<string, string> = {
  INITIATED: "Started",
  PENDING: "Pending",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
  ACTIVE: "Active",
  QUEUED: "Waiting to start",
  ENDED: "Ended",
  CANCELLED_DELETED: "Account deleted",
};
export const statusWord = (s: string): string => STATUS_WORDS[s] ?? s;

/** "Mon 30 Nov" from a Lagos calendar day "2026-11-30". */
export function dayWords(day: string | null | undefined): string {
  if (!day) return "-";
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).formatToParts(new Date(`${day}T12:00:00Z`))) p[x.type] = x.value;
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** Whole naira or kobo typed by a person to kobo. Returns null when it is not a sensible amount. */
export function koboFromNaira(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Tokens typed by a person to milli-tokens (up to 3 decimals). */
export function milliFromTokens(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  return Math.round(Number(t) * 1000);
}

/** A percent typed by a person to basis points (up to 2 decimals). */
export function bpsFromPercent(text: string): number | null {
  const t = text.trim().replace(/%/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
