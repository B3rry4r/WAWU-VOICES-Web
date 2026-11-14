import { ApiError, WrongPersonError, sessionSubject } from "@/lib/api/client";
import { freshKey, needsNewKey } from "@/lib/api/keys";
import * as api from "@/lib/api/speak";
import { createVoiceReply } from "@/lib/api/talk";
import type { Mood } from "@/lib/api/mood";
import { baseMime } from "@/lib/audio-ref/mime";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { tokensLabel } from "@/lib/shared/text-price";
import { freeCovers, tokenFor, voicePriceMilli } from "./logic";
import { saveDraft, type Draft } from "./draft";

/**
 * Recordings made offline (addendum 7.7). A recording whose Send could not go is kept on the device with `queued` set. When the
 * connection is back, or the app opens again, each one is dealt with here:
 *  - a free post covers it: it is sent by itself;
 *  - anything else costs tokens: it is offered with its price and goes only when the person taps Send, so tokens are never charged unseen.
 * The recording's own key is the answer's Idempotency-Key, so the same recording can never post twice, and one send per key runs at a time.
 */
export interface SendPlan {
  /** A free post covers this recording: it may be sent without a tap. */
  free: boolean;
  /** "Send" for a free one, "Send for 1.2 tokens" otherwise. */
  label: string;
  tokenId?: string;
}

export interface PlanInput { allowance: api.Allowances; config: api.PublicConfig }

/** What sending this recording would cost the person, from the same numbers the record screen shows. */
export function planFor(d: Pick<Draft, "seconds">, { allowance, config }: PlanInput): SendPlan {
  const freeSeconds = allowance.costs.freeVoiceSeconds ?? config.voiceFreeSeconds ?? 10;
  const free = allowance.freePostsRemaining > 0 && freeCovers(d.seconds, freeSeconds);
  if (free) return { free: true, label: "Send" };
  const tok = tokenFor(allowance.extraVoiceTokens ?? [], d.seconds, freeSeconds);
  return { free: false, label: `Send for ${tokensLabel(voicePriceMilli(d.seconds, allowance.costs))} tokens`, tokenId: tok?.id };
}

const inFlight = new Set<string>();
/** True while this recording is being sent by the outbox or by the record screen. */
export const isSending = (key: string): boolean => inFlight.has(key);
/** The record screen takes the same lock for its own send, so the two never send one recording at once. */
export function claimSend(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}
export const releaseSend = (key: string): void => { inFlight.delete(key); };

export type SendResult =
  | { ok: true; answerId: string; questionId: string; /** Set when the kept recording was a voice reply: the answer it was posted under. */ replyTo?: string }
  /** Another tab sent this recording while this one waited: it is done, and there is nothing more to do here. */
  | { ok: true; answerId: null; questionId: string; byOtherTab: true }
  | { ok: false; reason: "busy" | "offline" | "needs_tokens" | "failed"; message?: string; draft?: Draft };

