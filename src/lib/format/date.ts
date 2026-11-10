/**
 * The one place dates, clock times and countdowns are written. Every screen reaches the clock through here, so the
 * app says "5 Nov 2026", "12:39am" and "23 h" the same way everywhere. All times are Lagos time (Africa/Lagos,
 * UTC+1, no daylight saving), whatever the viewer's device says.
 */
export const LAGOS = "Africa/Lagos";

type When = string | number | Date;

const asDate = (w: When): Date => (w instanceof Date ? w : new Date(w));

type Parts = Record<string, string>;

function parts(w: When, o: Intl.DateTimeFormatOptions): Parts {
  const out: Parts = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, ...o }).formatToParts(asDate(w))) out[p.type] = p.value;
  return out;
}

/** "12:39am", "6:00pm": 12 hour clock as the boards draw it, no space, lower case. `short` drops :00 ("6pm"). */
export function clock(w: When, o: { short?: boolean } = {}): string {
  const p = parts(w, { hour: "numeric", minute: "2-digit", hourCycle: "h12" });
  const mer = (p.dayPeriod ?? "").toLowerCase();
  return o.short && p.minute === "00" ? `${p.hour}${mer}` : `${p.hour}:${p.minute}${mer}`;
}

/** "5 Nov". */
export function dayMonth(w: When): string {
  const p = parts(w, { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

/** "5 Nov 2026". */
export function date(w: When): string {
  const p = parts(w, { day: "numeric", month: "short", year: "numeric" });
  return `${p.day} ${p.month} ${p.year}`;
}

/** "5 Nov 2026, 12:39am". */
export function dateTime(w: When): string {
  return `${date(w)}, ${clock(w)}`;
}

/** "Nov 2026", or "November 2026" for a heading. */
export function monthYear(w: When, style: "short" | "long" = "short"): string {
  const p = parts(w, { month: style, year: "numeric" });
  return `${p.month} ${p.year}`;
}

/** "Mon" or "Monday". */
export function weekday(w: When, style: "short" | "long" = "short"): string {
  return parts(w, { weekday: style }).weekday;
}

/** "Mon 30 Nov, 10:30am": the admin board's slot. */
export function slot(w: When): string {
  return `${weekday(w)} ${dayMonth(w)}, ${clock(w)}`;
}

/** "8:00": the 24 hour clock the notification list draws. */
export function clock24(w: When): string {
  const p = parts(w, { hour: "numeric", minute: "2-digit", hour12: false });
  return `${p.hour}:${p.minute}`;
}

/** "Sunday 6 Dec, 11:59pm": a deadline with the long weekday. */
export function longSlot(w: When): string {
  return `${weekday(w, "long")} ${dayMonth(w)}, ${clock(w)}`;
}

/** "30 Nov, 6pm": when something publishes (day and month, then the short clock). */
export function published(w: When): string {
  return `${dayMonth(w)}, ${clock(w, { short: true })}`;
}

/** "Tue 8am": the weekday and the short clock, for the next item in a schedule. */
export function weekdayClock(w: When): string {
  return `${weekday(w)} ${clock(w, { short: true })}`;
}

/** The Lagos calendar day as "2026-11-05", for comparing days. */
export function dayKey(w: When): string {
  const p = parts(w, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** Time left, written once: "45 min", "23h", "1 day", "4 days" (the boards: hours have no space, minutes do). Nothing when the time has passed. */
export function countdown(ms: number): string | undefined {
  if (!(ms > 0)) return undefined;
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day" : `${d} days`;
}
