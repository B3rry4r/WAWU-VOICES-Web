"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "@/components/shell/ShellSlots";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, Icon, NotFoundState, Skeleton, StageBar } from "@/components/vx";
import { short } from "@/components/vx/helpers";
import { isSignedIn } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/speak";
import { baseMime } from "@/lib/audio-ref/mime";
import { VoiceRecorder, type RecorderError } from "@/lib/audio-ref/recorder";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { clearDraft, clearPendingPayment, getPendingPayment, loadDraft, saveDraft, setPendingPayment, type Draft } from "./draft";
import { ExtraVoiceSheet } from "./ExtraVoiceSheet";
import { durationLabel, limitSeconds, naira, peaksFromLevels, refusalText, tokenFor, uuidKey } from "./logic";
import { BackLink, PassPanel, PhoneBar, Pill, RecordStage, RecordingTimeCard, TakePlayer } from "./parts";
import "./speak.css";
import { MoodWordNote } from "@/features/mood/MoodChip";
import { pickHref, useMoodWord, writePick } from "@/features/mood/mood";
import { voicesOf } from "@/lib/feed-format";

/** Where a guest goes to sign in. The recording waits in this browser (IndexedDB) until they are back (V-19). */
export const JOIN_PATH = "/join";

type Phase = "idle" | "recording" | "preview";
type Step = { step: "upload"; pct: number } | { step: "process" } | { step: "post" };
interface Take { blob: Blob; mime: string; seconds: number; peaks: number[]; key: string }
interface Info { question: api.Question; config: api.PublicConfig; allowance: api.Allowances | null }
interface Note { tone: "info" | "danger" | "success" | "offline"; title?: string; text: string; action?: string; onAction?: () => void }

const MIC_HELP: Record<RecorderError, { title: string; body: string }> = {
  permission_denied: { title: "The microphone is blocked", body: "Allow the microphone for this site in your browser settings, then tap Try again. Nothing is recorded until you tap the button." },
  no_microphone: { title: "No microphone found", body: "Plug in or switch on a microphone, then tap Try again." },
  unsupported: { title: "This browser cannot record", body: "Use an up-to-date Chrome, Firefox or Safari (iPhone: iOS 14.3 or newer), or write your answer instead." },
  failed: { title: "Recording did not start", body: "Tap Try again. If it keeps happening, write your answer instead." },
};

