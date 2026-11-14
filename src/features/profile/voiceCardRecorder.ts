/*
 * Browser recording and upload for the Voice Card. Local to this area because web/src/lib/audio-ref is a reference copy
 * (its relative ".js" imports do not build under webpack; W4 wires the shared one and should replace this file).
 */
import { pauseSongForVoice } from "@/lib/theme-song";
const CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

export const baseMime = (m: string) => m.split(";")[0];

export function pickMime(rec: { isTypeSupported(m: string): boolean } | undefined = typeof MediaRecorder !== "undefined" ? MediaRecorder : undefined): string | undefined {
  return rec ? CANDIDATES.find((m) => rec.isTypeSupported(m)) : undefined;
}

export type RecorderError = "unsupported" | "permission_denied" | "no_microphone" | "failed";
export interface RecordingResult { blob: Blob; mime: string; seconds: number }

export class VoiceRecorder {
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private started = 0;
  private done?: (r: RecordingResult) => void;
  constructor(private opts: { maxSeconds: number; onTick?: (secondsLeft: number) => void; mediaDevices?: Pick<MediaDevices, "getUserMedia"> }) {}

  /** Asks for the microphone. Call it from a tap: iOS needs a user gesture. */
  async start(): Promise<RecorderError | null> {
    pauseSongForVoice();
    const mime = pickMime();
    if (!mime) return "unsupported";
    try {
      this.stream = await (this.opts.mediaDevices ?? navigator.mediaDevices).getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e) {
      const n = (e as DOMException).name;
      return n === "NotAllowedError" || n === "SecurityError" ? "permission_denied" : n === "NotFoundError" ? "no_microphone" : "failed";
    }
    this.rec = new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => this.finish(mime);
    this.rec.start(250);
    this.started = performance.now();
    this.timer = setInterval(() => {
      const elapsed = (performance.now() - this.started) / 1000;
      this.opts.onTick?.(Math.max(0, this.opts.maxSeconds - elapsed));
      if (elapsed >= this.opts.maxSeconds) this.stop();
    }, 100);
    return null;
  }

  result(): Promise<RecordingResult> { return new Promise((res) => { this.done = res; }); }
  stop() { if (this.rec && this.rec.state !== "inactive") this.rec.stop(); }
  /** Leaving the screen: stop and throw away what was recorded. */
  cancel() { this.done = undefined; this.chunks = []; this.stop(); this.release(); }

  private release() { clearInterval(this.timer); this.stream?.getTracks().forEach((t) => t.stop()); }
  private finish(mime: string) {
    this.release();
    const seconds = Math.min(this.opts.maxSeconds, (performance.now() - this.started) / 1000);
    this.done?.({ blob: new Blob(this.chunks, { type: mime }), mime, seconds });
  }
}

/** PUT the bytes to a presigned URL with the headers the API signed. XHR, so a slow network can retry. */
export function putBytes(url: string, headers: Record<string, string>, blob: Blob, tries = 3): Promise<void> {
  const attempt = (n: number): Promise<void> => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== "content-length" && k.toLowerCase() !== "host") x.setRequestHeader(k, v);
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) x.setRequestHeader("Content-Type", baseMime(blob.type) || "application/octet-stream");
    const retry = (err: Error) => (n + 1 < tries ? setTimeout(() => attempt(n + 1).then(resolve, reject), 600 * 2 ** n) : reject(err));
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : retry(new Error("put " + x.status)));
    x.onerror = () => retry(new Error("network"));
    x.send(blob);
  });
  return attempt(0);
}
