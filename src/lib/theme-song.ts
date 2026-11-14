/**
 * The VOICES theme song (V-43), played the way WHO MADE THIS plays its theme (R-99): one audio element owned by this module, not by
 * any button, so the song keeps playing while a person moves between pages and the control can live wherever it is needed.
 *
 * - It never starts before a gesture: browsers refuse sound without one. Two things call play(): toggle() (a click on the speaker) and
 *   armFirstTap() (V-SONG-FIRST-TAP, owner 14 Nov 2026): the visitor's first pointerdown, pointerup, keydown, touchstart, touchend or click anywhere on a page that
 *   shows the speaker button starts the song, once. It never starts by itself for a signed-in person, after the visitor turned the song
 *   off (remembered in localStorage, like the theme), or when the first interaction is on a voice player or recorder.
 * - The file is not fetched until then (preload none): many visitors are on mobile data.
 * - The last choice made with the button is also kept for the session (sessionStorage).
 * - A failed load or a refusal says so in plain words (lastError), never a speaker over silence.
 */
import { sessionStorage as authStorage } from "@/lib/auth/session-storage";

export const THEME_SONG_URL = "/voices-theme.mp3";
const KEY = "voices.song";
/** The visitor turned the song off with the speaker button: on this browser it never starts by itself again. */
export const OFF_KEY = "voices.song.off";
/** A tap on any of these is a voice being played or recorded: it never starts the song. */
export const VOICE_SELECTOR = ".vx-player, .vx-rec, [data-voice-control]";
/** The speaker button and its row: its own click decides, so the first tap there must not also auto-start. */
export const SONG_CONTROL_SELECTOR = "[data-song-control]";
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

function setOffChoice(off: boolean) {
  try {
    if (off) window.localStorage.setItem(OFF_KEY, "1"); else window.localStorage.removeItem(OFF_KEY);
  } catch { /* storage unavailable: the choice still holds for this page */ }
}

/** True when the visitor turned the song off with the button on this browser. */
export function songTurnedOff(): boolean {
  try { return window.localStorage.getItem(OFF_KEY) === "1"; } catch { return false; }
}

/**
 * A voice is about to play or be recorded: the song steps aside. It does not write the person's "off" choice and does not come back by
 * itself; the speaker button brings it back. It never creates the audio element.
 */
export function pauseSongForVoice() {
  if (el && !el.paused) el.pause();
  if (state.playing || state.loading) set({ playing: false, loading: false });
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
  if (state.playing || state.loading) { setOffChoice(true); stopSong(); return; }
  set({ loading: true, error: null });
  try {
    await audio.play();
    setOffChoice(false);
    remember(true);
    set({ playing: true, loading: false, error: null });
  } catch {
    remember(false);
    set({ playing: false, loading: false, error: SONG_FAILED });
  }
}

// A touch tap only counts as a user activation on pointerup, touchend and click (not on pointerdown or touchstart), so a phone needs
// the later three; a mouse press and a key press count at once. The first one the browser accepts starts the song, once.
const TAP_EVENTS = ["pointerdown", "pointerup", "keydown", "touchstart", "touchend", "click"] as const;
let armed = 0;
let trying = false;
let listening = false;
/** The first interaction has been used (for the song, or for a voice or the speaker): later pages never arm it again. */
let spent = false;

function onFirstTap(e: Event) {
  if (trying) return;
  const t = e.target instanceof Element ? e.target : null;
  // A tap on a voice or on the speaker itself is never the song's cue; it also uses up the first tap (the visitor is busy with that).
  if (t && (t.closest(VOICE_SELECTOR) || t.closest(SONG_CONTROL_SELECTOR))) { stopListening(); return; }
  if (songTurnedOff() || state.playing || state.loading || signedIn()) { stopListening(); return; }
  const audio = element();
  if (!audio) return;
  trying = true;
  set({ loading: true, error: null });
  audio.play().then(
    () => { remember(true); set({ playing: true, loading: false, error: null }); stopListening(); },
    // The browser did not count this gesture: stay quiet (no error, no remembered choice) and try again on the next one.
    () => { set({ playing: false, loading: false }); },
  ).finally(() => { trying = false; });
}

function signedIn(): boolean {
  try { return !!authStorage.getToken(); } catch { return false; }
}

function stopListening() {
  spent = true;
  if (!listening) return;
  listening = false;
  for (const n of TAP_EVENTS) document.removeEventListener(n, onFirstTap, true);
}

/**
 * Called by every mounted speaker button. While at least one is on the page, the visitor's first pointerdown, keydown or touchstart
 * starts the song. The listener only watches (capture, passive): the tap still does what it was for. Returns the disarm function.
 */
export function armFirstTap(): () => void {
  if (typeof document === "undefined") return () => {};
  armed++;
  if (!spent && !listening && !songTurnedOff() && !state.playing) {
    listening = true;
    for (const n of TAP_EVENTS) document.addEventListener(n, onFirstTap, { capture: true, passive: true });
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    armed--;
    if (armed <= 0) { armed = 0; stopListening(); }
  };
}

/** For tests: forget that the first interaction was used. */
export function resetFirstTapForTests() { spent = false; armed = 0; trying = false; stopListening(); spent = false; }