async function waitReady(clipId: string, subject?: string): Promise<void> {
  for (let i = 0; i < 90; i++) {
    const c = await api.getVoiceClip(clipId, subject);
    if (c.status === "READY") return;
    if (c.status === "FAILED" || c.status === "REMOVED") throw new Error("CLIP_FAILED");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("CLIP_SLOW");
}

/** Sends one kept recording as a voice answer: create the clip, upload, complete, wait until READY, post with the recording's own key. */
async function sendHere(d: Draft, tokenId?: string, forOwner?: string | null): Promise<SendResult> {
  // A recording is sent only for the person it was opened for: if someone else is signed in now, nothing goes and nothing is touched.
  if (forOwner !== undefined && sessionSubject() !== forOwner) return { ok: false, reason: "failed", message: "You are signed in as someone else in another tab. Nothing was sent." };
  if (!claimSend(d.key)) return { ok: false, reason: "busy" };
  let clipId: string | undefined;
  let uploaded = false;
  // The recording goes out only as the person signed in when the send began.
  const subject = (forOwner !== undefined ? forOwner : sessionSubject()) ?? undefined;
  try {
    const up = await api.createVoiceClip({
      mime: baseMime(d.mime) as "audio/webm" | "audio/mp4" | "audio/ogg",
      sizeBytes: d.blob.size,
      durationMs: Math.round(d.seconds * 1000),
      extraVoiceTokenId: tokenId,
      ...(d.reply ? { purpose: "REPLY" as const } : {}),
    }, subject);
    clipId = up.clip.id;
    if (subject !== undefined && sessionSubject() !== subject) throw new WrongPersonError();
    await putWithRetry({ url: up.putUrl, key: "", headers: {} }, d.blob, () => undefined);
    uploaded = true;
    await api.completeVoiceClip(clipId, subject);
    await waitReady(clipId, subject);
    // Asked again right before the post: a slow step above may have outlasted the sign-in.
    if (subject !== undefined && sessionSubject() !== subject) throw new WrongPersonError();
    if (d.reply) {
      // The same reply it was made as: the parent answer, the stance, the name switch and the Idempotency-Key it was kept with.
      const rr = await createVoiceReply(d.reply.answerId, d.reply.stance, clipId, d.key, tokenId, !!d.anonymous, subject);
      return { ok: true, answerId: String((rr as { reply?: { id?: string } }).reply?.id ?? d.reply.answerId), questionId: d.questionId, replyTo: d.reply.answerId };
    }
    const r = await api.createVoiceAnswer(d.questionId, clipId, d.key, tokenId, (d.mood as Mood | null | undefined) ?? null, !!d.anonymous, null, subject);
    return { ok: true, answerId: r.answer.id, questionId: d.questionId };
  } catch (e) {
    if (clipId && !uploaded) void api.deleteVoiceClip(clipId, subject).catch(() => undefined);
    // The recording's key is dropped only when the server says it is spent (a 409 asking for a new key). A 500, 502, 504, 429 or a
    // network failure keeps it, so the retry is the same request and the server can hand the first post back.
    if (needsNewKey(e)) {
      const next: Draft = { ...d, key: freshKey() };
      if (sessionSubject() === (subject ?? null)) await saveDraft(subject ?? null, next);
      return { ok: false, reason: "failed", message: e instanceof ApiError && e.explained && e.message.trim() ? e.message : undefined, draft: next };
    }
    if (e instanceof ApiError && e.status === 402) return { ok: false, reason: "needs_tokens", message: e.explained && e.message.trim() ? e.message : undefined };
    // The upload goes straight to storage, so being offline there is a plain network error, not an ApiError.
    if ((e instanceof ApiError && e.status === 0) || (typeof navigator !== "undefined" && navigator.onLine === false)) return { ok: false, reason: "offline" };
    return { ok: false, reason: "failed", message: e instanceof ApiError && e.explained && e.message.trim() ? e.message : undefined };
  } finally {
    releaseSend(d.key);
  }
}

const FLAG = (key: string) => `voices-send-lock:${key}`;
const FLAG_LIFE_MS = 2 * 60 * 1000;

/**
 * One tab sends a kept recording; any other tab waits and then shows the result, and uploads nothing. The lock is the Web Locks
 * API where the browser has it, else a storage flag that dies after two minutes (a tab that closes mid-send cannot block it for good).
 * After waiting, the kept copy is looked at again: when it is gone the other tab posted it.
 */
export async function sendKeptRecording(
  d: Draft,
  tokenId?: string,
  stillKept: () => Promise<boolean> = async () => false,
  /** Runs inside the lock after a successful post (the caller removes the kept copy here, so a waiting tab never sees a posted recording as kept). */
  onPosted: () => Promise<void> = async () => undefined,
  /** Asked once the lock is held, before anything is sent: is this same recording still the one waiting? When it was posted by another tab in the meantime, it is gone and nothing is sent. */
  stillWaiting: () => Promise<boolean> = async () => true,
  /** The person this recording was kept for (the one signed in when the screen or banner opened). Left out: whoever is signed in when the send begins. */
  forOwner?: string | null,
): Promise<SendResult> {
  const sendThenTidy = async (): Promise<SendResult> => {
    // A tab that waited for the lock reads the kept copy again: the first tab may have posted and cleared it already.
    if (!(await stillWaiting())) return { ok: true, answerId: null, questionId: d.questionId, byOtherTab: true };
    const r = await sendHere(d, tokenId, forOwner);
    if (r.ok) await onPosted();
    return r;
  };
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  const other: SendResult = { ok: true, answerId: null, questionId: d.questionId, byOtherTab: true };
  if (locks) {
    const name = `voices-send:${d.key}`;
    const mine = await locks.request(name, { ifAvailable: true }, async (lock) => (lock ? await sendThenTidy() : null));
    if (mine) return mine;
    await locks.request(name, async () => undefined); // waits until the other tab has finished
    return (await stillKept()) ? { ok: false, reason: "failed" } : other;
  }
  const flag = FLAG(d.key);
  const held = (): boolean => {
    try { const t = Number(window.localStorage.getItem(flag)); return !!t && Date.now() - t < FLAG_LIFE_MS; } catch { return false; }
  };
  if (held()) {
    while (held()) await new Promise((r) => setTimeout(r, 1000));
    return (await stillKept()) ? { ok: false, reason: "failed" } : other;
  }
  try { window.localStorage.setItem(flag, String(Date.now())); } catch { /* no flag: the in-tab lock still holds */ }
  try {
    return await sendThenTidy();
  } finally {
    try { window.localStorage.removeItem(flag); } catch { /* nothing to clear */ }
  }
}
