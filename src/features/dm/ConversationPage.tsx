"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Banner, Button, EmptyState, Icon, IconButton, Sheet, Skeleton, VoicePlayer } from "@/components/vx";
import * as api from "@/lib/api/dm";
import { ApiError } from "@/lib/api/client";
import { VoiceRecorder, type RecorderError } from "@/lib/audio-ref/recorder";
import { announceDmUnread } from "@/components/shell/Messages";
import { VerifiedTick } from "@/features/verify/VerifiedTick";
import { Problem, SignInNote, uuidKey, useClipPlayback, useSignedIn } from "@/features/talk/lib";
import { DM_MAX_CHARS, PLANS_HREF, caption, clockOf, dayLabel, dmFailure, personName, textPrice, tokensText, voicePrice, type DmCosts, type DmFailure } from "./dm-logic";
import { uploadDmVoice } from "./dm-voice";
import "./dm.css";

const REASONS: { id: api.ReportReason; label: string }[] = [
  { id: "HATE_OR_HARASSMENT", label: "Hate or harassment" },
  { id: "THREAT_OR_VIOLENCE", label: "Threat or violence" },
  { id: "SCAM_OR_SPAM", label: "Scam or spam" },
  { id: "PERSONAL_DETAILS", label: "Shares personal details" },
  { id: "OTHER", label: "Something else" },
];

const MIC_TEXT: Record<RecorderError, string> = {
  unsupported: "This browser cannot record. Try another browser.",
  permission_denied: "Allow the microphone in your browser settings, then try again.",
  no_microphone: "No microphone was found on this device.",
  failed: "The microphone could not start. Try again.",
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

function Clip({ clip, tone, onFail }: { clip: NonNullable<api.DmMessage["clip"]>; tone: "mint" | "surface"; onFail: (e: unknown) => void }) {
  const play = useClipPlayback(clip.id, onFail);
  return <VoicePlayer key={play.rev} tone={tone} duration={Math.max(1, Math.round((clip.durationMs ?? 10000) / 1000))} seed={clip.id.length * 7} onPlayingChange={(on) => void play.toggle(on)} />;
}

/** One bubble: theirs on the left (surface), yours on the right (mint), the time under it. A voice has its player and, once it exists, its transcript. */
function Bubble({ m, onFail }: { m: api.DmMessage; onFail: (e: unknown) => void }) {
  const gone = m.status !== "PUBLISHED";
  return (
    <div className={"dm-msg" + (m.mine ? " dm-msg--mine" : "")}>
      <div className={"dm-bubble" + (!gone && m.clip ? " dm-bubble--voice" : "")}>
        {gone ? <p className="dm-bubble__gone">This message was removed.</p> : null}
        {!gone && m.clip ? <Clip clip={m.clip} tone={m.mine ? "surface" : "mint"} onFail={onFail} /> : null}
        {!gone && m.clip?.transcript ? <p className="dm-bubble__transcript"><b>Transcript </b>{m.clip.transcript}</p> : null}
        {!gone && m.body ? <p className="dm-bubble__text">{m.body}</p> : null}
      </div>
      <span className="dm-time">{clockOf(m.createdAt)}</span>
    </div>
  );
}

function ReportSheet({ handle, onClose, onSend }: { handle: string; onClose: () => void; onSend: (reason: api.ReportReason, note: string | undefined, alsoBlock: boolean) => Promise<void> }) {
  const [reason, setReason] = useState<api.ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    if (!reason || busy) return;
    setBusy(true); setError(null);
    try { await onSend(reason, note.trim() || undefined, alsoBlock); setDone(true); }
    catch (e) { setError(e instanceof ApiError && e.status === 409 ? "You already reported this. Our team has it." : dmFailure(e).text); }
    finally { setBusy(false); }
  }
  return (
    <Sheet title={done ? "Thanks. We got your report." : `Report ${handle}`} onClose={onClose}>
      {done ? (
        <div className="dm-menu">
          <p className="dm-note">{`Our moderators will look at this and act if it breaks the community rules. ${handle} is not told who reported them.`}</p>
          <Button block variant="secondary" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="dm-menu">
          <div role="radiogroup" aria-label="Why are you reporting this?" className="dm-radios">
            {REASONS.map((r) => <label key={r.id} className="dm-radio"><input type="radio" name="dm-reason" checked={reason === r.id} onChange={() => setReason(r.id)} />{r.label}</label>)}
          </div>
          <label className="dm-radio"><input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />{`Also block ${handle}`}</label>
          <label className="dm-note" htmlFor="dm-note">Add a note (optional)</label>
          <textarea id="dm-note" maxLength={280} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should our team look at?" />
          {error ? <p className="dm-note dm-note--err" role="alert">{error}</p> : null}
          <Button block loading={busy} disabled={!reason} onClick={() => void send()}>Send report</Button>
        </div>
      )}
    </Sheet>
  );
}

