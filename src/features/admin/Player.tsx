"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/vx";
import { makePlayer } from "@/lib/audio-ref/player";

const BARS = [30, 55, 40, 70, 45, 85, 60, 35, 75, 50, 90, 40, 65, 55, 80, 35, 60, 45, 70, 30, 55, 85, 40, 65, 50, 75, 35, 60, 45, 70, 55, 40];

function mmss(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

/** Plays the team-only signed link of a clip. The link is short-lived; a failed play says so instead of looking dead. */
export function AdminPlayer({ url, label, tone = "mint" }: { url: string; label: string; tone?: "mint" | "white" }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const a = makePlayer(url);
    audio.current = a;
    a.onloadedmetadata = () => setDur(a.duration);
    a.ontimeupdate = () => setPos(a.currentTime);
    a.onended = () => {
      setPlaying(false);
      setPos(0);
    };
    a.onerror = () => setFailed(true);
    setFailed(false);
    setPlaying(false);
    setPos(0);
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      audio.current = null;
    };
  }, [url]);

  async function toggle() {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    try {
      await a.play();
      setPlaying(true);
    } catch {
      setFailed(true);
    }
  }

  const frac = dur > 0 ? pos / dur : 0;
  return (
    <div className={`flex items-center gap-3 rounded-pill p-2 pr-4 ${tone === "mint" ? "bg-mint" : "bg-surface"}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-pill border-0 bg-green text-green-on"
      >
        <Icon name={playing ? "pause" : "play"} size={22} fill />
      </button>
      <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
        {BARS.map((h, i) => (
          <span key={i} className="w-[3px] flex-none rounded-pill" style={{ height: `${h}%`, background: i / BARS.length < frac ? "var(--wave)" : "var(--wave-rest)" }} />
        ))}
      </div>
      <span className="text-[14px] font-bold tabular-nums text-ink">{failed ? "Could not play" : mmss(dur > 0 && playing ? dur - pos : dur)}</span>
    </div>
  );
}
