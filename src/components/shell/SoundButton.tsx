"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getSongState, subscribeSong, toggleSong, type SongState } from "@/lib/theme-song";

const SERVER: SongState = { playing: false, loading: false, error: null };

/** The song's state for any control (the round button and the Settings row share it). */
export function useSong(): SongState {
  return useSyncExternalStore(subscribeSong, getSongState, () => SERVER);
}

/** V-43: the round sound button. Starts and stops the VOICES theme song; a failed load is said in words under it. */
export function SoundButton({ className }: { className?: string }) {
  const s = useSong();
  return (
    <span className="sh-sound">
      <button
        type="button"
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
