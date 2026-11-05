"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/vx";
import { barHeights, makePlayer, playWithResign } from "./playback";
import { getPlayUrl, type VoiceClip } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";
import { clock } from "./clock";

/** The voice player of the design (vx-player markup), playing the real clip through GET /voice-clips/{id}/play. */
export function ClipPlayer({ clip, label = "voice" }: { clip: VoiceClip; label?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const dur = Math.max(1, Math.round((clip.durationMs ?? 0) / 1000));
  const bars = clip.peaks && clip.peaks.length ? barHeights(clip.peaks) : Array.from({ length: 34 }, (_, i) => 20 + ((i * 37) % 60));

  useEffect(() => () => { audio.current?.pause(); audio.current = null; }, []);

  async function resolveUrl() {
    return (await getPlayUrl(clip.id, isSignedIn())).url;
  }
  async function toggle() {
    setFailed(false);
    try {
      if (!audio.current) {
        const a = makePlayer(await resolveUrl());
        a.ontimeupdate = () => setProg(a.duration ? a.currentTime / a.duration : 0);
        a.onended = () => { setPlaying(false); setProg(0); };
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      }
      const a = audio.current;
      if (a.paused) { a.playbackRate = speed; await playWithResign(a, resolveUrl); } else a.pause();
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audio.current;
    if (!a || !a.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
  }
  function cycle() {
    const n = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(n);
    if (audio.current) audio.current.playbackRate = n;
  }
  const cut = Math.round(prog * bars.length);
  const left = playing || prog > 0 ? dur * (1 - prog) : dur;
  return (
    <div className="vx-player">
      <button type="button" className="vx-player__play" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} ${label}, ${dur} seconds`}>
        <Icon name={playing ? "pause" : "play"} size={22} fill strokeWidth={1.5} />
      </button>
      <div className="vx-player__track" role="slider" tabIndex={0} aria-label="Position" aria-valuemin={0} aria-valuemax={dur} aria-valuenow={Math.round(prog * dur)} onClick={seek}>
        {bars.map((b, i) => <i key={i} className={i < cut ? "on" : ""} style={{ height: Math.round(6 + (b / 100) * 30) }} />)}
      </div>
      <span className="vx-player__time">{clock(left)}</span>
      <button type="button" className="vx-player__speed" aria-label={`Playback speed ${speed}x`} onClick={cycle}>{speed + "x"}</button>
      {failed ? <span className="pf-note pf-note--err" role="alert">Could not play this recording. Try again.</span> : null}
    </div>
  );
}
