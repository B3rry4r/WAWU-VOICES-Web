import { pickMime } from './mime';

export type RecorderError = 'unsupported' | 'permission_denied' | 'no_microphone' | 'failed';

export interface RecordingResult { blob: Blob; mime: string; seconds: number; stoppedBy: 'user' | 'limit' }

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
  private stoppedBy: 'user' | 'limit' = 'user';
  constructor(private opts: RecorderOptions) {}

  /** Asks for the microphone. Must be called from a tap (iOS needs a user gesture). */
  async start(): Promise<RecorderError | null> {
    const mime = pickMime();
    if (!mime) return 'unsupported';
    try {
      this.stream = await (this.opts.mediaDevices ?? navigator.mediaDevices).getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e) {
      const n = (e as DOMException).name;
      return n === 'NotAllowedError' || n === 'SecurityError' ? 'permission_denied' : n === 'NotFoundError' ? 'no_microphone' : 'failed';
    }
    // 32 kbps at the source keeps the raw upload small on slow networks; the server re-encodes anyway
    this.rec = new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => this.finish(mime);
    this.rec.start(250);
    this.started = performance.now();

    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const an = this.ctx.createAnalyser();
    an.fftSize = 256;
    this.ctx.createMediaStreamSource(this.stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    this.timer = setInterval(() => {
      const elapsed = (performance.now() - this.started) / 1000;
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      this.opts.onTick?.(Math.max(0, this.opts.maxSeconds - elapsed), peak / 128);
      if (elapsed >= this.opts.maxSeconds) { this.stoppedBy = 'limit'; this.stop(); }
    }, 100);
    return null;
  }

  result(): Promise<RecordingResult> { return new Promise((res) => (this.done = res)); }

  stop() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
  }

  private finish(mime: string) {
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());   // releases the mic indicator immediately
    void this.ctx?.close();
    const seconds = Math.min(this.opts.maxSeconds, (performance.now() - this.started) / 1000);
    this.done?.({ blob: new Blob(this.chunks, { type: mime }), mime, seconds, stoppedBy: this.stoppedBy });
  }

  /** Tab hidden or call comes in: iOS kills the mic, so stop and keep what was recorded. */
  cancel() { this.chunks = []; this.stop(); }
}
