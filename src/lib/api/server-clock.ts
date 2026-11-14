/**
 * The difference between the server clock and this device's clock, read from the API's `Date` header on answers the app
 * already gets (no extra request). The newest value is kept in memory. The header has whole seconds and arrives after it
 * was written, so the corrected time is never ahead of the server: a screen never turns live early. When the header is
 * missing or cannot be read (a cross-origin API that does not expose it), nothing changes and the device clock is used.
 */
let offsetMs = 0;

/** Remember what an answer says about the server clock: its `Date` header, and `Age` when a cache held it for a while. */
export function noteServerDate(date: string | null | undefined, age?: string | null): void {
  if (!date) return;
  const at = Date.parse(date);
  if (!Number.isFinite(at)) return;
  const held = Number(age);
  offsetMs = at + (Number.isFinite(held) && held > 0 ? held * 1000 : 0) - Date.now();
}

/** The server's own time for an instant it gave us (a page it drew): same rule, no header. */
export function noteServerTime(serverMs: number): void {
  if (Number.isFinite(serverMs)) offsetMs = serverMs - Date.now();
}

/** Epoch ms on the server's clock, as far as this device knows. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** For tests. */
export function resetServerClock(): void {
  offsetMs = 0;
}
