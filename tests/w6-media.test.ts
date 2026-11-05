// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadAvatar } from "@/features/profile/EditProfilePage";
import { uploadVoiceCard } from "@/features/profile/voiceCardUpload";
import { VoiceRecorder, pickMime, putBytes } from "@/features/profile/voiceCardRecorder";
import { calls, mockApi, signIn } from "./w6-helpers";

/** XMLHttpRequest stand-in: records PUTs and answers with `status`. */
const puts: { url: string; headers: Record<string, string>; size: number }[] = [];
let putStatus = 200;
class FakeXhr {
  status = 0; onload: (() => void) | null = null; onerror: (() => void) | null = null; private h: Record<string, string> = {}; private url = "";
  open(_m: string, url: string) { this.url = url; }
  setRequestHeader(k: string, v: string) { this.h[k] = v; }
  send(b: Blob) { puts.push({ url: this.url, headers: this.h, size: b.size }); this.status = putStatus; queueMicrotask(() => this.onload?.()); }
}

beforeEach(() => { window.localStorage.clear(); signIn(); puts.length = 0; putStatus = 200; vi.stubGlobal("XMLHttpRequest", FakeXhr); });
afterEach(() => vi.unstubAllGlobals());

describe("photo and voice uploads", () => {
  it("avatar: presign, PUT the bytes with the signed headers, return the file id", async () => {
    mockApi({ "POST /uploads": { fileId: "f1", putUrl: "https://spaces.example/f1", putHeaders: { "Content-Type": "image/png", "Content-Length": "3" }, expiresAt: "x" } });
    const id = await uploadAvatar(new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    expect(id).toBe("f1");
    expect(calls[0].body).toEqual({ kind: "AVATAR", mime: "image/png", sizeBytes: 3 });
    expect(puts[0].url).toBe("https://spaces.example/f1");
    expect(puts[0].headers["Content-Type"]).toBe("image/png");
    expect(puts[0].headers["Content-Length"]).toBeUndefined(); // the browser sets it
  });
  it("a PUT the storage refuses is retried, then fails", async () => {
    putStatus = 403;
    await expect(putBytes("https://s/x", {}, new Blob(["a"]), 2)).rejects.toThrow("put 403");
    expect(puts.length).toBe(2);
  });
  it("voice card: VOICE_CARD clip, PUT, complete, then waits for READY", async () => {
    let polls = 0;
    mockApi({
      "POST /voice-clips": { clip: { id: "c1", status: "PENDING_UPLOAD" }, putUrl: "https://spaces.example/c1", putHeaders: { "Content-Type": "audio/webm" }, expiresAt: "x" },
      "POST /voice-clips/c1/complete": { id: "c1", status: "PROCESSING", durationMs: 8000, maxDurationMs: 10000, peaks: null },
      "GET /voice-clips/c1": () => ({ id: "c1", status: ++polls < 2 ? "PROCESSING" : "READY", durationMs: 8000, maxDurationMs: 10000, peaks: [1] }),
    });
    const clip = await uploadVoiceCard({ blob: new Blob(["abc"], { type: "audio/webm;codecs=opus" }), mime: "audio/webm;codecs=opus", seconds: 8 }, { pollMs: 1 });
    expect(clip.status).toBe("READY");
    expect(calls[0].body).toEqual({ purpose: "VOICE_CARD", mime: "audio/webm", sizeBytes: 3, durationMs: 8000 });
    expect(puts[0].headers["Content-Type"]).toBe("audio/webm");
  });
  it("voice card that never becomes READY is an error, not a silent success", async () => {
    mockApi({
      "POST /voice-clips": { clip: { id: "c2", status: "PENDING_UPLOAD" }, putUrl: "https://s/c2", putHeaders: {}, expiresAt: "x" },
      "POST /voice-clips/c2/complete": { id: "c2", status: "FAILED", durationMs: null, maxDurationMs: 10000, peaks: null },
    });
    await expect(uploadVoiceCard({ blob: new Blob(["a"], { type: "audio/webm" }), mime: "audio/webm", seconds: 1 }, { pollMs: 1 })).rejects.toThrow("not ready");
  });
});

describe("recorder in a browser (MediaRecorder and getUserMedia faked, as on a phone)", () => {
  class FakeRec {
    static isTypeSupported(m: string) { return m === "audio/mp4"; } // Safari and iOS
    state = "inactive"; ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
    constructor(public stream: unknown, public opts: { mimeType: string }) {}
    start() { this.state = "recording"; this.ondataavailable?.({ data: new Blob(["x"]) }); }
    stop() { this.state = "inactive"; this.onstop?.(); }
  }
  it("picks the mime the browser can make (Safari: mp4)", () => {
    expect(pickMime(FakeRec)).toBe("audio/mp4");
    expect(pickMime({ isTypeSupported: () => false })).toBeUndefined();
  });
  it("refused microphone and no microphone are named, and nothing is left running", async () => {
    vi.stubGlobal("MediaRecorder", FakeRec);
    const denied = new VoiceRecorder({ maxSeconds: 10, mediaDevices: { getUserMedia: async () => { throw new DOMException("no", "NotAllowedError"); } } });
    expect(await denied.start()).toBe("permission_denied");
    const none = new VoiceRecorder({ maxSeconds: 10, mediaDevices: { getUserMedia: async () => { throw new DOMException("no", "NotFoundError"); } } });
    expect(await none.start()).toBe("no_microphone");
    vi.unstubAllGlobals();
    expect(await new VoiceRecorder({ maxSeconds: 10 }).start()).toBe("unsupported");
  });
  it("stops at the limit and releases the microphone", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearInterval", "clearTimeout", "performance", "Date"] });
    vi.stubGlobal("MediaRecorder", FakeRec);
    const track = { stop: vi.fn() };
    const r = new VoiceRecorder({ maxSeconds: 2, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) as unknown as MediaStream } });
    expect(await r.start()).toBeNull();
    const done = r.result();
    await vi.advanceTimersByTimeAsync(2300);
    const out = await done;
    expect(out.mime).toBe("audio/mp4");
    expect(out.seconds).toBeLessThanOrEqual(2);
    expect(track.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
