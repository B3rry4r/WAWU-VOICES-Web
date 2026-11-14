import { onSongStart, pauseSongForVoice } from "@/lib/theme-song";
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

/**
 * One clip at a time (V-FIX-B round 2). Whatever starts playing, an answer, a reply, the override's voice note or an audio
 * advert, first stops the clip that is playing: its audio is paused and its own `stop` runs so its button shows Play again.
 */
let current: { a: HTMLAudioElement; stop: () => void } | null = null;
export function claimPlayback(a: HTMLAudioElement, stop: () => void): void {
  if (current && current.a !== a) {
    const prev = current;
    current = null;
    try { prev.stop(); } catch { /* a card that is gone */ }
    prev.a.pause();
  }
  current = { a, stop };
  a.addEventListener("ended", () => { if (current?.a === a) current = null; }, { once: true });
}
// Starting the theme song stops a playing clip or preview (the song side of one clip at a time).
onSongStart(() => stopPlayback());

/** Stops whatever clip is playing (an advert's link was opened). */
export function stopPlayback(): void {
  if (!current) return;
  const prev = current;
  current = null;
  try { prev.stop(); } catch { /* gone */ }
  prev.a.pause();
}
/** The clip that is playing lets go (it was paused or unmounted). */
export function releasePlayback(a: HTMLAudioElement): void {
  if (current?.a === a) current = null;
}

/** Re-sign once when the URL lapses mid-session. */
export async function playWithResign(a: HTMLAudioElement, resign: () => Promise<string>): Promise<void> {
  pauseSongForVoice();
  try { await a.play(); } catch { a.src = await resign(); await a.play(); }
}

/** Waveform bars from the server's peak values (0..255) to heights in percent. */
export function barHeights(peaks: number[], minPct = 8): number[] {
  return peaks.map((p) => Math.max(minPct, Math.round((p / 255) * 100)));
}