type Take = { blob: Blob; mime: string; seconds: number };
type Out = { kind: "TEXT"; body: string } | { kind: "VOICE"; take: Take };

/** The bottom bar as the board draws it: a "Write a message" pill and a round green mic, one caption line under it.
 *  Typing turns the mic into Send. The cost is in the caption only when a price is set (0 is free). */
function Composer({ costs, canType, blockedText, onSend }: { costs: DmCosts | null; canType: boolean; blockedText: string | null; onSend: (m: Out) => Promise<DmFailure | null> }) {
  const [text, setText] = useState("");
  const [take, setTake] = useState<Take | null>(null);
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(0);
  const [mic, setMic] = useState<string | null>(null);
  const [fail, setFail] = useState<DmFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const rec = useRef<VoiceRecorder | null>(null);
  useEffect(() => () => rec.current?.cancel(), []);
  const maxSeconds = costs?.voiceMaxSeconds ?? 60;

  const hasText = text.trim().length > 0;
  const price = costs ? textPrice(text, costs) : null;
  const tooLong = (price?.chars ?? text.trim().length) > DM_MAX_CHARS;

  async function startRec() {
    if (recording || busy) return;
    setMic(null); setFail(null);
    const r = new VoiceRecorder({ maxSeconds, onTick: (s) => setLeft(s) });
    const err = await r.start();
    if (err) { setMic(MIC_TEXT[err]); return; }
    rec.current = r;
    setLeft(maxSeconds);
    setRecording(true);
    void r.result().then((res) => {
      rec.current = null;
      setRecording(false);
      if (res.blob.size === 0 || res.seconds < 0.5) { setMic("That recording was too short. Tap the microphone and say a little more."); return; }
      if (res.overLimit) { setMic(`A voice message is at most ${maxSeconds} seconds. Record it again.`); return; }
      setTake({ blob: res.blob, mime: res.mime, seconds: res.realSeconds });
    });
  }

  async function submit() {
    if (busy) return;
    setBusy(true); setFail(null);
    const r = take ? await onSend({ kind: "VOICE", take }) : await onSend({ kind: "TEXT", body: text.trim() });
    setBusy(false);
    if (r) { setFail(r); return; }
    setText(""); setTake(null);
  }

  if (blockedText) return <div className="dm-compose"><p className="dm-caption" role="status">{blockedText}</p></div>;
  const voiceCost = costs && take ? voicePrice(take.seconds, costs) : 0;
  const line = hasText && price && price.milli > 0 ? `${price.chars.toLocaleString("en-NG")} of ${DM_MAX_CHARS.toLocaleString("en-NG")} characters. Costs ${tokensText(price.milli)}.` : take && voiceCost > 0 ? `Costs ${tokensText(voiceCost)}.` : caption(costs);
  return (
    <div className="dm-compose">
      {fail ? (
        <Banner tone="danger" title={fail.text}>
          {fail.plans ? <Link href={PLANS_HREF} className="link">See how to get verified</Link> : null}
          {fail.buy ? <Link href={`${PLANS_HREF}?from=${encodeURIComponent("/messages")}`} className="link">Get tokens</Link> : null}
        </Banner>
      ) : null}
      {mic ? <p className="dm-note dm-note--err" role="alert">{mic}</p> : null}
      {recording ? (
        <div className="dm-rec" role="status">
          <Icon name="mic" size={22} />
          <span className="dm-rec__t">{`Recording ${mmss(maxSeconds - left)} of ${mmss(maxSeconds)}`}</span>
          <Button variant="secondary" icon="square" onClick={() => rec.current?.stop()}>Stop</Button>
        </div>
      ) : take ? (
        <div className="dm-rec">
          <Icon name="mic" size={22} />
          <span className="dm-rec__t">{`Voice message ${mmss(take.seconds)}`}</span>
          <IconButton icon="trash-2" label="Discard this recording" variant="ghost" onClick={() => { setTake(null); setFail(null); }} />
          <Button icon="send" loading={busy} disabled={!canType} onClick={() => void submit()}>Send</Button>
        </div>
      ) : (
        <div className="dm-compose__row">
          <label className="dm-field">
            <span className="vx-sr">Message</span>
            <input type="text" value={text} disabled={!canType || busy} placeholder="Write a message" enterKeyHint="send" aria-label="Your message"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && hasText && !tooLong) { e.preventDefault(); void submit(); } }} />
          </label>
          {hasText ? (
            <button type="button" className="dm-round" aria-label="Send message" disabled={!canType || busy || tooLong} onClick={() => void submit()}><Icon name="send" size={26} /></button>
          ) : (
            <button type="button" className="dm-round" aria-label="Record a voice message" disabled={!canType} onClick={() => void startRec()}><Icon name="mic" size={26} /></button>
          )}
        </div>
      )}
      {!recording ? <p className={"dm-caption" + (tooLong ? " dm-caption--err" : "")} data-testid="dm-caption">{tooLong ? `Keep it to ${DM_MAX_CHARS.toLocaleString("en-NG")} characters.` : line}</p> : null}
    </div>
  );
}

