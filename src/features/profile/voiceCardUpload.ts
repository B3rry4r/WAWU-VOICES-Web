import { VoiceRecorder, baseMime, putBytes } from "./voiceCardRecorder";
import { completeVoiceClip, createVoiceClip, getVoiceClip, type VoiceClip } from "@/lib/api/profile";

export const VOICE_CARD_SECONDS = 10;

/** Send a finished recording as a VOICE_CARD clip: presign, PUT to Spaces, complete, then wait until it is READY. */
export async function uploadVoiceCard(
  rec: { blob: Blob; mime: string; seconds: number },
  opts: { pollMs?: number; maxPolls?: number } = {},
): Promise<VoiceClip> {
  const mime = baseMime(rec.mime) as "audio/webm" | "audio/mp4" | "audio/ogg" | "audio/mpeg" | "audio/aac";
  const up = await createVoiceClip({ purpose: "VOICE_CARD", mime, sizeBytes: rec.blob.size, durationMs: Math.max(1, Math.round(rec.seconds * 1000)) });
  await putBytes(up.putUrl, (up.putHeaders ?? {}) as Record<string, string>, rec.blob);
  let clip = await completeVoiceClip(up.clip.id);
  const every = opts.pollMs ?? 1000;
  for (let i = 0; i < (opts.maxPolls ?? 30) && clip.status !== "READY"; i++) {
    if (clip.status === "FAILED" || clip.status === "REMOVED") break;
    await new Promise((r) => setTimeout(r, every));
    clip = await getVoiceClip(up.clip.id);
  }
  if (clip.status !== "READY") throw new Error("not ready");
  return clip;
}

export { VoiceRecorder };
