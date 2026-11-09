// Reference only, not wired. Duration tiers (v4.0 sec 4.4, V-8).
export type VoiceTier = "free" | "voice30" | "voice60";

export const MAX_SECONDS: Record<VoiceTier, number> = {
  free: 10,
  voice30: 30,
  voice60: 60,
};

// Target: AAC-LC mono 32 kbps => about 4 KB per second. Ceiling per tier with 50% slack for
// container overhead and encoder variance, used to reject oversized uploads before ffmpeg runs.
export const BITRATE_BPS = 32_000;
export const RAW_MAX_BYTES: Record<VoiceTier, number> = {
  // the raw browser recording is bigger than the normalised file (MediaRecorder default is ~128 kbps)
  free: 400_000,
  voice30: 1_200_000,
  voice60: 2_400_000,
};

/** Seconds allowed, with 0.5 s grace for the recorder's stop latency. */
export function allowedSeconds(tier: VoiceTier): number {
  return MAX_SECONDS[tier];
}
export function withinLimit(tier: VoiceTier, durationSeconds: number): boolean {
  return durationSeconds > 0.3 && durationSeconds <= MAX_SECONDS[tier] + 0.5;
}
