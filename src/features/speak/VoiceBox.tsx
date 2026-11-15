"use client";
import { InView } from "@/components/InView";
import { needsNewKey } from "@/lib/api/keys";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Banner, Button, Icon } from "@/components/vx";
import * as api from "@/lib/api/speak";
import { ApiError, WrongPersonError } from "@/lib/api/client";
import { baseMime } from "@/lib/audio-ref/mime";
import { VoiceRecorder, type RecorderError } from "@/lib/audio-ref/recorder";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { openedFor, OTHER_TAB_NOTE } from "./draft";
import { peaksFromLevels, refusalText, tokenFor, uuidKey } from "./logic";
import { RecordStage, TakePlayer } from "./parts";
import { AnonymousSwitch } from "@/features/talk/AnonymousSwitch";
import { onAnonPref, readAnonPref, writeAnonPref } from "@/lib/anon-pref";
import "./speak.css";

/** One recording for a reply or an explain-my-vote: the same recorder, the same upload (create, PUT, complete, wait until READY) as an answer.
 *  The caller posts the READY clip. Nothing is posted until the person taps Send. */
type Purpose = "REPLY" | "VOTE_EXPLANATION" | "SURVEY_ANSWER";
interface Take { blob: Blob; mime: string; seconds: number; peaks: number[]; key: string }
type Step = { step: "upload"; pct: number } | { step: "process" } | { step: "post" };

const MIC_HELP: Record<RecorderError, { title: string; body: string }> = {
  permission_denied: { title: "The microphone is blocked", body: "Allow the microphone for this site in your browser settings, then tap Try again." },
  no_microphone: { title: "No microphone found", body: "Plug in or switch on a microphone, then tap Try again." },
  unsupported: { title: "This browser cannot record", body: "Use an up-to-date Chrome, Firefox or Safari, or write it in words instead." },
  failed: { title: "Recording did not start", body: "Tap Try again. If it keeps happening, write it in words instead." },
};

/** `anonymous` is the "Post without my name" switch as it stood when Send was tapped (always false when the box has no switch). */
export interface ReadyClip { clipId: string; tokenId?: string; key: string; seconds: number; anonymous: boolean;
  /** The tab's person (openedFor). A post that carries this clip goes out only as them (expectSubject). Left out for a guest. */
  subject?: string }

/** What a box hands to `keep` when the person sends while offline: the take, and the Idempotency-Key and name switch it would have been sent with. */
export interface KeepInput { blob: Blob; mime: string; seconds: number; peaks: number[]; key: string; anonymous: boolean }
/** "kept": saved on this device. "exists": another recording already waits there (the person is asked before it is replaced). "failed": the device could not keep it. */
export type KeepResult = "kept" | "exists" | "failed" | "other_tab";

