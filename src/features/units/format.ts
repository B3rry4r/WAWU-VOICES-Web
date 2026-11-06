import { clock, date, dateTime, dayKey, dayMonth } from "@/lib/format/date";
import type { ActionCosts, LedgerItem, Payment, UnitTier } from "@/lib/api/units";

/* Display helpers for money and units. Money is kobo, units are milli-units (1 unit = 1000), never floats on the wire. */

const MINUS = "−"; // a minus sign, not an em-dash

/** Kobo as naira: whole naira without decimals, otherwise two decimals. 13800 -> "₦138", 690 -> "₦6.90", 138000 -> "₦1,380". */
export function naira(kobo: number): string {
  const whole = kobo % 100 === 0;
  return "₦" + (kobo / 100).toLocaleString("en-NG", whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Kobo as naira with two decimals always: a price per unit, 1200 -> "₦12.00". */
export function nairaExact(kobo: number): string {
  return "₦" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Milli-units as a count: 12500 -> "12.5", 55000 -> "55", 500 -> "0.5". */
export function units(milli: number): string {
  return (milli / 1000).toLocaleString("en-NG", { maximumFractionDigits: 3 });
}

/** "1 unit", "0.5 units", "12.5 units", "0 units": plural for every value except exactly 1. */
export function unitsLabel(milli: number): string {
  return `${units(milli)} ${Math.abs(milli) === 1000 ? "unit" : "units"}`;
}

/** What an amount of units is worth in naira at the base rate, for display only: 500 milli at 1380 kobo -> "₦6.90". */
export function nairaOfUnits(milli: number, baseKoboPerUnit: number): string {
  return naira(Math.round((milli * baseKoboPerUnit) / 1000));
}

export function signedUnits(milli: number): string {
  if (milli > 0) return "+" + units(milli);
  if (milli < 0) return MINUS + units(-milli);
  return units(0);
}

/** "6:14 pm" in Lagos time. */
export function clockLagos(d: Date): string {
  return clock(d);
}

/** "2 Dec 2026, 6:14 pm" in Lagos time. */
export function dateTimeLagos(iso: string): string {
  return dateTime(iso);
}

/** The day label for a history row: "Today", "Yesterday" or "28 Nov" (with the year when it is not this year). `now` is injectable for tests. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return dayKey(d).slice(0, 4) === dayKey(now).slice(0, 4) ? dayMonth(d) : date(d);
}

/** Phone form: "Today, 9:14 am" for today, otherwise the day alone. Desktop shows the time on every row (`whenLong`). */
export function whenShort(iso: string, now: Date = new Date()): string {
  const day = dayLabel(iso, now);
  return day === "Today" ? `Today, ${clockLagos(new Date(iso))}` : day;
}

export function whenLong(iso: string, now: Date = new Date()): string {
  return `${dayLabel(iso, now)}, ${clockLagos(new Date(iso))}`;
}

/** The right-hand figure of a history row: "Free", "₦200" (an extra voice token is naira, not units), "-0.2" or "+26". */
export function ledgerFigure(i: LedgerItem): { text: string; tone: "free" | "plus" | "plain" } {
  if (i.free) return { text: "Free", tone: "free" };
  if (i.deltaMilli === 0 && i.amountKobo !== null) return { text: naira(i.amountKobo), tone: "plain" };
  if (i.deltaMilli > 0) return { text: signedUnits(i.deltaMilli), tone: "plus" };
  return { text: signedUnits(i.deltaMilli), tone: "plain" };
}

/** The second line of a history row, without the day: "free post, 7 left", "used on one message". */
export function ledgerNote(i: LedgerItem): string[] {
  const out: string[] = [];
  if (i.free && i.freePostsLeft !== null) out.push(`free post, ${i.freePostsLeft} left`);
  if (i.note) out.push(i.note);
  return out;
}

export function methodLabel(p: Pick<Payment, "method" | "cardLast4">): string | null {
  const m = (p.method ?? "").toLowerCase();
  if (m === "card") return p.cardLast4 ? `Card ending ${p.cardLast4}` : "Card";
  if (m === "bank_transfer" || m === "banktransfer") return "Bank transfer";
  if (m === "ussd") return "USSD";
  if (p.cardLast4) return `Card ending ${p.cardLast4}`;
  return p.method ? p.method : null;
}

/** The pack line on a result: "Buzz, 55 units (5 bonus)". Tokens keep their own title. */
export function packLine(p: Payment): string {
  if (p.kind !== "UNITS" || p.unitsMilli === null) return p.title;
  const name = p.title.replace(/ pack$/i, "");
  const bonus = p.bonusMilli ? ` (${units(p.bonusMilli)} bonus)` : "";
  return `${name}, ${unitsLabel(p.unitsMilli)}${bonus}`;
}

/** A failure reason is shown only when it reads as a sentence; internal codes become a plain line. */
export function failureText(reason: string | null): string {
  if (reason === "amount_or_currency_mismatch") return "The amount paid does not match this payment.";
  const r = (reason ?? "").trim();
  if (!r || /^[a-z0-9_]+$/.test(r)) return "The payment did not go through.";
  return r.endsWith(".") ? r : r + ".";
}

/** The cheapest pack: smallest price, then most units. */
export function smallestPack(tiers: UnitTier[]): UnitTier | undefined {
  return [...tiers].sort((a, b) => a.priceKobo - b.priceKobo || b.unitsMilli - a.unitsMilli)[0];
}

export function costRows(c: ActionCosts): Array<{ label: string; value: string }> {
  return [
    { label: "Text answer or reply", value: `${unitsLabel(c.textPostMilli)} (${nairaOfUnits(c.textPostMilli, c.baseKoboPerUnit)})` },
    { label: `Voice, up to ${c.freeVoiceSeconds} seconds`, value: `${unitsLabel(c.voicePostMilli)} (${nairaOfUnits(c.voicePostMilli, c.baseKoboPerUnit)})` },
    { label: `Reaction after ${c.freeReactionsPerDay} free a day`, value: unitsLabel(c.reactionAfterFreeMilli) },
    { label: `Vote after ${c.freeVotesPerDay} free a day`, value: unitsLabel(c.voteAfterFreeMilli) },
  ];
}

/** "Extra voice, 30 seconds" / "Extra voice, 1 minute": the title a token purchase carries. */
export function extraVoiceTitle(maxSeconds: number): string {
  return `Extra voice, ${maxSeconds >= 60 && maxSeconds % 60 === 0 ? `${maxSeconds / 60} ${maxSeconds === 60 ? "minute" : "minutes"}` : `${maxSeconds} seconds`}`;
}
