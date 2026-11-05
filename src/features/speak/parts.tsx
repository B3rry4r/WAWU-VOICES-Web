"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, FreePosts, Icon, IconButton } from "@/components/vx";
import { clock } from "@/components/vx/helpers";
import { barHeights } from "@/lib/audio-ref/player";
import type { ExtraVoiceOffer } from "@/lib/api/speak";
import { durationLabel, naira } from "./logic";

/** Phone app bar: close, "Speak", "Today's question" (the Record boards). Hidden on desktop, where the page has its own header. */
export function PhoneBar({ onClose, sub }: { onClose: () => void; sub: string }) {
  return (
    <header className="sp-bar dt:hidden">
      <IconButton icon="x" label="Close the recorder" variant="dark" iconSize={24} onClick={onClose} />
      <div className="sp-bar__t">
        <b>Speak</b>
        <span>{sub}</span>
      </div>
    </header>
  );
}

/** The ring, the big button, the timer and the hint: one control for idle and live. Levels are the microphone's own. */
export function RecordStage(p: {
  live: boolean;
  limit: number;
  left: number;
  levels: number[];
  freeLeft: number;
  hint: ReactNode;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const R = 98;
  const C = 2 * Math.PI * R;
  const frac = p.live ? Math.min(1, (p.limit - p.left) / p.limit) : 0;
  return (
    <>
      <div className="vx-rec__stage">
        <svg className="vx-rec__ring" viewBox="0 0 208 208" aria-hidden="true">
          <circle className="bg" cx={104} cy={104} r={R} />
          <circle className="fg" cx={104} cy={104} r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <button type="button" className={"vx-rec__btn" + (p.live ? " is-recording" : "")} aria-label={p.live ? "Stop recording" : "Start recording"} disabled={p.disabled} onClick={p.onToggle}>
          <Icon name={p.live ? "square" : "mic"} size={p.live ? 34 : 44} fill={p.live} strokeWidth={2} />
        </button>
      </div>
      <span className="vx-rec__timer" aria-hidden={p.live ? "true" : undefined}>{clock(p.live ? Math.ceil(p.left) : p.limit)}</span>
      {p.live ? (
        <div className="vx-rec__live" aria-hidden="true" data-testid="live-bars">
          {p.levels.map((l, i) => (
            <i key={i} style={{ height: Math.round(6 + Math.min(1, l * 1.6) * 38) }} />
          ))}
        </div>
      ) : null}
      {p.hint}
    </>
  );
}

export function Pill({ left, total }: { left: number; total: number }) {
  return <FreePosts left={left} total={total} pill />;
}

/** "Need more time?" panel inside the idle recorder. One button per offer, prices from the API. */
export function PassPanel({ offers, onPick }: { offers: ExtraVoiceOffer[]; onPick: (o: ExtraVoiceOffer) => void }) {
  if (offers.length === 0) return null;
  return (
    <div className="vx-rec__more">
      <p>Need more time?</p>
      <div className="vx-rec__pass">
        {[...offers].sort((a, b) => a.maxSeconds - b.maxSeconds).map((o) => (
          <Button key={o.kind} variant="onforest" onClick={() => onPick(o)}>
            {`Up to ${durationLabel(o.maxSeconds)}`}
            <small>{`${naira(o.priceKobo)} for one message`}</small>
          </Button>
        ))}
      </div>
    </div>
  );
}

const SPEEDS = [1, 1.5, 2];

/** Listen back to the take in the browser. The bars are the loudest moments the microphone heard. No download control. */
export function TakePlayer({ blob, seconds, peaks }: { blob: Blob; seconds: number; peaks: number[] }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const url = useRef<string | null>(null);
  const bars = peaks.length ? barHeights(peaks) : [];

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    url.current = u;
    const a = new Audio();
    a.preload = "metadata";
    a.setAttribute("playsinline", "");
    a.setAttribute("controlsList", "nodownload noplaybackrate");
    a.oncontextmenu = (e) => e.preventDefault();
    a.src = u;
    a.ontimeupdate = () => setProg(a.duration && Number.isFinite(a.duration) ? a.currentTime / a.duration : 0);
    a.onended = () => { setPlaying(false); setProg(0); };
    a.onpause = () => setPlaying(false);
    a.onplay = () => setPlaying(true);
    audio.current = a;
    return () => { a.pause(); a.removeAttribute("src"); URL.revokeObjectURL(u); audio.current = null; };
  }, [blob]);

  async function toggle() {
    const a = audio.current;
    if (!a) return;
    setFailed(false);
    if (!a.paused) { a.pause(); return; }
    try { a.playbackRate = speed; await a.play(); } catch { setFailed(true); }
  }
  function cycle() {
    const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(n);
    if (audio.current) audio.current.playbackRate = n;
  }
  const cut = Math.round(prog * bars.length);
  const total = Math.max(1, Math.round(seconds));
  return (
    <div className="vx-rec__player">
      <div className="vx-player vx-player--forest">
        <button type="button" className="vx-player__play" onClick={() => void toggle()} aria-label={(playing ? "Pause" : "Play") + " your recording, " + total + " seconds"}>
          <Icon name={playing ? "pause" : "play"} size={22} fill strokeWidth={1.5} />
        </button>
        <div className="vx-player__track" aria-hidden="true" data-testid="take-bars">
          {bars.map((h, i) => <i key={i} className={i < cut ? "on" : ""} style={{ height: Math.max(6, Math.round(h * 0.36)) }} />)}
        </div>
        <span className="vx-player__time">{clock(playing || prog > 0 ? total * (1 - prog) : total)}</span>
        <button type="button" className="vx-player__speed" onClick={cycle} aria-label={"Playback speed " + speed + "x"}>{speed + "x"}</button>
      </div>
      {failed ? <p className="sp-err sp-err--forest" role="alert">This recording could not be played here. You can still send it.</p> : null}
    </div>
  );
}

/** Desktop right rail card, from the board: what a recording can be and what it costs. */
export function RecordingTimeCard({ freeLeft, total, freeSeconds, offers }: { freeLeft: number; total: number; freeSeconds: number; offers: ExtraVoiceOffer[] }) {
  return (
    <section className="sp-card" aria-label="Your recording time">
      <h2 className="sp-card__h">Your recording time</h2>
      <div className="sp-card__free"><FreePosts left={freeLeft} total={total} /></div>
      <dl className="sp-card__rows">
        <div><dt>Free post</dt><dd>{freeSeconds} seconds</dd></div>
        {[...offers].sort((a, b) => a.maxSeconds - b.maxSeconds).map((o) => (
          <div key={o.kind}><dt>{`Extra voice, ${durationLabel(o.maxSeconds)}`}</dt><dd>{naira(o.priceKobo)}</dd></div>
        ))}
      </dl>
      <p className="sp-card__fine">{`Extra time is a one-off token for one message, not a subscription. Your first ${total} posts stay free.`}</p>
    </section>
  );
}

export function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="sp-back">
      <Icon name="arrow-left" size={20} />
      Back to the conversation
    </Link>
  );
}
