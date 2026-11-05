"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Icon, IconButton } from "@/components/vx";
import { getPlayUrl, type Profile } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";
import { makePlayer, playWithResign } from "./playback";
import { clock } from "./clock";
import { joinedLabel, placeLabel, unitsFigure } from "./format";
import { WALLET_LIVE } from "./flags";

const short = (n: number) => (n >= 1e6 ? `${Math.round(n / 1e5) / 10}M` : n >= 1e4 ? `${Math.round(n / 100) / 10}K` : n.toLocaleString("en-NG"));

/** Plays the Voice Card clip (the person's 10 second bio) through the play route. Nothing is drawn when there is no card. */
export function VoiceCardButton({ clipId, seconds }: { clipId: string; seconds: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const resolve = async () => (await getPlayUrl(clipId, isSignedIn())).url;
  async function toggle() {
    setFailed(false);
    try {
      if (!audio.current) {
        const a = makePlayer(await resolve());
        a.onended = () => setPlaying(false);
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      }
      if (audio.current.paused) await playWithResign(audio.current, resolve); else audio.current.pause();
    } catch { setFailed(true); setPlaying(false); }
  }
  const bars = Array.from({ length: 18 }, (_, i) => 8 + ((i * 53) % 20));
  return (
    <>
      <button type="button" className={"vx-vcard" + (playing ? " is-playing" : "")} aria-pressed={playing} onClick={toggle}>
        <span className="vx-vcard__play"><Icon name={playing ? "pause" : "play"} size={22} fill strokeWidth={1.5} /></span>
        <span className="vx-vcard__txt"><b>{playing ? "Playing Voice Card" : "Play Voice Card"}</b><span>{"Voice bio · " + clock(seconds)}</span></span>
        <span className="vx-vcard__wave" aria-hidden="true">{bars.map((h, i) => <i key={i} style={{ height: h, animationDelay: i * 60 + "ms" }} />)}</span>
      </button>
      {failed ? <p className="pf-note pf-note--err" role="alert">Could not play the Voice Card. Try again.</p> : null}
    </>
  );
}

export interface Stat { label: string; value: number }

/** The profile card of the Me and Person boards (vx-prof markup). Every control on it works. */
export function ProfileCard(p: {
  profile: Profile;
  stats: Stat[];
  own?: boolean;
  unitsMilli?: number;
  freePosts?: number;
  referral?: string;
}) {
  const { profile } = p;
  const [copied, setCopied] = useState(false);
  const place = placeLabel(profile);
  const name = profile.displayName || profile.handle;
  async function copy() {
    try { await navigator.clipboard.writeText(p.referral ?? ""); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  const units = p.unitsMilli !== undefined ? unitsFigure(p.unitsMilli) : undefined;
  return (
    <section className="vx-prof" aria-label="Profile">
      <div className="vx-prof__in">
        <div className="vx-prof__top">
          <Avatar name={name} src={profile.avatarUrl ?? undefined} size="l" />
          <div className="vx-prof__id">
            <h2 className="vx-prof__handle">{"@" + profile.handle}</h2>
            <span className="vx-prof__meta">{[place, joinedLabel(profile.joinedAt)].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        {profile.voiceCard && profile.voiceCard.status === "READY" ? <VoiceCardButton clipId={profile.voiceCard.id} seconds={Math.round((profile.voiceCard.durationMs ?? 8000) / 1000)} /> : null}
        <div className="vx-prof__stats">
          {p.stats.map((s) => <div key={s.label} className="vx-stat"><b>{short(s.value)}</b><span>{s.label}</span></div>)}
        </div>
        {p.own ? (
          <div className="vx-prof__row">
            {units !== undefined ? <UnitsPill units={units} freeLeft={p.freePosts} /> : null}
            {p.referral ? (
              <span className="vx-refcode">
                {p.referral}
                <IconButton icon={copied ? "check" : "copy"} label={copied ? "Copied" : "Copy referral code"} variant="ghost" size="s" onClick={copy} />
              </span>
            ) : null}
            <Button variant="secondary" size="s" icon="settings" href="/profile/edit">Edit profile</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The units chip, as a link to the wallet only once that screen exists. */
export function UnitsPill({ units, freeLeft }: { units: string; freeLeft?: number }) {
  const body = (
    <>
      <span className="vx-units__coin" aria-hidden="true"><Icon name="coins" size={18} strokeWidth={2.25} /></span>
      {units + " units"}
      {freeLeft && freeLeft > 0 ? <small>{"· " + freeLeft + " free"}</small> : null}
    </>
  );
  return WALLET_LIVE
    ? <Link href="/wallet" className="vx-units" aria-label={`${units} Voice Units. Open wallet`}>{body}</Link>
    : <span className="vx-units pf-static" aria-label={`${units} Voice Units`}>{body}</span>;
}
