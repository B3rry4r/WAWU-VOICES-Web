import type { ExtraVoiceToken } from "@/lib/api/speak";
import { ApiError } from "@/lib/api/client";
import { voiceCostMilli, voiceFreeCovers } from "@/lib/shared/text-price";

/** lead ruling LF, 9 Nov: the price on the Send button is the shared function the server charges with, on the recording length in ms. */
export function voicePriceMilli(seconds: number, c: { extraVoice30Kobo: number; extraVoice60Kobo: number; voiceTier1Seconds?: number }): number {
  return voiceCostMilli(Math.round(seconds * 1000), c.extraVoice30Kobo * 10, c.extraVoice60Kobo * 10, c.voiceTier1Seconds ?? 30);
}

/** Does a free post cover this recording? The same grace as the server. */
export function freeCovers(seconds: number, freeSeconds: number): boolean {
  return voiceFreeCovers(Math.round(seconds * 1000), freeSeconds);
}

/** The bars drawn for a take: the loudest level in each slice of what the microphone really heard, scaled 0..255. */
export function peaksFromLevels(levels: number[], bars = 48): number[] {
  if (levels.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    let m = 0;
    for (let j = from; j < to && j < levels.length; j++) m = Math.max(m, levels[j]);
    out.push(m);
  }
  const top = Math.max(...out, 0.0001);
  return out.map((v) => Math.round(Math.min(1, v / top) * 255));
}

/** The smallest available token that covers this take, or undefined when the free seconds are enough. */
export function tokenFor(tokens: ExtraVoiceToken[], seconds: number, freeSeconds: number): ExtraVoiceToken | undefined {
  if (seconds <= freeSeconds + 0.5) return undefined; // the server allows half a second over
  return tokens
    .filter((t) => t.status === "AVAILABLE" && t.maxSeconds + 0.5 >= seconds)
    .sort((a, b) => a.maxSeconds - b.maxSeconds)[0];
}

export function durationLabel(seconds: number): string {
  if (seconds === 60) return "1 minute";
  return seconds + " seconds";
}

/** The words shown for a failed call. The server's own words are shown whenever it explained itself. */
export function refusalText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again in a moment.";
  if (e.status === 0) return "You are offline. Your recording is kept. Check your connection and try again.";
  if (e.explained && e.message.trim()) return e.message;
  return "Something went wrong on our side. Try again in a moment.";
}

export function uuidKey(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
