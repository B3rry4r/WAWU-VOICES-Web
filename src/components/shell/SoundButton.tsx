"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { armFirstTap, getSongState, subscribeSong, toggleSong, type SongState } from "@/lib/theme-song";

const SERVER: SongState = { playing: false, loading: false, error: null };

/** The song's state for any control (the round button and the Settings row share it). */
export function useSong(): SongState {
  return useSyncExternalStore(subscribeSong, getSongState, () => SERVER);
}

/** V-43: the round sound button. Starts and stops the VOICES theme song; a failed load is said in words under it. */
export function SoundButton({ className }: { className?: string }) {
  const s = useSong();
  // The first tap anywhere on this page starts the song (V-SONG-FIRST-TAP). Wherever the speaker shows, the song may start;
  // a signed-in person, a visitor who turned it off and a first tap on a voice are left alone inside armFirstTap.
  useEffect(() => armFirstTap(), []);
  return (
    <span className="sh-sound">
      <button
        type="button"
        data-song-control=""
        onClick={() => { void toggleSong(); }}
        aria-pressed={s.playing}
        aria-label={s.playing ? "Stop the VOICES song" : "Play the VOICES song"}
        className={"sh-iconbtn" + (s.playing ? " sh-iconbtn--on" : "") + (className ? " " + className : "")}
      >
        {s.playing ? <Volume2 size={22} aria-hidden="true" /> : <VolumeX size={22} aria-hidden="true" />}
      </button>
      {s.error ? <span role="alert" className="sh-sound__err">{s.error}</span> : null}
    </span>
  );
}
