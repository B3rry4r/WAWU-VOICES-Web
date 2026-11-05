"use client";
import { useEffect, useRef, useState } from "react";
import { VoicePlayer } from "@/components/vx";
import { makePlayer, playWithResign } from "./playback";
import { getPlayUrl, type VoiceClip } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";

const seedOf = (id: string) => id.split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 997, 7);

/** The design's voice player on a real clip: bars from the clip's peaks, progress from the audio element, a short-lived URL asked for on first play. */
export function LivePlayer({ clipId, durationMs, peaks, getUrl, failMessage, tone }: {
  clipId: string;
  durationMs: number | null;
  peaks: number[] | null;
  getUrl: (clipId: string) => Promise<string>;
  failMessage: string;
  tone?: "mint" | "surface" | "forest";
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const speed = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [failed, setFailed] = useState(false);
  const dur = Math.max(1, Math.round((durationMs ?? 0) / 1000));

  useEffect(() => () => { audio.current?.pause(); audio.current = null; }, []);

  async function play() {
    setFailed(false);
    try {
      if (!audio.current) {
        const a = makePlayer(await getUrl(clipId));
        a.ontimeupdate = () => setProg(a.duration ? a.currentTime / a.duration : 0);
        a.onended = () => { setPlaying(false); setProg(0); };
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      }
      audio.current.playbackRate = speed.current;
      setPlaying(true);
      await playWithResign(audio.current, () => getUrl(clipId));
    } catch {
      audio.current = null;
      setFailed(true);
      setPlaying(false);
    }
  }
  function pause() { audio.current?.pause(); setPlaying(false); }
  function seek(f: number) {
    const a = audio.current;
    setProg(f);
    if (a && a.duration) a.currentTime = f * a.duration;
  }
  return (
    <div className="flex flex-col gap-1">
      <VoicePlayer
        tone={tone}
        duration={dur}
        seed={seedOf(clipId)}
        peaks={peaks && peaks.length ? peaks : undefined}
        playing={playing}
        progress={prog}
        onPlay={() => void play()}
        onPause={pause}
        onSeek={seek}
        onSpeedChange={(s) => { speed.current = s; if (audio.current) audio.current.playbackRate = s; }}
      />
      {failed ? <p className="m-0 text-[13px] leading-4 text-danger" role="alert">{failMessage}</p> : null}
    </div>
  );
}

/** Voice Card player (Me, Person, Edit profile). */
export function ClipPlayer({ clip, tone }: { clip: VoiceClip; label?: string; tone?: "mint" | "surface" | "forest" }) {
  return (
    <LivePlayer
      clipId={clip.id}
      durationMs={clip.durationMs}
      peaks={clip.peaks}
      getUrl={async (id) => (await getPlayUrl(id, isSignedIn())).url}
      failMessage="Could not play this recording. Try again."
      tone={tone}
    />
  );
}
