import { putWithRetry } from "@/lib/audio-ref/upload";
import { baseMime } from "@/lib/audio-ref/mime";
import { completeClip, createDmClip, getClip, type VoiceClip } from "@/lib/api/dm";

/** Send a finished recording as a DM clip: presign, PUT to Spaces, complete, then wait until it is READY (the same steps as an answer's voice). */
export async function uploadDmVoice(
  rec: { blob: Blob; mime: string; seconds: number },
  opts: { pollMs?: number; maxPolls?: number; onProgress?: (frac: number) => void } = {},
): Promise<VoiceClip> {
  const mime = baseMime(rec.mime) as "audio/webm" | "audio/mp4" | "audio/ogg" | "audio/mpeg" | "audio/aac";
  const up = await createDmClip({ mime, sizeBytes: rec.blob.size, durationMs: Math.max(300, Math.round(rec.seconds * 1000)) });
  await putWithRetry({ url: up.putUrl, key: "", headers: {} }, rec.blob, opts.onProgress);
  let clip = await completeClip(up.clip.id);
  const every = opts.pollMs ?? 1000;
  for (let i = 0; i < (opts.maxPolls ?? 40) && clip.status !== "READY"; i++) {
    if (clip.status === "FAILED" || clip.status === "REMOVED") break;
    await new Promise((r) => setTimeout(r, every));
    clip = await getClip(up.clip.id);
  }
  if (clip.status !== "READY") throw new Error("not ready");
  return clip;
}
