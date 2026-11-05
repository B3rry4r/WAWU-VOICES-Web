import type { Profile } from "@/lib/api/profile";

const LAGOS = "Africa/Lagos";

/** "Enugu": a city if there is one, else the state. */
export function placeLabel(p: Pick<Profile, "city" | "state">): string | undefined {
  return p.city?.trim() || p.state?.trim() || undefined;
}

/** "Joined Nov 2026" in the Lagos calendar. */
export function joinedLabel(iso: string): string {
  const d = new Date(iso);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: LAGOS }).format(d);
  const year = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: LAGOS }).format(d);
  return `Joined ${month} ${year}`;
}

/** "5m", "4h", "2d", then "12 Oct" (Lagos). */
export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: LAGOS }).format(new Date(iso));
}

/** Milli-units to the figure shown: 12500 -> "12.5", 12000 -> "12", 100 -> "0.1". */
export function unitsFigure(milli: number): string {
  const v = Math.round(milli / 100) / 10;
  return String(v);
}

/** The words the screen uses for a clock given as minutes after midnight, e.g. 480 -> "8am". */
export function minuteLabel(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const HANDLE_RE = /^[a-z0-9._]{3,20}$/;
/** Same rule the API uses (3 to 20 of a-z 0-9 . _), lower-cased. Returns an error line or null. */
export function handleProblem(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  if (h.length < 3 || h.length > 20) return "Use 3 to 20 characters.";
  if (!HANDLE_RE.test(h)) return "Use only letters, numbers, dots and underscores.";
  return null;
}

/** Plain words for the API's handle-check reasons (same sentences as the API's own messages). */
export const HANDLE_REASON: Record<string, string> = {
  TOO_SHORT: "A handle needs at least 3 characters.",
  TOO_LONG: "A handle can have at most 20 characters.",
  BAD_CHARACTERS: "Use only letters, numbers, dots and underscores.",
  BAD_SHAPE: "A handle cannot start or end with a dot or underscore.",
  RESERVED: "That handle is not available.",
  TAKEN: "That handle is taken.",
};
