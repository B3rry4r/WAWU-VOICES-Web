"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/vx";
import { clock } from "@/components/vx/helpers";
import { barHeights, makePlayer, playWithResign } from "@/lib/audio-ref/player";
import { getPlayUrl } from "@/lib/api/reach";

/** A voice player for a public page: asks the API for a short-lived URL on first play, never offers a download. */
export function ClipPlayer({ clipId, durationMs, peaks }: { clipId: string; durationMs: number | null; peaks: number[] | null }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [failed, setFailed] = useState(false);
  const total = Math.max(1, Math.round((durationMs ?? 0) / 1000));
  const bars = peaks && peaks.length ? barHeights(peaks) : Array.from({ length: 34 }, (_, i) => 20 + ((i * 37) % 60));

  useEffect(() => () => { audio.current?.pause(); audio.current = null; }, []);

  async function toggle() {
    setFailed(false);
    try {
      if (!audio.current) {
        const first = await getPlayUrl(clipId);
        const a = makePlayer(first.url);
        a.ontimeupdate = () => setProg(a.duration ? a.currentTime / a.duration : 0);
        a.onended = () => { setPlaying(false); setProg(0); };
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      }
      const a = audio.current;
      if (!a.paused) { a.pause(); return; }
      await playWithResign(a, async () => (await getPlayUrl(clipId)).url);
    } catch {
      setFailed(true);
      setPlaying(false);
    }
  }

  const cut = Math.round(prog * bars.length);
  return (
    <div className="flex flex-col gap-1">
      <div className="vx-player">
        <button type="button" className="vx-player__play" onClick={() => void toggle()} aria-label={(playing ? "Pause" : "Play") + " voice, " + total + " seconds"}>
          <Icon name={playing ? "pause" : "play"} size={22} fill strokeWidth={1.5} />
        </button>
        <div className="vx-player__track" aria-hidden="true">
          {bars.map((h, i) => <i key={i} className={i < cut ? "on" : ""} style={{ height: Math.max(6, Math.round(h * 0.36)) }} />)}
        </div>
        <span className="vx-player__time">{clock(playing || prog > 0 ? total * (1 - prog) : total)}</span>
      </div>
      {failed ? <p className="m-0 text-[13px] leading-4 text-danger" role="alert">This voice is not ready to play yet.</p> : null}
    </div>
  );
}