export function SpeakScreen({ questionId }: { questionId?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/speak";
  const params = useSearchParams();
  const qParam = questionId ?? params.get("q") ?? undefined;

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | Error | null>(null);
  const [reload, setReload] = useState(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(10);
  const [levels, setLevels] = useState<number[]>([]);
  const [micError, setMicError] = useState<RecorderError | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sending, setSending] = useState<Step | null>(null);
  const [sheet, setSheet] = useState<{ kind?: api.ExtraVoiceTokenKind; hasTake: boolean } | null>(null);
  const [paying, setPaying] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);

  const rec = useRef<VoiceRecorder | null>(null);
  const levelsRef = useRef<number[]>([]);
  const discard = useRef(false);
  const interrupted = useRef(false);
  const starting = useRef(false);
  const startedAt = useRef(0);
  const payBusy = useRef(false);
  const [nudge, setNudge] = useState(false);
  const alive = useRef(true);
  const trapped = useRef(false);
  const ignorePop = useRef(false);
  const sendState = useRef<{ key: string; clipId?: string; putUrl?: string; tokenId?: string; uploaded?: boolean; completed?: boolean } | null>(null);
  const payKey = useRef(uuidKey());

  useEffect(() => setSignedIn(isSignedIn()), []);

  // The question, the public config and (signed in) my allowance.
  useEffect(() => {
    if (signedIn === null) return;
    let live = true;
    setInfo(null);
    setLoadErr(null);
    (async () => {
      try {
        const [question, config, allowance] = await Promise.all([
          qParam ? api.getQuestion(qParam) : api.getToday(),
          api.getPublicConfig(),
          signedIn ? api.getAllowance().catch((e: unknown) => { if (e instanceof ApiError && e.status === 401) return null; throw e; }) : Promise.resolve(null),
        ]);
        if (live) setInfo({ question, config, allowance });
      } catch (e) {
        if (live) setLoadErr(e as Error);
      }
    })();
    return () => { live = false; };
  }, [signedIn, qParam, reload]);

  const refreshAllowance = useCallback(async () => {
    try {
      const allowance = await api.getAllowance();
      setInfo((i) => (i ? { ...i, allowance } : i));
      return allowance;
    } catch {
      return null;
    }
  }, []);

  const question = info?.question;
  // LCH-02: a mood question needs its one word before recording; without one the person is sent to pick it.
  const mood = useMoodWord(question);
  const config = info?.config;
  const allowance = info?.allowance ?? null;
  const freeSeconds = allowance?.costs.freeVoiceSeconds ?? config?.voiceFreeSeconds ?? 10;
  const tokens = allowance?.extraVoiceTokens ?? [];
  const limit = limitSeconds(freeSeconds, tokens);
  const freeTotal = config?.freePosts ?? 10;
  const freeLeft = allowance?.freePostsRemaining ?? freeTotal;
  const offers = config?.extraVoice ?? [];
  const qid = question?.id;
  const open = question ? question.status === "LIVE" : true;

  const pushNote = (n: Note) => setNotes((l) => [...l.filter((x) => x.text !== n.text), n]);
  const clearNotes = () => setNotes([]);

  // Restore a kept recording: a guest who signed in, someone back from checkout, a reload.
  useEffect(() => {
    if (!qid) return;
    let live = true;
    loadDraft().then((d) => {
      if (!live || !d || d.questionId !== qid) return;
      setTake({ blob: d.blob, mime: d.mime, seconds: d.seconds, peaks: d.peaks, key: d.key });
      setPhase("preview");
    });
    return () => { live = false; };
  }, [qid]);

  // WF-6b (A-L6): "Finish and post my voice" returns here with autopost=1 and the held recording: send it once, without a second tap.
  const autoPosted = useRef(false);
  useEffect(() => {
    if (autoPosted.current || params.get("autopost") !== "1") return;
    if (!signedIn || phase !== "preview" || !take || !info || !qid) return;
    autoPosted.current = true;
    window.history.replaceState(window.history.state, "", pathname + (qParam && !questionId ? `?q=${qParam}` : ""));
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, phase, take, info, qid]);

  // Back from checkout: verify the payment (the server checks it with Flutterwave itself).
  useEffect(() => {
    if (!signedIn || !qid) return;
    const pending = getPendingPayment();
    const paymentId = params.get("paymentId") ?? pending?.paymentId;
    const status = params.get("status");
    if (!paymentId || (!params.has("paymentId") && !pending)) return;
    if (!params.has("paymentId") && !params.has("status") && !params.has("transaction_id")) return;
    let live = true;
    const back = () => router.replace(pathname + (qParam && !questionId ? `?q=${qParam}` : ""));
    if (status === "cancelled") {
      clearPendingPayment();
      pushNote({ tone: "info", text: "The payment was not completed. Nothing was charged, and your recording is kept." });
      back();
      return;
    }
    (async () => {
      try {
        const p = await api.verifyPayment(paymentId, params.get("transaction_id") ?? undefined, pending?.key ?? uuidKey());
        if (!live) return;
        if (p.status === "SUCCEEDED") {
          clearPendingPayment();
          await refreshAllowance();
          pushNote({ tone: "success", title: "Extra time added.", text: `You can record up to ${p.token?.maxSeconds ?? 30} seconds for your next message.` });
        } else if (p.status === "PENDING" || p.status === "INITIATED") {
          pushNote({ tone: "info", text: "Your payment is still being confirmed. Give it a moment, then check again.", action: "Check again", onAction: () => setReload((n) => n + 1) });
        } else {
          clearPendingPayment();
          pushNote({ tone: "danger", text: p.failureReason ?? "The payment did not go through. You were not charged." });
        }
      } catch (e) {
        if (live) pushNote({ tone: "danger", text: refusalText(e) });
      }
      if (live) back();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, qid]);

  const untrap = useCallback(() => {
    if (!trapped.current) return;
    trapped.current = false;
    ignorePop.current = true;
    window.history.back();
  }, []);

  const finishRecording = useCallback(async (r: Awaited<ReturnType<VoiceRecorder["result"]>>, wasLimit: number) => {
    rec.current = null;
    untrap();
    if (discard.current) {
      discard.current = false;
      setPhase("idle");
      return;
    }
    if (r.blob.size === 0 || r.seconds < 0.5) {
      setPhase("idle");
      pushNote({ tone: "info", text: "That recording was too short. Tap the button and say a little more." });
      return;
    }
    const t: Take = { blob: r.blob, mime: r.mime, seconds: r.realSeconds, peaks: peaksFromLevels(levelsRef.current), key: uuidKey() };
    setTake(t);
    setPhase("preview");
    if (qid) void saveDraft({ ...t, questionId: qid, savedAt: Date.now() } satisfies Draft);
    if (r.overLimit && offers.length > 0) {
      interrupted.current = false;
      pushNote({ tone: "info", text: `That recording ran past ${wasLimit} seconds, so it cannot be sent as it is. Add extra time, or record it again.` });
      setSheetErr(null);
      setSheet({ hasTake: true });
    } else if (interrupted.current) {
      interrupted.current = false;
      pushNote({ tone: "info", text: "Your recording stopped when you left the page. Listen back, then send it or record again." });
    } else if (r.stoppedBy === "limit" && wasLimit === freeSeconds && offers.length > 0) {
      setSheetErr(null);
      setSheet({ hasTake: true });
    }
  }, [freeSeconds, offers.length, qid, untrap]);

  async function startRecording() {
    if (!qid || phase === "recording" || starting.current || rec.current) return;
    starting.current = true;
    setMicError(null);
    clearNotes();
    levelsRef.current = [];
    setLevels([]);
    setLeft(limit);
    discard.current = false;
    interrupted.current = false;
    const r = new VoiceRecorder({
      maxSeconds: limit,
      onTick: (secs, level) => {
        setLeft(secs);
        levelsRef.current.push(level);
        setLevels((l) => [...l.slice(-27), level]);
      },
    });
    let err: RecorderError | null;
    try {
      err = await r.start();
    } catch {
      err = "failed";
    } finally {
      starting.current = false;
    }
    if (err) {
      setMicError(err);
      return;
    }
    if (!alive.current) {
      r.cancel();
      return;
    }
    rec.current = r;
    startedAt.current = Date.now();
    window.history.pushState({ speakRecording: true }, "");
    trapped.current = true;
    setPhase("recording");
    const usedLimit = limit;
    void r.result().then((res) => finishRecording(res, usedLimit));
  }

  function stopRecording() {
    // a second tap of a double tap lands on the Stop button; it is not a request to stop
    if (Date.now() - startedAt.current < 700) {
      setNudge(true);
      setTimeout(() => setNudge(false), 1800);
      return;
    }
    rec.current?.stop();
  }

  // A recording stops when the page goes away (screen locks, a call, another tab) and keeps what it heard. The Back button discards it.
  useEffect(() => {
    if (phase !== "recording") return;
    const hide = () => {
      if (document.visibilityState === "hidden" && rec.current) {
        interrupted.current = true;
        rec.current.stop();
      }
    };
    const gone = () => {
      if (rec.current) {
        interrupted.current = true;
        rec.current.stop();
      }
    };
    const pop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (rec.current) {
        trapped.current = false;
        discard.current = true;
        rec.current.stop();
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", gone);
    window.addEventListener("popstate", pop);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", gone);
      window.removeEventListener("popstate", pop);
    };
  }, [phase]);

  // Leaving the page releases the microphone.
  useEffect(() => {
    alive.current = true; // a StrictMode double mount runs the cleanup once before the real mount
    return () => {
    alive.current = false;
    if (rec.current) {
      discard.current = true;
      rec.current.cancel();
    }
    };
  }, []);

  function dropTake(removeClip: boolean) {
    const st = sendState.current;
    if (removeClip && st?.clipId && signedIn) void api.deleteVoiceClip(st.clipId).catch(() => undefined);
    sendState.current = null;
    setTake(null);
    setPhase("idle");
    clearNotes();
    void clearDraft();
  }

  function close() {
    // release the history trap first, without navigating, so finishing the recording never calls history.back() after the push below
    const wasTrapped = trapped.current;
    trapped.current = false;
    if (rec.current) {
      discard.current = true;
      rec.current.stop();
    }
    void clearDraft();
    // lead ruling WF, 6 Nov (A-L6): Close replaces the recorder in history, so Back never returns to it.
    // WF-6b: while recording, the page pushed one extra entry (the trap). Step back over it first, then replace the recorder's own entry.
    const dest = qid ? `/q/${qid}` : "/";
    if (wasTrapped) {
      ignorePop.current = true;
      window.addEventListener("popstate", () => router.replace(dest), { once: true });
      window.history.back();
    } else {
      router.replace(dest);
    }
  }

  // held=1: a recording is held in the browser, so the join steps say "Finish and post my voice" and return here (A-M4).
  const joinHref = () => `${JOIN_PATH}?next=${encodeURIComponent(pathname + (qParam && !questionId ? `?q=${qParam}` : ""))}&held=1`;

  async function waitReady(clipId: string): Promise<void> {
    for (let i = 0; i < 90; i++) {
      const c = await api.getVoiceClip(clipId);
      if (c.status === "READY") return;
      if (c.status === "FAILED" || c.status === "REMOVED") throw new Error("CLIP_FAILED");
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("CLIP_SLOW");
  }

  async function send() {
    if (!take || !qid || sending) return;
    if (!signedIn) {
      await saveDraft({ ...take, questionId: qid, savedAt: Date.now() });
      window.location.assign(joinHref());
      return;
    }
    if (take.seconds > freeSeconds + 0.5 && !tokenFor(tokens, take.seconds, freeSeconds)) {
      pushNote({ tone: "danger", text: "A longer voice needs an extra voice token." });
      if (offers.length > 0) {
        setSheetErr(null);
        setSheet({ hasTake: true });
      }
      return;
    }
    clearNotes();
    setSending({ step: "upload", pct: 0 });
    let st = sendState.current;
    if (!st || st.key !== take.key) st = sendState.current = { key: take.key };
    let stage: "create" | "upload" | "later" = "create";
    try {
      if (!st.clipId) {
        const tok = tokenFor(tokens, take.seconds, freeSeconds);
        const up = await api.createVoiceClip({
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
      if (!st.completed) {
        await api.completeVoiceClip(st.clipId);
        st.completed = true;
      }
      setSending({ step: "process" });
      await waitReady(st.clipId);
      setSending({ step: "post" });
      const r = await api.createVoiceAnswer(qid, st.clipId, take.key, st.tokenId, mood.word);
      await clearDraft();
      writePick(qid, null);
      sendState.current = null;
      router.push(`/q/${qid}/posted?a=${r.answer.id}`);
    } catch (e) {
      setSending(null);
      if (stage === "upload" && st.clipId) {
        void api.deleteVoiceClip(st.clipId).catch(() => undefined);
        sendState.current = null;
      }
      if (e instanceof Error && e.message === "CLIP_FAILED") {
        sendState.current = null;
        pushNote({ tone: "danger", text: "We could not process that recording. Record it again and send it." });
        return;
      }
      if (e instanceof Error && e.message === "CLIP_SLOW") {
        pushNote({ tone: "info", text: "Your voice is still being prepared. Tap Send again in a moment.", action: "Send", onAction: () => void send() });
        return;
      }
      if (e instanceof ApiError && e.code === "EXTRA_VOICE_REQUIRED") {
        sendState.current = null;
        pushNote({ tone: "danger", text: refusalText(e) });
        if (offers.length > 0) {
          setSheetErr(null);
          setSheet({ hasTake: true });
        }
        return;
      }
      if (e instanceof ApiError && (e.code === "UNAUTHENTICATED" || e.code === "TOKEN_EXPIRED")) {
        await saveDraft({ ...take, questionId: qid, savedAt: Date.now() });
        window.location.assign(joinHref());
        return;
      }
      const retryable = !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
      pushNote({ tone: e instanceof ApiError && e.status === 0 ? "offline" : "danger", text: refusalText(e), action: retryable ? "Try again" : undefined, onAction: retryable ? () => void send() : undefined });
    }
  }

  async function pay(offer: api.ExtraVoiceOffer, method: api.PaymentMethod) {
    if (!qid || paying || payBusy.current) return;
    payBusy.current = true;
    if (take) await saveDraft({ ...take, questionId: qid, savedAt: Date.now() });
    if (!signedIn) {
      window.location.assign(joinHref());
      return;
    }
    setPaying(true);
    setSheetErr(null);
    try {
      const back = pathname + (qParam && !questionId ? `?q=${qParam}` : "");
      const init = await api.initExtraVoicePayment(offer.kind, method, back, payKey.current);
      setPendingPayment({ paymentId: init.paymentId, questionId: qid, key: uuidKey() });
      window.location.assign(init.checkoutUrl);
    } catch (e) {
      setSheetErr(refusalText(e));
      payBusy.current = false;
      setPaying(false);
      payKey.current = uuidKey();
    }
  }

  // ---- render ----
  if (loadErr) {
    const gone = loadErr instanceof ApiError && loadErr.status === 404;
    return (
      <div className="sp-page sp-page--plain">
        <div className="sp-plain">
          {gone ? <NotFoundState /> : (
            <>
              <Banner tone={loadErr instanceof ApiError && loadErr.status === 0 ? "offline" : "danger"} title="This did not load" action="Try again" onAction={() => setReload((n) => n + 1)}>
                {loadErr instanceof ApiError && loadErr.status === 0 ? "Check your connection and try again." : "Something went wrong on our side. Try again in a moment."}
              </Banner>
              <Button variant="secondary" href="/">Back to Home</Button>
            </>
          )}
        </div>
      </div>
    );
  }
  if (!info || !question || !config || !qid || (open && !mood.ready)) {
    return (
      <div className="sp-page" aria-busy="true">
        <div className="sp-loading"><Skeleton variant="tile" /></div>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="sp-page sp-page--plain">
        <div className="sp-plain">
          <Banner tone="info" title="This question has closed.">You can still read and listen to every voice.</Banner>
          <Button variant="secondary" href={`/q/${qid}`}>Listen to the voices</Button>
        </div>
      </div>
    );
  }

  const live = phase === "recording";
  const costs = allowance?.costs;
  const unitText = costs ? `${costs.voicePostMilli / 1000} unit${costs.voicePostMilli === 1000 ? "" : "s"}` : "1 unit";
  const unitNaira = costs ? naira(Math.round((costs.voicePostMilli * costs.baseKoboPerUnit) / 1000)) : "";
  const idleHint = (
    <p className="vx-rec__hint">
      {"Tap to record. You have "}
      <b>{`${limit} seconds`}</b>
      {limit > freeSeconds ? " with your extra voice." : freeLeft > 0 ? " on a free post." : ` for ${unitText}${unitNaira ? ` (${unitNaira})` : ""}.`}
    </p>
  );
  const liveHint = (
    <p className="vx-rec__hint" aria-live="polite">
      <b>{`${Math.ceil(left)} seconds left`}</b>
      {`. It stops by itself at ${limit}.`}
      {nudge ? <span className="sp-nudge" role="status">{" Keep talking, a little longer."}</span> : null}
    </p>
  );
  const feeNote = `Extra time is a one-off token for one message: ${[...offers].sort((a, b) => a.maxSeconds - b.maxSeconds).map((o) => `${naira(o.priceKobo)} for up to ${durationLabel(o.maxSeconds)}`).join(", ")}. Your first ${freeTotal} posts stay free.`;
  const help = micError ? MIC_HELP[micError] : null;
  const stepText = sending ? (sending.step === "upload" ? `Sending your voice, ${sending.pct}%` : sending.step === "process" ? "Getting your voice ready" : "Posting") : "";
  const sub = "Today’s question";
  const counts = { speak: short(voicesOf(question)), discuss: short(voicesOf(question)), next: short(question.proposalCount) };
  const eyebrow = [question.category?.name, question.topicTitle].filter(Boolean).join(" · ");

  const panel = (
    <section className={"vx-rec sp-rec" + (live ? " is-live" : "")} aria-label="Voice recorder">
      <div className="vx-rec__top">
        {live ? <span className="vx-rec__dot">Recording</span> : <Pill left={freeLeft} total={freeTotal} />}
      </div>
      {notes.map((n) => (
        <Banner key={n.text} tone={n.tone} title={n.title} action={n.action} onAction={n.onAction} onClose={() => setNotes((l) => l.filter((x) => x !== n))}>
          {n.text}
        </Banner>
      ))}
      <p className="vx-rec__q">{question.text}</p>
      {mood.word && qid ? <div className="sp-mood"><MoodWordNote mood={mood.word} changeHref={pickHref(qid)} /></div> : null}

      {phase !== "preview" && help ? (
        <div className="sp-help" role="alert">
          <Icon name="mic-off" size={36} />
          <h2 className="sp-help__t">{help.title}</h2>
          <p className="sp-help__b">{help.body}</p>
          <div className="sp-help__btns">
            {micError !== "unsupported" ? <Button variant="onforest" icon="rotate-ccw" onClick={() => void startRecording()}>Try again</Button> : null}
            <Button variant="onforest" icon="send" href={`/q/${qid}/write`}>Write instead</Button>
          </div>
        </div>
      ) : null}

      {phase !== "preview" && !help ? (
        <>
          <RecordStage live={live} limit={limit} left={left} levels={levels} freeLeft={freeLeft} hint={live ? liveHint : idleHint} onToggle={live ? stopRecording : () => void startRecording()} />
          {!live && limit === freeSeconds ? <PassPanel offers={offers} onPick={(o) => { setSheetErr(null); setSheet({ kind: o.kind, hasTake: false }); }} /> : null}
          {!live && limit === freeSeconds && offers.length > 0 ? <p className="sp-fine sp-fine--phone">{feeNote}</p> : null}
        </>
      ) : null}

      {phase === "preview" && take ? (
        <>
          <TakePlayer blob={take.blob} seconds={take.seconds} peaks={take.peaks} />
          <p className="vx-rec__hint">Listen back. Nothing posts until you tap Send.</p>
          {signedIn === false ? <p className="sp-fine">You sign in to post. Your recording waits here in this browser.</p> : null}
          {sending ? (
            <div className="sp-progress" role="status" aria-live="polite">
              <div className="sp-progress__bar"><i style={{ width: `${sending.step === "upload" ? sending.pct : 100}%` }} /></div>
              <span>{stepText}</span>
            </div>
          ) : null}
          <div className="vx-rec__actions">
            <Button variant="onforest" icon="rotate-ccw" disabled={!!sending} onClick={() => dropTake(true)}>Re-record</Button>
            <Button variant="onforest" icon="trash-2" disabled={!!sending} onClick={() => dropTake(true)}>Delete</Button>
            <Button size="l" icon="send" loading={!!sending} onClick={() => void send()}>{freeLeft > 0 ? "Send" : `Send for ${unitText}`}</Button>
          </div>
        </>
      ) : null}
    </section>
  );

  return (
    <div className="sp-page">
      <PhoneBar onClose={close} sub={sub} />
      <div className="sp-body">
        <div className="sp-head hidden dt:block">
          <BackLink href={`/q/${qid}`} />
          <StageBar current="speak" counts={counts} onChange={(id) => { if (id !== "speak") router.push(`/q/${qid}`); }} />
          <p className="sp-eyebrow"><span className="vx-eyebrow">Speak</span>{eyebrow ? <span>{eyebrow}</span> : null}</p>
          <h1 className="sp-title">{question.text}</h1>
          {question.hint ? <p className="sp-hint">{question.hint}</p> : null}
        </div>
        {panel}
        {phase === "idle" && !help ? (
          <div className="sp-alt">
            <Button variant="onforest" href={`/q/${qid}/write`} className="sp-alt__btn"><span className="sp-dtonly">Prefer to type? </span>Write instead</Button>
          </div>
        ) : null}
      </div>
      <Rail><RecordingTimeCard freeLeft={freeLeft} total={freeTotal} freeSeconds={freeSeconds} offers={offers} /></Rail>
      {sheet && offers.length > 0 ? (
        <ExtraVoiceSheet offers={offers} freeSeconds={freeSeconds} initial={sheet.kind} hasTake={sheet.hasTake} takeSeconds={take?.seconds} onRerecord={() => { setSheet(null); dropTake(true); }} paying={paying} error={sheetErr} onPay={(o, m) => void pay(o, m)} onClose={() => { setSheet(null); setSheetErr(null); }} />
      ) : null}
    </div>
  );
}
