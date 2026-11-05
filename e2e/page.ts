import { VoiceRecorder, pickMime, barHeights } from '../src/lib/audio-ref/index.js';
declare global { interface Window { run: (max: number, stopAfterMs: number | null) => Promise<unknown>; mime: string | undefined; deny: () => Promise<unknown> } }
window.mime = pickMime();
window.run = async (max, stopAfterMs) => {
  const ticks: number[] = [];
  const r = new VoiceRecorder({ maxSeconds: max, onTick: (left) => ticks.push(left) });
  const err = await r.start();
  if (err) return { err };
  const p = r.result();
  if (stopAfterMs !== null) setTimeout(() => r.stop(), stopAfterMs);
  const res = await p;
  const buf = new Uint8Array(await res.blob.arrayBuffer());
  let bin = ''; for (const b of buf) bin += String.fromCharCode(b);
  return { err: null, mime: res.mime, seconds: res.seconds, stoppedBy: res.stoppedBy, size: buf.length, b64: btoa(bin), ticks: ticks.length, firstTick: ticks[0], bars: barHeights([0, 128, 255]) };
};
window.deny = async () => new VoiceRecorder({ maxSeconds: 5, mediaDevices: { getUserMedia: () => Promise.reject(new DOMException('no', 'NotAllowedError')) } }).start();
