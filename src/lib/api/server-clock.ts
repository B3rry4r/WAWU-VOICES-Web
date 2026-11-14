/**
 * What this device knows about the server's clock, without trusting the device clock alone.
 *
 * The server's time is read from the API's `Date` header on answers the app already gets (no extra request), or from the
 * server's own time on a page it drew. A reading is carried forward with `performance.now()`, which never steps, so a
 * device clock that is changed while the page is open (a phone fixing itself, a person setting the time) does not move it.
 * The header has whole seconds and arrives after it was written, so the corrected time is never ahead of the server: a
 * screen never turns live early on this clock. Of two readings the NEWER one (by the time it stands for, not by when it
 * happened to arrive) is kept: an old answer from a cache that arrives late does not move the clock back.
 * Before any reading, the device clock at the first look is the starting point (still carried by `performance.now()`).
 * When the header is missing or cannot be read (a cross-origin API that does not expose it) nothing else changes.
 */
type Anchor = { server: number; mono: number; measured: boolean };
let anchor: Anchor | null = null;

/** Milliseconds from a clock that never steps (the device's monotonic clock). */
export function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function take(serverMs: number): void {
  if (!Number.isFinite(serverMs)) return;
  // `serverMs` is the instant on the server's clock that the reading stands for: the newest reading is the one with the latest instant.
  if (!anchor || !anchor.measured || serverMs > anchor.server) anchor = { server: serverMs, mono: monotonicNow(), measured: true };
}

/** Remember what an answer says about the server clock: its `Date` header, and `Age` when a cache held it for a while. */
export function noteServerDate(date: string | null | undefined, age?: string | null): void {
  if (!date) return;
  const at = Date.parse(date);
  if (!Number.isFinite(at)) return;
  const held = Number(age);
  take(at + (Number.isFinite(held) && held > 0 ? held * 1000 : 0));
}

/** The server's own time for an instant it gave us (a page it drew): same rule, no header. */
export function noteServerTime(serverMs: number): void {
  take(serverMs);
}

/** Epoch ms on the server's clock, as far as this device knows. */
export function serverNow(): number {
  if (typeof window === "undefined") return Date.now(); // the server draws with its own clock; nothing is carried between requests
  if (!anchor) anchor = { server: Date.now(), mono: monotonicNow(), measured: false };
  return anchor.server + (monotonicNow() - anchor.mono);
}

/** For tests. */
export function resetServerClock(): void {
  anchor = null;
}
