"use client";
import { InView } from "@/components/InView";
import { needsNewKey } from "@/lib/api/keys";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Banner, Button, Icon } from "@/components/vx";
import * as api from "@/lib/api/speak";
import { baseMime } from "@/lib/audio-ref/mime";
import { VoiceRecorder, type RecorderError } from "@/lib/audio-ref/recorder";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { peaksFromLevels, refusalText, tokenFor, uuidKey } from "./logic";
import { RecordStage, TakePlayer } from "./parts";
import { AnonymousSwitch } from "@/features/talk/AnonymousSwitch";
import { onAnonPref, readAnonPref, writeAnonPref } from "@/lib/anon-pref";
import "./speak.css";

/** One recording for a reply or an explain-my-vote: the same recorder, the same upload (create, PUT, complete, wait until READY) as an answer.
 *  The caller posts the READY clip. Nothing is posted until the person taps Send. */
type Purpose = "REPLY" | "VOTE_EXPLANATION";
interface Take { blob: Blob; mime: string; seconds: number; peaks: number[]; key: string }
type Step = { step: "upload"; pct: number } | { step: "process" } | { step: "post" };

const MIC_HELP: Record<RecorderError, { title: string; body: string }> = {
  permission_denied: { title: "The microphone is blocked", body: "Allow the microphone for this site in your browser settings, then tap Try again." },
  no_microphone: { title: "No microphone found", body: "Plug in or switch on a microphone, then tap Try again." },
  unsupported: { title: "This browser cannot record", body: "Use an up-to-date Chrome, Firefox or Safari, or write it in words instead." },
  failed: { title: "Recording did not start", body: "Tap Try again. If it keeps happening, write it in words instead." },
};

/** `anonymous` is the "Post without my name" switch as it stood when Send was tapped (always false when the box has no switch). */
export interface ReadyClip { clipId: string; tokenId?: string; key: string; seconds: number; anonymous: boolean }