/** One chat. Opened by its id (from the inbox) or by the other person's id (New message, a profile), which becomes the id once a message is sent. */
export function ConversationPage({ conversationId, userId }: { conversationId?: string; userId?: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [convId, setConvId] = useState<string | null>(conversationId ?? null);
  const [person, setPerson] = useState<api.DmPerson | null>(null);
  const [accepts, setAccepts] = useState(true);
  const [muted, setMuted] = useState(false);
  const [items, setItems] = useState<api.DmMessage[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [costs, setCosts] = useState<DmCosts | null>(null);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const key = useRef<{ sig: string; k: string; clipId?: string } | null>(null);

  const pull = useCallback(async (id: string) => {
    const p = await api.listMessages(id);
    setPerson(p.person);
    setMuted(p.muted);
    setItems((cur) => {
      const seen = new Set(p.items.map((m) => m.id));
      return [...p.items, ...cur.filter((m) => !seen.has(m.id))].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1));
    });
    return p;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let stop = false;
    setError(null);
    (async () => {
      try {
        api.getDmLimits().then((l) => { if (!stop) setCosts(l); }, () => undefined);
        if (conversationId) {
          const p = await pull(conversationId);
          if (stop) return;
          setNext(p.nextCursor);
          setReady(true);
          await api.markRead(conversationId).catch(() => undefined);
          api.getDmUnread().then((r) => announceDmUnread(r.unread), () => undefined);
        } else if (userId) {
          const w = await api.getDmWith(userId);
          if (stop) return;
          if (w.conversationId) { router.replace(`/messages/${w.conversationId}`); return; }
          setPerson(w.person);
          setAccepts(w.acceptsMessages);
          setReady(true);
        }
      } catch (e) { if (!stop) setError(e); }
    })();
    return () => { stop = true; };
  }, [signedIn, conversationId, userId, router, pull, tries]);

  // New messages from the other person: look again when the window is focused and every 30 seconds while it is open.
  useEffect(() => {
    if (!conversationId || !ready) return;
    const look = () => {
      if (document.visibilityState === "hidden") return;
      pull(conversationId).then(() => api.markRead(conversationId)).then(() => api.getDmUnread()).then((r) => announceDmUnread(r.unread)).catch(() => undefined);
    };
    const t = setInterval(look, 30_000);
    window.addEventListener("focus", look);
    return () => { clearInterval(t); window.removeEventListener("focus", look); };
  }, [conversationId, ready, pull]);

  async function older() {
    if (!next || !convId) return;
    try {
      const p = await api.listMessages(convId, next);
      setItems((cur) => [...cur, ...p.items]);
      setNext(p.nextCursor);
    } catch (e) { setError(e); }
  }

  /** One tap, one key: a retry of the same message reuses it (so the server charges once); a refusal makes the next try a new one. */
  async function send(m: Out): Promise<DmFailure | null> {
    const to = person?.id ?? userId;
    if (!to) return dmFailure(null);
    const sig = m.kind === "TEXT" ? `t:${m.body}` : `v:${m.take.blob.size}:${m.take.seconds}`;
    if (!key.current || key.current.sig !== sig) key.current = { sig, k: uuidKey() };
    try {
      let body: api.SendDmRequest;
      if (m.kind === "TEXT") body = { toUserId: to, kind: "TEXT", body: m.body };
      else {
        if (!key.current.clipId) key.current.clipId = (await uploadDmVoice(m.take)).id;
        body = { toUserId: to, kind: "VOICE", clipId: key.current.clipId };
      }
      const r = await api.sendDm(body, key.current.k);
      key.current = null;
      setItems((cur) => (cur.some((x) => x.id === r.message.id) ? cur : [r.message, ...cur]));
      api.getDmLimits().then(setCosts, () => undefined);
      if (!convId) { setConvId(r.message.conversationId); router.replace(`/messages/${r.message.conversationId}`); }
      return null;
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) key.current = { sig, k: uuidKey(), clipId: key.current?.clipId };
      return dmFailure(e);
    }
  }

  async function toggleMute() {
    if (!convId) return;
    setMenu(false);
    try { if (muted) await api.unmuteChat(convId); else await api.muteChat(convId); setMuted(!muted); api.getDmUnread().then((r) => announceDmUnread(r.unread), () => undefined); }
    catch { setNote("Could not change that. Try again."); }
  }
  async function block() {
    if (!person) return;
    setMenu(false);
    try { await api.blockPerson(person.id); router.push("/messages"); } catch { setNote("Could not block this person. Try again."); }
  }
  /** Report @handle: the latest message they sent when there is one, else the person. */
  async function report(reason: api.ReportReason, why: string | undefined, alsoBlock: boolean) {
    if (!person) return;
    const theirs = items.find((m) => !m.mine && m.status === "PUBLISHED");
    const r = theirs ? await api.reportMessage(theirs.id, reason, why, alsoBlock) : await api.reportPerson(person.id, reason, why, alsoBlock);
    if (r.blocked) setTimeout(() => router.push("/messages"), 1500);
  }

  const handle = person ? `@${person.handle}` : "";
  const header = (
    <header className="dm-bar sticky top-0 z-[var(--z-sticky)] -mx-4 flex min-h-14 items-center gap-1 border-b border-[var(--line)] bg-[var(--bg)] px-2 dt:static dt:mx-0 dt:border-0 dt:px-0">
      <Link href="/messages" aria-label="Back to messages" className="sh-iconbtn border-0 bg-transparent shadow-none"><Icon name="arrow-left" size={24} /></Link>
      <div className="dm-head">
        {person ? <Avatar name={personName(person)} /> : null}
        <div className="dm-head__who">
          <span className="dm-head__name">{person ? personName(person) : "Message"}<VerifiedTick verified={person?.verified} /></span>
          {person && !person.deleted ? <span className="dm-head__sub">{`${handle}${person.place ? ` · ${person.place}` : ""}`}</span> : null}
        </div>
      </div>
      {person && !person.deleted ? <IconButton icon="ellipsis" label="More: mute, report or block" variant="ghost" iconSize={24} onClick={() => setMenu((v) => !v)} /> : null}
      {menu && person ? (
        <div role="menu" aria-label={`Chat with ${handle}`} className="dm-pop">
          {convId ? <button type="button" role="menuitem" className="dm-menu__row" onClick={() => void toggleMute()}><Icon name="bell" size={20} />{muted ? "Unmute this chat" : "Mute this chat"}</button> : null}
          <button type="button" role="menuitem" className="dm-menu__row" onClick={() => { setMenu(false); setReporting(true); }}><Icon name="flag" size={20} />{`Report ${handle}`}</button>
          <button type="button" role="menuitem" className="dm-menu__row dm-menu__row--danger" onClick={() => void block()}><Icon name="circle-x" size={20} />{`Block ${handle}`}</button>
        </div>
      ) : null}
    </header>
  );

  if (signedIn === false) return <div className="dm-page">{header}<SignInNote from="/messages">Sign in to message people.</SignInNote></div>;
  if (error) return <div className="dm-page">{header}<Problem error={error} onRetry={() => setTries((n) => n + 1)} /></div>;
  if (!ready) return <div className="dm-page" aria-busy="true">{header}<Skeleton variant="answer" /></div>;

  const chrono = [...items].reverse();
  return (
    <div className="dm-page">
      {header}
      {note ? <p className="dm-note dm-note--err" role="alert">{note}</p> : null}
      {next ? <Button variant="secondary" block onClick={() => void older()}>Show older messages</Button> : null}
      {items.length === 0 ? (
        <EmptyState icon="message-circle" title="Say hello" body="Write a message or tap the microphone to send a voice message." />
      ) : (
        <div className="dm-thread" role="log" aria-label="Messages">
          {chrono.map((m, i) => (
            <div key={m.id} style={{ display: "contents" }}>
              {i === 0 || dayLabel(m.createdAt) !== dayLabel(chrono[i - 1].createdAt) ? <p className="dm-day">{dayLabel(m.createdAt)}</p> : null}
              <Bubble m={m} onFail={() => setNote("Could not play this recording. Try again.")} />
            </div>
          ))}
        </div>
      )}
      <Composer costs={costs} canType={accepts} blockedText={accepts ? null : "You can't message this person."} onSend={send} />
      {reporting && person ? <ReportSheet handle={handle} onClose={() => setReporting(false)} onSend={report} /> : null}
    </div>
  );
}
