import { recordShareEvent } from "@/lib/api/reach";

/**
 * Share measurement for one visit (addendum 6: "recordings started, and voices published from a shared link").
 * A visit is this browser tab: the share link a person opened or tapped "Add your voice" on is remembered for the tab (sessionStorage), the
 * recorder starting sends `recording_started` once, and the first post after it sends `published_from_link` once. Only the 7 character
 * link code is kept, never anything about the person. Storage can be blocked, so every call is guarded and a blocked tab sends nothing.
 * A /go link is a personal invite code (not a share link), so it has no link to count against and is not measured here.
 */
const KEY = "voices-share-visit";
const CODE_RE = /^[a-z0-9]{7}$/;
interface Visit { code: string; started?: boolean; published?: boolean }

function read(): Visit | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Visit;
    return v && typeof v.code === "string" && CODE_RE.test(v.code) ? v : null;
  } catch {
    return null;
  }
}

function write(v: Visit): void {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* nothing to remember it in */ }
}

/** The first link a tab arrives by wins, as with the invite cookie; a new link after the visit was counted starts a new visit. */
export function rememberShareVisit(code: string | null | undefined): void {
  const c = (code ?? "").trim().toLowerCase();
  if (!CODE_RE.test(c)) return;
  const have = read();
  if (have && have.code === c) return;
  if (have && !have.published) return; // an open visit keeps its first link
  write({ code: c });
}

/** The share link this visit came by, or null. */
export function shareVisitCode(): string | null {
  return read()?.code ?? null;
}

/** A kept recording that came from a share link was posted later (by the outbox, possibly in another visit): count it once. */
export function publishedFromLink(code: string | null | undefined): void {
  if (code && CODE_RE.test(code)) void recordShareEvent(code, "published_from_link");
}

/** The recorder started (the microphone is open). Once per visit. */
export function noteRecordingStarted(): void {
  const v = read();
  if (!v || v.started) return;
  write({ ...v, started: true });
  void recordShareEvent(v.code, "recording_started");
}

/** A voice or an answer in words was published. Once per visit, and only in a visit that came by a share link. */
export function notePublished(): void {
  const v = read();
  if (!v || v.published) return;
  write({ ...v, published: true });
  void recordShareEvent(v.code, "published_from_link");
}
