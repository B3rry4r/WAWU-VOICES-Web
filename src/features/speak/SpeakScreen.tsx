"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "@/components/shell/ShellSlots";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, Icon, NotFoundState, Skeleton, StageBar } from "@/components/vx";
import { short } from "@/components/vx/helpers";
import { isSignedIn } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { BUSY_TEXT, BUSY_TITLE, isBusy } from "@/lib/api/busy";
import * as api from "@/lib/api/speak";
import { baseMime } from "@/lib/audio-ref/mime";
import { VoiceRecorder, type RecorderError } from "@/lib/audio-ref/recorder";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { needsNewKey } from "@/lib/api/keys";
import { InView } from "@/components/InView";
import { clearDraft, draftIsStale, loadDraft, saveDraft, saveDraftKeepingReply, STALE_NOTE, type Draft } from "./draft";
import { claimSend, releaseSend } from "./outbox";
import { freeCovers, peaksFromLevels, refusalText, tokenFor, uuidKey, voicePriceMilli } from "./logic";
import { BackLink, PhoneBar, Pill, RecordStage, RecordingTimeCard, TakePlayer } from "./parts";
import { tokensLabel } from "@/lib/shared/text-price";
import "./speak.css";
import { MoodWordNote } from "@/features/mood/MoodChip";
import { pickHref, useMoodWord, writePick } from "@/features/mood/mood";
import { cleanCode } from "@/features/share/speak-target";
import { voicesOf } from "@/lib/feed-format";
import { TagPicker, useIsEditor } from "@/features/news/TagPicker";
import { NO_TAG, tagFields, tagReady, validTag, type TagChoice } from "@/features/news/tag-choice";
import { AnonymousSwitch } from "@/features/talk/AnonymousSwitch";
import { readAnonPref, writeAnonPref } from "@/lib/anon-pref";
import { noteRecordingStarted, notePublished, rememberShareVisit, shareVisitCode } from "@/features/share/share-visit";

/** Where a guest goes to sign in. The recording waits in this browser (IndexedDB) until they are back (V-19). */
export const JOIN_PATH = "/join";

