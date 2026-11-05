"use client";
import { useEffect, useRef, useState } from "react";
import { ProfileHeader } from "@/components/vx";
import { getPlayUrl, type Profile } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";
import { makePlayer, playWithResign } from "./playback";
import { joinedLabel, placeLabel, unitsFigure } from "./format";
import { WALLET_LIVE } from "./flags";

/** Plays the Voice Card clip (the person's 10 second bio) through the play route; the ProfileHeader shows it and asks. */
function useVoiceCard(clipId: string | undefined) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const resolve = async () => (await getPlayUrl(clipId!, isSignedIn())).url;
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
  return { playing, failed, toggle };
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
  const card = profile.voiceCard && profile.voiceCard.status === "READY" ? profile.voiceCard : null;
  const vc = useVoiceCard(card?.id);
  return (
    <ProfileHeader
      name={name}
      handle={"@" + profile.handle}
      avatar={profile.avatarUrl ?? undefined}
      place={place ?? undefined}
      joined={joinedLabel(profile.joinedAt)}
      voiceCard={card ? Math.round((card.durationMs ?? 8000) / 1000) : false}
      playing={vc.playing}
      onPlay={() => void vc.toggle()}
      onPause={() => void vc.toggle()}
      voiceNote={vc.failed ? <p className="pf-note pf-note--err" role="alert">Could not play the Voice Card. Try again.</p> : undefined}
      stats={p.stats}
      own={p.own}
      units={p.own ? units : undefined}
      freeLeft={p.freePosts}
      unitsHref={WALLET_LIVE ? "/wallet" : false}
      unitsState="plain"
      referral={p.own ? p.referral : undefined}
      copied={copied}
      onCopyReferral={() => void copy()}
      editHref="/profile/edit"
    />
  );
}