export function VoiceBox({ purpose, maxSeconds, freeSeconds, freeLeft, tokens, hint, sendLabel, onSend, errorText, disabled, extra, onCancel, anonSlot, keyPart, keep, onKept, previewHint, postingText, onReady, canWrite }: {
  /** Part of what the post says besides the recording (a reply's stance): a different one is a different request, so it gets a different Idempotency-Key. */
  keyPart?: string;
  /** Keeps the take on this device when Send is tapped offline, to be sent later. Without it, offline only says the take stays on this page. */
  keep?: (t: KeepInput, replace: boolean) => Promise<KeepResult>;
  /** Called after `keep` saved the take, so the caller can close and say so. */
  onKept?: () => void;
  /** Survey answers only. The line under the played-back take. Left out: "Listen back. Nothing posts until you tap Send." */
  previewHint?: string;
  /** Survey answers only. The words for the last step of the send. Left out: "Posting". */
  postingText?: string;
  /** Survey answers only: the take is sent up when the recording stops, and this is called once the clip is READY, before anything is posted. */
  onReady?: (clip: ReadyClip) => void;
  /** Survey answers only: asked before each upload call; false stops it, nothing is sent (the screen shows its own notice). */
  canWrite?: () => boolean;
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
  // Pin the tab's person when the box opens (a guest tab follows a session only until it has been read); the calls read it again when they run.
  useState(() => openedFor());
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
  const [replaceOk, setReplaceOk] = useState(false);
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
    const subject = openedFor() ?? undefined; // read when used, so a guest tab that became a person's tab sends as them
    for (let i = 0; i < 90; i++) {
      const c = await api.getVoiceClip(clipId, subject);
      if (c.status === "READY") return;
      if (c.status === "FAILED" || c.status === "REMOVED") throw new Error("CLIP_FAILED");
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("CLIP_SLOW");
  }

  /** The key this take is posted with: the recording's own key, plus what else the post says (the stance, the name switch). */
  const keyNow = (t: Take, anonNow: boolean) => `${t.key}${keyPart ? `-${keyPart}` : ""}${anonNow ? "-anon" : ""}`;

  async function tryKeep(t: Take, replace: boolean): Promise<boolean> {
    if (!keep) return false;
    const anonNow = !!anonSlot && anonRef.current;
    const r = await keep({ blob: t.blob, mime: t.mime, seconds: t.seconds, peaks: t.peaks, key: keyNow(t, anonNow), anonymous: anonNow }, replace);
    if (!alive.current) return true;
    setSending(null);
    if (r === "kept") {
      if (anonSlot) { anonRef.current = false; writeAnonPref(anonSlot, false); }
      state.current = null;
      onKept?.();
    } else if (r === "exists") {
      setNote("A recording is already waiting to be sent on this device. Saving this one will replace it.");
      setReplaceOk(true);
    } else if (r === "other_tab") {
      setNote(OTHER_TAB_NOTE);
    } else {
      setNote("We could not keep your recording on this device. Stay on this page until you are back online, then tap Send.");
    }
    return true;
  }

  async function send(holdOnly = false) {
    if (!take || sending || disabled) return;
    if (take.seconds > maxSeconds + 0.5) return;
    setNote(null);
    setReplaceOk(false);
    if (keep && typeof navigator !== "undefined" && navigator.onLine === false) { setSending({ step: "post" }); await tryKeep(take, false); return; }
    setSending({ step: "upload", pct: 0 });
    let st = state.current;
    if (!st || st.key !== take.key) st = state.current = { key: take.key };
    let stage: "create" | "upload" | "later" = "create";
    const subject = openedFor() ?? undefined; // the tab's person, read now: the clip calls go out only as them
    try {
      if (!st.clipId) {
        const tok = purpose === "REPLY" ? tokenFor(tokens ?? [], take.seconds, freeSeconds, freeLeft) : undefined;
        const up = await api.createVoiceClip({
          purpose,
          mime: baseMime(take.mime) as "audio/webm" | "audio/mp4" | "audio/ogg",
          sizeBytes: take.blob.size,
          durationMs: Math.round(take.seconds * 1000),
          extraVoiceTokenId: tok?.id,
        }, subject);
        st.clipId = up.clip.id;
        st.putUrl = up.putUrl;
        st.tokenId = tok?.id;
      }
      stage = "upload";
      if (!st.uploaded) {
        if (canWrite && !canWrite()) throw new WrongPersonError();
        await putWithRetry({ url: st.putUrl as string, key: "", headers: {} }, take.blob, (f) => setSending({ step: "upload", pct: Math.round(f * 100) }));
        st.uploaded = true;
      }
      stage = "later";
      if (!st.completed) {
        if (canWrite && !canWrite()) throw new WrongPersonError();
        await api.completeVoiceClip(st.clipId, subject);
        st.completed = true;
      }
      setSending({ step: "process" });
      await waitReady(st.clipId);
      if (holdOnly && onReady) {
        // Survey answer: ready and kept by the caller, not posted.
        state.current = null;
        if (alive.current) setSending(null);
        if (alive.current) onReady({ clipId: st.clipId, tokenId: st.tokenId, key: take.key, seconds: take.seconds, anonymous: false });
        return;
      }
      if (canWrite && !canWrite()) throw new WrongPersonError();
      setSending({ step: "post" });
      // The key belongs to the exact body: the same recording sent unnamed is a different request from the named one.
      const anonNow = !!anonSlot && anonRef.current;
      await onSend({ clipId: st.clipId, tokenId: st.tokenId, key: keyNow(take, anonNow), seconds: take.seconds, anonymous: anonNow, subject });
      if (anonSlot) { anonRef.current = false; writeAnonPref(anonSlot, false); }
      state.current = null;
      if (alive.current) { setSending(null); setTake(null); setPhase("idle"); }
    } catch (e) {
      if (!alive.current) return;
      if (keep && ((e instanceof ApiError && e.status === 0) || (!(e instanceof ApiError) && typeof navigator !== "undefined" && navigator.onLine === false))) {
        if (stage === "upload" && st.clipId) void api.deleteVoiceClip(st.clipId, subject).catch(() => undefined);
        await tryKeep(take, false);
        return;
      }
      setSending(null);
      if (e instanceof WrongPersonError) {
        // Someone else is signed in in another tab: nothing more is sent, the recording stays on the screen.
        if (canWrite) canWrite(); else setNote(OTHER_TAB_NOTE);
        return;
      }
      if (stage === "upload" && st.clipId) { void api.deleteVoiceClip(st.clipId, subject).catch(() => undefined); state.current = null; }
      if (e instanceof Error && e.message === "CLIP_FAILED") { state.current = null; setNote("We could not process that recording. Record it again and send it."); return; }
      if (needsNewKey(e)) {
        // The server refused the key as spent: the same recording goes out under a new key (and a new clip). The recording is kept.
        state.current = null;
        setTake((t) => (t ? { ...t, key: uuidKey() } : t));
        setNote(refusalText(e));
        return;
      }
      if (e instanceof Error && e.message === "CLIP_SLOW") { setNote("Your voice is still being prepared. Tap Send again in a moment."); return; }
      setNote(errorText?.(e) ?? (!keep && e instanceof ApiError && e.status === 0 ? "You are offline. Your recording stays on this page. Check your connection and tap Send again." : refusalText(e)));
    }
  }

  // Survey answers: sent up as soon as the recording stops, so a reload finds it ready.
  const heldKey = useRef<string | null>(null);
  useEffect(() => {
    if (!onReady || !take || phase !== "preview" || take.seconds > maxSeconds + 0.5 || heldKey.current === take.key) return;
    heldKey.current = take.key;
    void send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take, phase]);

  const live = phase === "recording";
  const help = micError ? MIC_HELP[micError] : null;
  const stepText = sending ? (sending.step === "upload" ? `Sending your voice, ${sending.pct}%` : sending.step === "process" ? "Getting your voice ready" : (postingText ?? "Posting")) : "";
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
      {note ? <InView key={note}><Banner tone={replaceOk ? "info" : "danger"} onClose={() => { setNote(null); setReplaceOk(false); }} action={replaceOk ? "Replace it" : undefined} onAction={replaceOk && take ? () => { setNote(null); setReplaceOk(false); setSending({ step: "post" }); void tryKeep(take, true); } : undefined}>{note}</Banner></InView> : null}
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
          <p className="vx-rec__hint">{previewHint ?? "Listen back. Nothing posts until you tap Send."}</p>
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
