/**
 * Listen progress (LISTEN-1, LS2). The player tells the server how much of a clip a person has played: on pause, on end
 * and on leaving the page. At most one report per clip every 10 seconds: a report that comes sooner is held and sent
 * when the 10 seconds are up, carrying the furthest point reached. It never throws and never waits: playback does not
 * depend on it, and a failed report is dropped silently.
 */
export const REPORT_GAP_MS = 10_000;

export interface ListenProgress { secondsPlayed: number; finished: boolean }

export interface ListenReporter {
  /** Seconds reached so far, and whether the clip reached 90%. */
  progress(secondsPlayed: number, finished: boolean): void;
  /** Stops a held report (the player is gone). */
  dispose(): void;
}

export function createListenReporter(
  send: (p: ListenProgress) => unknown,
  opts: { gapMs?: number; now?: () => number } = {},
): ListenReporter {
  const gap = opts.gapMs ?? REPORT_GAP_MS;
  const now = opts.now ?? Date.now;
  let lastAt = -Infinity;
  let sent = -1;
  let sentFinished = false;
  let held: ListenProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    const p = held;
    held = null;
    if (!p) return;
    lastAt = now();
    sent = p.secondsPlayed;
    sentFinished = p.finished;
    try {
      const r = send(p);
      if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => undefined);
    } catch { /* silent */ }
  }

  return {
    progress(secondsPlayed, finished) {
      const s = Math.max(0, Math.round(secondsPlayed));
      const f = finished || (held?.finished ?? false);
      const top = Math.max(s, held?.secondsPlayed ?? 0);
      // Nothing new since the last report (the end of a clip also fires a pause just before it).
      if (top <= sent && (!f || sentFinished)) return;
      if (top <= 0 && !f) return;
      held = { secondsPlayed: top, finished: f };
      const wait = lastAt + gap - now();
      if (wait <= 0) flush();
      else if (!timer) timer = setTimeout(flush, wait);
    },
    dispose() {
      if (timer) { clearTimeout(timer); timer = null; }
      held = null;
    },
  };
}
