import { pauseSongForVoice } from "@/lib/theme-song";
/** Playback. The server returns a short-lived signed URL (15 min). There is no download control and no "save as";
 *  the element is created in script with controlsList=nodownload so it never shows one. */
export function makePlayer(url: string): HTMLAudioElement {
  const a = new Audio();
  a.preload = 'metadata';
  a.setAttribute('controlsList', 'nodownload noplaybackrate');
  a.setAttribute('playsinline', '');
  a.oncontextmenu = (e) => e.preventDefault();
  a.src = url;
  return a;
}

/** Re-sign once when the URL lapses mid-session (403 on play). */
export async function playWithResign(a: HTMLAudioElement, resign: () => Promise<string>): Promise<void> {
  pauseSongForVoice();
  try { await a.play(); } catch { a.src = await resign(); await a.play(); }
}

/** Waveform bars from the server's 48 peak values (0..255) to CSS heights. The server computes them once at upload. */
export function barHeights(peaks: number[], minPct = 8): number[] {
  return peaks.map((p) => Math.max(minPct, Math.round((p / 255) * 100)));
}
