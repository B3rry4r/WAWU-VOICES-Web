import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/speak";
import type { Mood } from "@/lib/api/mood";
import { baseMime } from "@/lib/audio-ref/mime";
import { putWithRetry } from "@/lib/audio-ref/upload";
import { tokensLabel } from "@/lib/shared/text-price";
import { freeCovers, tokenFor, voicePriceMilli } from "./logic";
import type { Draft } from "./draft";

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
  | { ok: true; answerId: string; questionId: string }
  | { ok: false; reason: "busy" | "offline" | "needs_tokens" | "failed"; message?: string };

async function waitReady(clipId: string): Promise<void> {
  for (let i = 0; i < 90; i++) {
    const c = await api.getVoiceClip(clipId);
    if (c.status === "READY") return;
    if (c.status === "FAILED" || c.status === "REMOVED") throw new Error("CLIP_FAILED");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("CLIP_SLOW");
}

/** Sends one kept recording as a voice answer: create the clip, upload, complete, wait until READY, post with the recording's own key. */
export async function sendKeptRecording(d: Draft, tokenId?: string): Promise<SendResult> {
  if (!claimSend(d.key)) return { ok: false, reason: "busy" };
  let clipId: string | undefined;
  let uploaded = false;
  try {
    const up = await api.createVoiceClip({
      mime: baseMime(d.mime) as "audio/webm" | "audio/mp4" | "audio/ogg",
      sizeBytes: d.blob.size,
      durationMs: Math.round(d.seconds * 1000),
      extraVoiceTokenId: tokenId,
    });
    clipId = up.clip.id;
    await putWithRetry({ url: up.putUrl, key: "", headers: {} }, d.blob, () => undefined);
    uploaded = true;
    await api.completeVoiceClip(clipId);
    await waitReady(clipId);
    const r = await api.createVoiceAnswer(d.questionId, clipId, d.key, tokenId, (d.mood as Mood | null | undefined) ?? null, !!d.anonymous);
    return { ok: true, answerId: r.answer.id, questionId: d.questionId };
  } catch (e) {
    if (clipId && !uploaded) void api.deleteVoiceClip(clipId).catch(() => undefined);
    if (e instanceof ApiError && e.status === 402) return { ok: false, reason: "needs_tokens", message: e.explained && e.message.trim() ? e.message : undefined };
    // The upload goes straight to storage, so being offline there is a plain network error, not an ApiError.
    if ((e instanceof ApiError && e.status === 0) || (typeof navigator !== "undefined" && navigator.onLine === false)) return { ok: false, reason: "offline" };
    return { ok: false, reason: "failed", message: e instanceof ApiError && e.explained && e.message.trim() ? e.message : undefined };
  } finally {
    releaseSend(d.key);
  }
}
