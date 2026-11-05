/* Playback helpers (local copy of the reference audio player: its sibling index does not build, see voiceCardRecorder.ts). */
export function makePlayer(url: string): HTMLAudioElement {
  const a = new Audio();
  a.preload = "metadata";
  a.setAttribute("controlsList", "nodownload noplaybackrate");
  a.setAttribute("playsinline", "");
  a.oncontextmenu = (e) => e.preventDefault();
  a.src = url;
  return a;
}

/** Re-sign once when the URL lapses mid-session. */
export async function playWithResign(a: HTMLAudioElement, resign: () => Promise<string>): Promise<void> {
  try { await a.play(); } catch { a.src = await resign(); await a.play(); }
}

/** Waveform bars from the server's peak values (0..255) to heights in percent. */
export function barHeights(peaks: number[], minPct = 8): number[] {
  return peaks.map((p) => Math.max(minPct, Math.round((p / 255) * 100)));
}
