// Reference only, not wired. Pick the MediaRecorder mime the browser can actually produce.
// Chrome, Edge, Firefox, Android: audio/webm;codecs=opus (Firefox may offer ogg). iOS Safari and macOS Safari: audio/mp4 (AAC).
// Order matters: webm/opus first (every non-Safari browser), then mp4/AAC (Safari, iOS). The server re-encodes both.
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

export function pickMime(rec: { isTypeSupported(m: string): boolean } | undefined = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined): string | undefined {
  if (!rec) return undefined;
  return CANDIDATES.find((m) => rec.isTypeSupported(m));
}

/** Strip the codec parameter for Content-Type headers and the upload request. */
export function baseMime(m: string): string {
  return m.split(';')[0];
}

export function extFor(m: string): string {
  const b = baseMime(m);
  return b === 'audio/mp4' ? 'm4a' : b === 'audio/ogg' ? 'ogg' : 'webm';
}
