/**
 * The VOICES theme song (V-43), played the way WHO MADE THIS plays its theme (R-99): one audio element owned by this module, not by
 * any button, so the song keeps playing while a person moves between pages and the control can live wherever it is needed.
 *
 * - It never starts before a tap: browsers refuse sound without a gesture, so only toggle() (called from a click) calls play().
 * - The file is not fetched until the first tap (preload none): most visitors never turn it on and many are on mobile data.
 * - On or off is remembered for the session (sessionStorage). A reload starts silent, because a reload is not a tap.
 * - A failed load or a refusal says so in plain words (lastError), never a speaker over silence.
 */
export const THEME_SONG_URL = "/voices-theme.mp3";
const KEY = "voices.song";
export const SONG_FAILED = "The song could not be played. Check your connection and try again.";

export type SongState = { playing: boolean; loading: boolean; error: string | null };

let el: HTMLAudioElement | null = null;
let state: SongState = { playing: false, loading: false, error: null };
const listeners = new Set<() => void>();

function set(next: Partial<SongState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function element(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio(THEME_SONG_URL);
    el.loop = true;
    el.preload = "none";
    // The browser can pause it for its own reasons (a call, another app): show what is true.
    el.addEventListener("pause", () => set({ playing: false, loading: false }));
    el.addEventListener("playing", () => set({ playing: true, loading: false, error: null }));
    el.addEventListener("error", () => set({ playing: false, loading: false, error: SONG_FAILED }));
  }
  return el;
}

function remember(on: boolean) {
  try { window.sessionStorage.setItem(KEY, on ? "on" : "off"); } catch { /* the choice still holds for this page */ }
}

/** What the person chose earlier in this session ("on", "off" or nothing). It never starts the song by itself. */
export function rememberedChoice(): "on" | "off" | null {
  try {
    const v = window.sessionStorage.getItem(KEY);
    return v === "on" || v === "off" ? v : null;
  } catch { return null; }
}

export function getSongState(): SongState { return state; }
export function subscribeSong(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function stopSong() {
  element()?.pause();
  remember(false);
  set({ playing: false, loading: false });
}

/** Call from a click or tap only. Starts the song if it is off, stops it if it is on. */
export async function toggleSong(): Promise<void> {
  const audio = element();
  if (!audio) return;
  if (state.playing || state.loading) { stopSong(); return; }
  set({ loading: true, error: null });
  try {
    await audio.play();
    remember(true);
    set({ playing: true, loading: false, error: null });
  } catch {
    remember(false);
    set({ playing: false, loading: false, error: SONG_FAILED });
  }
}
