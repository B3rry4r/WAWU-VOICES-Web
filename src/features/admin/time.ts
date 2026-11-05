/** Admin times are shown in Africa/Lagos (WAT, no daylight saving). */
const TZ = "Africa/Lagos";

function parts(d: Date, o: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).formatToParts(d)) out[p.type] = p.value;
  return out;
}

const D = (iso: string | Date) => (iso instanceof Date ? iso : new Date(iso));

/** "8:00am" */
export function clock(iso: string | Date): string {
  const p = parts(D(iso), { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute}${(p.dayPeriod ?? "").toLowerCase()}`;
}

/** "30 Nov" */
export function dayMonth(iso: string | Date): string {
  const p = parts(D(iso), { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

/** "Mon 30 Nov, 10:30am" */
export function slot(iso: string | Date): string {
  const p = parts(D(iso), { weekday: "short" });
  return `${p.weekday} ${dayMonth(iso)}, ${clock(iso)}`;
}

/** "Mon 30" */
export function weekdayDay(iso: string | Date): string {
  const p = parts(D(iso), { weekday: "short", day: "numeric" });
  return `${p.weekday} ${p.day}`;
}

/** "Monday 30 Nov 2026" */
export function longDate(iso: string | Date): string {
  const p = parts(D(iso), { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "25 Nov, 9:00am" */
export function dayClock(iso: string | Date): string {
  return `${dayMonth(iso)}, ${clock(iso)}`;
}

/** "3h", "12m", "2d": how long ago. */
export function ago(iso: string | Date, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - D(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 60 * 48) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

/** Minutes as the board writes them: "3h", "40m". */
export function minutesWords(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 60 * 48) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

/** A calendar day from the API ("2026-11-30") as "30 Nov", and as "Mon 30". */
export function dayStringShort(day: string): string {
  return dayMonth(new Date(day + "T12:00:00+01:00"));
}
export function dayStringWeekday(day: string): string {
  return weekdayDay(new Date(day + "T12:00:00+01:00"));
}
/** "30 Nov to 6 Dec 2026" for a week starting on `startsOn`. */
export function weekRange(startsOn: string): string {
  const a = new Date(startsOn + "T12:00:00+01:00");
  const b = new Date(a.getTime() + 6 * 86400000);
  const y = parts(b, { year: "numeric" }).year;
  return `${dayMonth(a)} to ${dayMonth(b)} ${y}`;
}

/** An <input type="datetime-local"> value ("2026-11-30T10:30") for an instant, read in Lagos. */
export function toLocalInput(iso: string | Date): string {
  const p = parts(D(iso), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The instant for a datetime-local value typed in Lagos time. */
export function fromLocalInput(v: string): string {
  return new Date(`${v}:00+01:00`).toISOString();
}
