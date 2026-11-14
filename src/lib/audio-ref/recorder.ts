import { pauseSongForVoice } from "@/lib/theme-song";
import { pickMime } from './mime';

export type RecorderError = 'unsupported' | 'permission_denied' | 'no_microphone' | 'failed';

/** `seconds` is clamped to maxSeconds; `realSeconds` is the real recorded length; `overLimit` is true when it ran past maxSeconds + 0.5 s. */
export interface RecordingResult { blob: Blob; mime: string; seconds: number; realSeconds: number; stoppedBy: 'user' | 'limit'; overLimit: boolean }

export interface RecorderOptions {
  maxSeconds: number;                    // 10 free, 30 or 60 with a Voice token
  onTick?: (secondsLeft: number, level: number) => void; // level 0..1 for the live meter
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
}

export class VoiceRecorder {
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private started = 0;
  private ctx?: AudioContext;
  private done?: (r: RecordingResult) => void;
  private pending?: RecordingResult;
  private stoppedBy: 'user' | 'limit' = 'user';
  private starting = false;
  constructor(private opts: RecorderOptions) {}

  /** Every stream track, the analyser context and the timer are released here, on every path. */
  private release() {
    clearInterval(this.timer);
    this.timer = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());   // releases the mic indicator immediately
    this.stream = undefined;
    const c = this.ctx;
    this.ctx = undefined;
    if (c && c.state !== 'closed') void c.close().catch(() => undefined);
  }

  private elapsed(): number { return (performance.now() - this.started) / 1000; }

  private checkLimit() {
    if (this.rec && this.rec.state !== 'inactive' && this.elapsed() >= this.opts.maxSeconds) { this.stoppedBy = 'limit'; this.stop(); }
  }

  /** Asks for the microphone. Must be called from a tap (iOS needs a user gesture). A second call while one is starting or recording does nothing. */
  async start(): Promise<RecorderError | null> {
    if (this.rec || this.starting) return null;
    pauseSongForVoice();
    this.starting = true;
    // Safari only lets a context run if it is made inside the tap, so it is made before any await.
    const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    try { this.ctx = AC ? new AC() : undefined; if (this.ctx) void this.ctx.resume().catch(() => undefined); } catch { this.ctx = undefined; }
    const fail = (e: RecorderError) => { this.release(); this.starting = false; return e; };
    const mime = pickMime();
    if (!mime) return fail('unsupported');
    try {
      this.stream = await (this.opts.mediaDevices ?? navigator.mediaDevices).getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e) {
      const n = (e as DOMException).name;
      return fail(n === 'NotAllowedError' || n === 'SecurityError' ? 'permission_denied' : n === 'NotFoundError' ? 'no_microphone' : 'failed');
    }
    try {
      if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
      // 32 kbps at the source keeps the raw upload small on slow networks; the server re-encodes anyway
      this.rec = new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      this.chunks = [];
      this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); this.checkLimit(); };
      this.rec.onstop = () => this.finish(mime);
      this.started = performance.now();
      this.rec.start(250);
      let an: AnalyserNode | undefined;
      let buf = new Uint8Array(0);
      if (this.ctx) {
        an = this.ctx.createAnalyser();
        an.fftSize = 256;
        this.ctx.createMediaStreamSource(this.stream).connect(an);
        buf = new Uint8Array(an.fftSize);
      }
      this.timer = setInterval(() => {
        let peak = 0;
        if (an) { an.getByteTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); }
        this.opts.onTick?.(Math.max(0, this.opts.maxSeconds - this.elapsed()), peak / 128);
        this.checkLimit();
      }, 100);
      // a second, independent stop in case the interval is throttled: the real clock decides
      setTimeout(() => this.checkLimit(), this.opts.maxSeconds * 1000);
    } catch {
      this.rec = undefined;
      return fail('failed');
    }
    this.starting = false;
    return null;
  }

  result(): Promise<RecordingResult> {
    if (this.pending) return Promise.resolve(this.pending);
    return new Promise((res) => (this.done = res));
  }

  stop() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
  }

  private finish(mime: string) {
    const seconds = this.elapsed();
    this.release();
    const r: RecordingResult = { blob: new Blob(this.chunks, { type: mime }), mime, seconds: Math.min(this.opts.maxSeconds, seconds), realSeconds: seconds, stoppedBy: this.stoppedBy, overLimit: seconds > this.opts.maxSeconds + 0.5 };
    this.rec = undefined;
    if (this.done) this.done(r); else this.pending = r;
  }

  /** Discard everything and release the microphone, whatever state the recorder is in. */
  cancel() {
    this.chunks = [];
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); else this.release();
  }
}