type Phase = "idle" | "recording" | "preview";
type Step = { step: "upload"; pct: number } | { step: "process" } | { step: "post" };
interface Take { blob: Blob; mime: string; seconds: number; peaks: number[]; key: string; recordedAt?: number }
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
  const [tag, setTag] = useState<TagChoice>(NO_TAG);
  const editor = useIsEditor(!!signedIn);

  const rec = useRef<VoiceRecorder | null>(null);
  const levelsRef = useRef<number[]>([]);
  const discard = useRef(false);
  const interrupted = useRef(false);
  const starting = useRef(false);
  const startedAt = useRef(0);
  const [nudge, setNudge] = useState(false);
  const alive = useRef(true);
  const trapped = useRef(false);
  const ignorePop = useRef(false);
  const sendState = useRef<{ key: string; clipId?: string; putUrl?: string; tokenId?: string; uploaded?: boolean; completed?: boolean } | null>(null);

  useEffect(() => setSignedIn(isSignedIn()), []);
  // A share link's "Add your voice" opens /speak?from=<code>: the visit is remembered (the tap itself is counted on the share page).
  useEffect(() => { rememberShareVisit(params.get("from")); }, [params]);

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
  const freeSeconds = allowance?.costs.freeVoiceSeconds ?? config?.voiceFreeSeconds ?? 60;
  const tokens = allowance?.extraVoiceTokens ?? [];
  // V-36: anyone may record up to the longest voice message; the price follows the length when it is sent.
  const limit = allowance?.maxVoiceSeconds ?? allowance?.costs.voiceMaxSeconds ?? 60;
  const freeTotal = config?.freePosts ?? 5;
  const freeLeft = allowance?.freePostsRemaining ?? freeTotal;
  const offers = config?.extraVoice ?? [];
  const qid = question?.id;
  // V-ANON: "Post without my name", off until turned on; a choice made before signing in or buying tokens is kept for this question.
  const [anon, setAnon] = useState(false);
  // send() reads the choice from this ref at call time: a retry button on an old banner must never post with an old choice.
  const anonRef = useRef(false);
  const chooseAnon = (v: boolean) => { anonRef.current = v; setAnon(v); if (qid) writeAnonPref(qid, v); };
  useEffect(() => { if (qid) { const v = readAnonPref(qid); anonRef.current = v; setAnon(v); } }, [qid]);
  const open = question ? question.status === "LIVE" : true;

  const pushNote = (n: Note) => setNotes((l) => [...l.filter((x) => x.text !== n.text), n]);
  const clearNotes = () => setNotes([]);

  // Restore a kept recording: a guest who signed in, someone back from checkout, a reload.
  useEffect(() => {
    if (!qid) return;
    let live = true;
    loadDraft().then((d) => {
      if (!live || !d || d.questionId !== qid || d.reply) return; // a kept voice reply belongs to the outbox, never to this screen
      // addendum 7.7: a saved recording is removed after 7 days, with a plain note.
      if (draftIsStale(d)) {
        void clearDraft();
        pushNote({ tone: "info", text: STALE_NOTE });
        return;
      }
      setTake({ blob: d.blob, mime: d.mime, seconds: d.seconds, peaks: d.peaks, key: d.key, recordedAt: d.recordedAt ?? d.savedAt });
      // A recording kept offline remembers the choices made when Send was tapped; the switch the person sees is the one that is sent.
      if (d.anonymous) { anonRef.current = true; setAnon(true); }
      if (validTag(d.tag)) setTag(d.tag as TagChoice); // the tag (and the source of a Verified News request) chosen before the join comes back with it
      setPhase("preview");
    });
    return () => { live = false; };
  }, [qid]);

  // V-FIX-D: back online with a recording waiting on this screen: say so, the Send button is right there (the outbox stays away from this page).
  useEffect(() => {
    const back = () => { if (take && phase === "preview" && !sending) pushNote({ tone: "info", text: "You are back online. Tap Send to post your recording." }); };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take, phase, sending]);

  // V-FIX-B round 2: a tag picked after recording is kept with the held recording, so it survives signing in.
  useEffect(() => {
    if (!qid || !take || phase !== "preview") return;
    const h = window.setTimeout(() => void saveDraftKeepingReply({ ...take, questionId: qid, savedAt: Date.now(), tag }), 300);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

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
    const t: Take = { blob: r.blob, mime: r.mime, seconds: r.realSeconds, peaks: peaksFromLevels(levelsRef.current), key: uuidKey(), recordedAt: Date.now() };
    setTake(t);
    setPhase("preview");
    if (qid) void saveDraftKeepingReply({ ...t, questionId: qid, savedAt: Date.now(), tag } satisfies Draft);
    if (r.overLimit) {
      interrupted.current = false;
      pushNote({ tone: "info", text: `That recording ran past ${wasLimit} seconds, so it cannot be sent as it is. Record it again.` });
    } else if (interrupted.current) {
      interrupted.current = false;
      pushNote({ tone: "info", text: "Your recording stopped when you left the page. Listen back, then send it or record again." });
    }
  }, [qid, untrap, tag]);

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
    noteRecordingStarted();
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
  // A share link's code (from) and the picked word come back with the person, so they land on the same screen with both.
  const joinHref = () => {
    const back = new URLSearchParams();
    if (qParam && !questionId) back.set("q", qParam);
    const from = cleanCode(params.get("from"));
    if (from) {
      back.set("from", from);
      const w = params.get("mood") ?? mood.word;
      if (w) back.set("mood", w);
    }
    const qs = back.toString();
    return `${JOIN_PATH}?next=${encodeURIComponent(pathname + (qs ? `?${qs}` : ""))}&held=1`;
  };

  async function waitReady(clipId: string): Promise<void> {
    for (let i = 0; i < 90; i++) {
      const c = await api.getVoiceClip(clipId);
      if (c.status === "READY") return;
      if (c.status === "FAILED" || c.status === "REMOVED") throw new Error("CLIP_FAILED");
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("CLIP_SLOW");
  }

  /** Keeps the recording on this device marked as waiting to go, with the switch and the word as they are now (read here, at the moment of keeping). */
  async function keepForLater(t: Take, replace = false) {
    if (!qid) return;
    // One kept recording only. A voice reply already waiting is never replaced without the person saying so.
    const cur = await loadDraft();
    if (!replace && cur?.reply && cur.key !== t.key) {
      pushNote({ tone: "info", text: "A voice reply is already waiting to be sent on this device. Saving this recording will replace it.", action: "Replace it", onAction: () => void keepForLater(t, true) });
      return;
    }
    const kept = await saveDraft({ ...t, questionId: qid, savedAt: Date.now(), queued: true, anonymous: anonRef.current, mood: mood.word ?? null, shareCode: shareVisitCode() } satisfies Draft);
    if (!kept) {
      // The device could not keep it (storage full or blocked): never say it is saved.
      pushNote({ tone: "danger", text: "We could not keep your recording on this device. Stay on this page until you are back online, then tap Send.", action: "Try again", onAction: () => void send() });
      return;
    }
    pushNote({
      tone: "offline",
      text: "You are offline. Your recording is saved on this device. It will be offered for sending when you are back online, or tap Send again then.",
      action: "Try again",
      onAction: () => void send(),
    });
  }

  async function send() {
    if (!take || !qid || sending) return;
    // V-FIX-B (addendum 1): a post cannot publish without a tag the person chose.
    if (!tagReady(tag)) return;
    if (!signedIn) {
      await saveDraft({ ...take, questionId: qid, savedAt: Date.now(), tag });
      window.location.assign(joinHref());
      return;
    }
    clearNotes();
    // V-FIX-D: offline, nothing is tried. The recording is kept on this device marked as waiting, and the outbox offers it again when the connection is back.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await keepForLater(take);
      return;
    }
    // One send per recording at a time: the outbox may be holding the same recording.
    if (!claimSend(take.key)) { pushNote({ tone: "info", text: "This recording is already being sent." }); return; }
    setSending({ step: "upload", pct: 0 });
    let st = sendState.current;
    if (!st || st.key !== take.key) st = sendState.current = { key: take.key };
    let stage: "create" | "upload" | "later" = "create";
    try {
      if (!st.clipId) {
        const tok = tokenFor(tokens, take.seconds, freeSeconds, freeLeft);
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
      const r = await api.createVoiceAnswer(qid, st.clipId, take.key, st.tokenId, mood.word, anonRef.current, tagFields(tag));
      writeAnonPref(qid, false);
      notePublished();
      await clearDraft();
      releaseSend(take.key);
      writePick(qid, null);
      sendState.current = null;
      router.push(`/q/${qid}/posted?a=${r.answer.id}`);
    } catch (e) {
      releaseSend(take.key);
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
      if (needsNewKey(e)) {
        // The server refused the key as spent: the same recording goes out under a new key (and a new clip), here and in the kept draft.
        sendState.current = null;
        const next: Take = { ...take, key: uuidKey() };
        setTake(next);
        void saveDraftKeepingReply({ ...next, questionId: qid, savedAt: Date.now(), tag } satisfies Draft);
        pushNote({ tone: "danger", text: refusalText(e) });
        return;
      }
      if (e instanceof ApiError && e.status === 402) {
        // Not enough tokens (or the free posts are used): the recording is kept, and the person goes to get tokens.
        pushNote({
          tone: "danger",
          text: refusalText(e),
          action: "Get tokens",
          onAction: () => {
            void saveDraftKeepingReply({ ...take, questionId: qid, savedAt: Date.now(), tag }).finally(() => router.push(`/units/buy?from=${encodeURIComponent(pathname + (qParam && !questionId ? `?q=${qParam}` : ""))}`));
          },
        });
        return;
      }
      if (e instanceof ApiError && (e.code === "UNAUTHENTICATED" || e.code === "TOKEN_EXPIRED")) {
        await saveDraftKeepingReply({ ...take, questionId: qid, savedAt: Date.now(), tag });
        window.location.assign(joinHref());
        return;
      }
      // The upload goes straight to storage: offline there is a plain network error, not an ApiError with status 0.
      if ((e instanceof ApiError && e.status === 0) || (typeof navigator !== "undefined" && navigator.onLine === false)) {
        await keepForLater(take);
        return;
      }
      const retryable = !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
      pushNote({ tone: e instanceof ApiError && e.status === 0 ? "offline" : "danger", text: refusalText(e), action: retryable ? "Try again" : undefined, onAction: retryable ? () => void send() : undefined });
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
              <Banner tone={loadErr instanceof ApiError && loadErr.status === 0 ? "offline" : "danger"} title={isBusy(loadErr) ? BUSY_TITLE : "This did not load"} action="Try again" onAction={() => setReload((n) => n + 1)}>
                {loadErr instanceof ApiError && loadErr.status === 0 ? "Check your connection and try again." : isBusy(loadErr) ? BUSY_TEXT : "Something went wrong on our side. Try again in a moment."}
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
  const costs = allowance?.costs ?? config?.costs;
  const t1 = costs?.voiceTier1Seconds ?? 30;
  const priceFor = (seconds: number): string => {
    if (!costs) return "";
    return `${tokensLabel(voicePriceMilli(seconds, costs))} tokens`;
  };
  const covered = (seconds: number) => freeLeft > 0 && freeCovers(seconds, freeSeconds);
  // An old extra voice token the person already paid for covers a message once the free posts are used.
  const usesToken = (seconds: number) => !!tokenFor(tokens, seconds, freeSeconds, freeLeft);
  const held = freeLeft === 0 ? [...tokens].filter((t) => t.status === "AVAILABLE").sort((a, b) => b.maxSeconds - a.maxSeconds)[0] : undefined;
  const idleHint = (
    <p className="vx-rec__hint">
      {"Tap to record. You have "}
      <b>{`${limit} seconds`}</b>
      {". "}
      {freeLeft > 0
        ? `This one is free, up to ${freeSeconds === 60 ? "a minute" : `${freeSeconds} seconds`}.`
        : held
          ? `Your extra voice token covers a message of up to ${held.maxSeconds} seconds. Nothing is charged in tokens.`
          : costs
            ? `Up to ${t1} seconds is ${priceFor(t1)}, longer is ${priceFor(limit)}, charged when you send.`
          : null}
    </p>
  );
  const liveHint = (
    <p className="vx-rec__hint" aria-live="polite">
      <b>{`${Math.ceil(left)} seconds left`}</b>
      {`. It stops by itself at ${limit}.`}
      {nudge ? <span className="sp-nudge" role="status">{" Keep talking, a little longer."}</span> : null}
    </p>
  );
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
        <InView key={n.text}>
          <Banner tone={n.tone} title={n.title} action={n.action} onAction={n.onAction} onClose={() => setNotes((l) => l.filter((x) => x !== n))}>
            {n.text}
          </Banner>
        </InView>
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
        </>
      ) : null}

      {phase === "preview" && take ? (
        <>
          <TakePlayer blob={take.blob} seconds={take.seconds} peaks={take.peaks} />
          <p className="vx-rec__hint">Listen back. Nothing posts until you tap Send.</p>
          <TagPicker value={tag} onChange={setTag} editor={editor} className="sp-tags" />
          {usesToken(take.seconds) ? <p className="vx-rec__hint" role="status">This message uses the extra voice token you already bought. Nothing is charged in tokens.</p> : null}
          <AnonymousSwitch onForest on={anon} disabled={!!sending} onChange={chooseAnon} />
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
            <Button size="l" icon="send" loading={!!sending} disabled={!tagReady(tag)} onClick={() => void send()}>{covered(take.seconds) || usesToken(take.seconds) ? "Send" : `Send for ${priceFor(take.seconds)}`}</Button>
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
    </div>
  );
}