export function VoiceBox({ purpose, maxSeconds, freeSeconds, freeLeft, tokens, hint, sendLabel, onSend, errorText, disabled, extra, onCancel, anonSlot }: {
  purpose: Purpose;
  maxSeconds: number;
  /** The length a free post covers; a longer take may need an old voice token, as on the record screen. */
  freeSeconds: number;
  /** Free posts the person has left. With none, a token they already hold covers the message. Default: some left. */
  freeLeft?: number;
  tokens?: api.ExtraVoiceToken[];
  hint?: ReactNode;
  /** The words on the Send button for this length ("Send" or "Send for 3 tokens"). */
  sendLabel: (seconds: number) => string;
  /** Post the READY clip. A throw is shown under the recording, and Send can be tapped again with the same key. */
  onSend: (clip: ReadyClip) => Promise<void>;
  /** The caller's own words for a refusal (for example, out of tokens); return null for the default. */
  errorText?: (e: unknown) => string | null;
  disabled?: boolean;
  /** Anything the caller wants under a refusal, for example a Get tokens button. */
  extra?: ReactNode;
  onCancel?: () => void;
  /** Shows "Post without my name" under the take. The choice is kept under this slot (anon-pref) and is read when Send runs. */
  anonSlot?: string;
}) {
  const anonRef = useRef(false);
  const [anon, setAnon] = useState(false);
  useEffect(() => {
    if (!anonSlot) return;
    const v = readAnonPref(anonSlot);
    anonRef.current = v;
    setAnon(v);
    return onAnonPref(anonSlot, (x) => { anonRef.current = x; setAnon(x); });
  }, [anonSlot]);
  const chooseAnon = (v: boolean) => { anonRef.current = v; setAnon(v); if (anonSlot) writeAnonPref(anonSlot, v); };
  const [phase, setPhase] = useState<"idle" | "recording" | "preview">("idle");
  const [left, setLeft] = useState(maxSeconds);
  const [levels, setLevels] = useState<number[]>([]);
  const [micError, setMicError] = useState<RecorderError | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [sending, setSending] = useState<Step | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const rec = useRef<VoiceRecorder | null>(null);
  const levelsRef = useRef<number[]>([]);
  const starting = useRef(false);
  const startedAt = useRef(0);
  const discard = useRef(false);
  const alive = useRef(true);
  const [nudge, setNudge] = useState(false);
  const state = useRef<{ key: string; clipId?: string; putUrl?: string; tokenId?: string; uploaded?: boolean; completed?: boolean } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (rec.current) { discard.current = true; rec.current.cancel(); }
    };
  }, []);

  // A recording stops, and keeps what it heard, when the page goes away.
  useEffect(() => {
    if (phase !== "recording") return undefined;
    const stop = () => { if (rec.current) rec.current.stop(); };
    const hide = () => { if (document.visibilityState === "hidden") stop(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", stop);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", stop); };
  }, [phase]);

  async function start() {
    if (phase === "recording" || starting.current || rec.current) return;
    starting.current = true;
    setMicError(null);
    setNote(null);
    levelsRef.current = [];
    setLevels([]);
    setLeft(maxSeconds);
    discard.current = false;
    const r = new VoiceRecorder({
      maxSeconds,
      onTick: (secs, level) => { setLeft(secs); levelsRef.current.push(level); setLevels((l) => [...l.slice(-27), level]); },
    });
    let err: RecorderError | null;
    try { err = await r.start(); } catch { err = "failed"; } finally { starting.current = false; }
    if (err) { setMicError(err); return; }
    if (!alive.current) { r.cancel(); return; }
    rec.current = r;
    startedAt.current = Date.now();
    setPhase("recording");
    void r.result().then((res) => {
      rec.current = null;
      if (discard.current) { discard.current = false; setPhase("idle"); return; }
      if (res.blob.size === 0 || res.seconds < 0.5) { setPhase("idle"); setNote("That recording was too short. Tap the button and say a little more."); return; }
      if (res.overLimit) { setTake({ blob: res.blob, mime: res.mime, seconds: res.realSeconds, peaks: [], key: uuidKey() }); setPhase("preview"); setNote(`That recording ran past ${maxSeconds} seconds, so it cannot be sent as it is. Record it again.`); return; }
      setTake({ blob: res.blob, mime: res.mime, seconds: res.realSeconds, peaks: peaksFromLevels(levelsRef.current), key: uuidKey() });
      setPhase("preview");
    });
  }

  function stop() {
    if (Date.now() - startedAt.current < 700) { setNudge(true); setTimeout(() => setNudge(false), 1800); return; }
    rec.current?.stop();
  }

  function drop() {
    const st = state.current;
    if (st?.clipId) void api.deleteVoiceClip(st.clipId).catch(() => undefined);
    state.current = null;
    setTake(null);
    setNote(null);
    setPhase("idle");
  }

  async function waitReady(clipId: string) {
    for (let i = 0; i < 90; i++) {
      const c = await api.getVoiceClip(clipId);
      if (c.status === "READY") return;
      if (c.status === "FAILED" || c.status === "REMOVED") throw new Error("CLIP_FAILED");
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("CLIP_SLOW");
  }

  async function send() {
    if (!take || sending || disabled) return;
    if (take.seconds > maxSeconds + 0.5) return;
    setNote(null);
    setSending({ step: "upload", pct: 0 });
    let st = state.current;
    if (!st || st.key !== take.key) st = state.current = { key: take.key };
    let stage: "create" | "upload" | "later" = "create";
    try {
      if (!st.clipId) {
        const tok = purpose === "REPLY" ? tokenFor(tokens ?? [], take.seconds, freeSeconds, freeLeft) : undefined;
        const up = await api.createVoiceClip({
          purpose,
          mime: baseMime(take.mime) as "audio/webm" | "audio/mp4" | "audio/ogg",
          sizeBytes: take.blob.size,
          durationMs: Math.round(take.seconds * 1000),
          extraVoiceTokenId: tok?.id,
        });
        st.clipId = up.clip.id;
        st.putUrl = up.putUrl;
        st.tokenId = tok?.id;
      }
      stage = "upload";
      if (!st.uploaded) {
        await putWithRetry({ url: st.putUrl as string, key: "", headers: {} }, take.blob, (f) => setSending({ step: "upload", pct: Math.round(f * 100) }));
        st.uploaded = true;
      }
      stage = "later";
      if (!st.completed) { await api.completeVoiceClip(st.clipId); st.completed = true; }
      setSending({ step: "process" });
      await waitReady(st.clipId);
      setSending({ step: "post" });
      // The key belongs to the exact body: the same recording sent unnamed is a different request from the named one.
      const anonNow = !!anonSlot && anonRef.current;
      await onSend({ clipId: st.clipId, tokenId: st.tokenId, key: anonNow ? `${take.key}-anon` : take.key, seconds: take.seconds, anonymous: anonNow });
      if (anonSlot) { anonRef.current = false; writeAnonPref(anonSlot, false); }
      state.current = null;
      if (alive.current) { setSending(null); setTake(null); setPhase("idle"); }
    } catch (e) {
      if (!alive.current) return;
      setSending(null);
      if (stage === "upload" && st.clipId) { void api.deleteVoiceClip(st.clipId).catch(() => undefined); state.current = null; }
      if (e instanceof Error && e.message === "CLIP_FAILED") { state.current = null; setNote("We could not process that recording. Record it again and send it."); return; }
      if (needsNewKey(e)) {
        // The server refused the key as spent: the same recording goes out under a new key (and a new clip). The recording is kept.
        state.current = null;
        setTake((t) => (t ? { ...t, key: uuidKey() } : t));
        setNote(refusalText(e));
        return;
      }
      if (e instanceof Error && e.message === "CLIP_SLOW") { setNote("Your voice is still being prepared. Tap Send again in a moment."); return; }
      setNote(errorText?.(e) ?? refusalText(e));
    }
  }

  const live = phase === "recording";
  const help = micError ? MIC_HELP[micError] : null;
  const stepText = sending ? (sending.step === "upload" ? `Sending your voice, ${sending.pct}%` : sending.step === "process" ? "Getting your voice ready" : "Posting") : "";
  const tooLong = !!take && take.seconds > maxSeconds + 0.5;
  const idleHint = hint ?? <p className="vx-rec__hint">{"Tap to record. You have "}<b>{`${maxSeconds} seconds`}</b>{"."}</p>;
  const liveHint = (
    <p className="vx-rec__hint" aria-live="polite">
      <b>{`${Math.ceil(left)} seconds left`}</b>
      {`. It stops by itself at ${maxSeconds}.`}
      {nudge ? <span className="sp-nudge" role="status">{" Keep talking, a little longer."}</span> : null}
    </p>
  );
  return (
    <section className={"vx-rec" + (live ? " is-live" : "")} aria-label="Voice recorder" data-testid="voice-box">
      {live ? <div className="vx-rec__top"><span className="vx-rec__dot">Recording</span></div> : null}
      {note ? <InView key={note}><Banner tone="danger" onClose={() => setNote(null)}>{note}</Banner></InView> : null}
      {note && extra ? extra : null}
      {phase !== "preview" && help ? (
        <div className="sp-help" role="alert">
          <Icon name="mic-off" size={36} />
          <h2 className="sp-help__t">{help.title}</h2>
          <p className="sp-help__b">{help.body}</p>
          <div className="sp-help__btns">
            {micError !== "unsupported" ? <Button variant="onforest" icon="rotate-ccw" onClick={() => void start()}>Try again</Button> : null}
            {onCancel ? <Button variant="onforest" onClick={onCancel}>Write instead</Button> : null}
          </div>
        </div>
      ) : null}
      {phase !== "preview" && !help ? (
        <RecordStage live={live} limit={maxSeconds} left={left} levels={levels} freeLeft={0} hint={live ? liveHint : idleHint} disabled={disabled} onToggle={live ? stop : () => void start()} />
      ) : null}
      {phase === "preview" && take ? (
        <>
          <TakePlayer blob={take.blob} seconds={take.seconds} peaks={take.peaks} />
          <p className="vx-rec__hint">Listen back. Nothing posts until you tap Send.</p>
          {anonSlot ? <AnonymousSwitch onForest on={anon} disabled={!!sending} onChange={chooseAnon} /> : null}
          {sending ? (
            <div className="sp-progress" role="status" aria-live="polite">
              <div className="sp-progress__bar"><i style={{ width: `${sending.step === "upload" ? sending.pct : 100}%` }} /></div>
              <span>{stepText}</span>
            </div>
          ) : null}
          <div className="vx-rec__actions">
            <Button variant="onforest" icon="rotate-ccw" disabled={!!sending} onClick={drop}>Re-record</Button>
            <Button variant="onforest" icon="trash-2" disabled={!!sending} onClick={() => { drop(); onCancel?.(); }}>Delete</Button>
            <Button size="l" icon="send" loading={!!sending} disabled={tooLong || disabled} onClick={() => void send()}>{sendLabel(take.seconds)}</Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
