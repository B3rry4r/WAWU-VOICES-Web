// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceRecorder } from "@/lib/audio-ref/recorder";
import { currentOwner, clearDraft, loadDraft, saveDraft } from "@/features/speak/draft";

/** A fake microphone world: counts prompts, recorders and contexts, and which tracks are still live. */
function world() {
  const w = { gum: 0, recs: 0, ctxs: 0, tracks: [] as { readyState: string; stop: () => void }[], ctxClosed: 0, resumeBeforeGum: false };
  class FakeMR {
    static isTypeSupported = () => true;
    state = "inactive";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor() { w.recs++; }
    start() { this.state = "recording"; this.ondataavailable?.({ data: new Blob(["x"]) }); }
    stop() { this.state = "inactive"; this.onstop?.(); }
  }
  class FakeAC {
    state = "suspended";
    constructor() { w.ctxs++; }
    resume() { this.state = "running"; w.resumeBeforeGum = w.gum === 0; return Promise.resolve(); }
    close() { this.state = "closed"; w.ctxClosed++; return Promise.resolve(); }
    createAnalyser() { return { fftSize: 0, getByteTimeDomainData: (b: Uint8Array) => b.fill(128) }; }
    createMediaStreamSource() { return { connect: () => undefined }; }
  }
  const gum = () => new Promise<MediaStream>((res) => {
    w.gum++;
    setTimeout(() => {
      const t = { readyState: "live", stop() { this.readyState = "ended"; } };
      w.tracks.push(t);
      res({ getTracks: () => [t] } as unknown as MediaStream);
    }, 20);
  });
  vi.stubGlobal("MediaRecorder", FakeMR);
  vi.stubGlobal("AudioContext", FakeAC);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAC;
  return { w, gum };
}

describe("VoiceRecorder", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearInterval", "clearTimeout"] }); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("a double tap makes one prompt, one recorder, one context, and no live track after stop", async () => {
    const { w, gum } = world();
    const r = new VoiceRecorder({ maxSeconds: 10, mediaDevices: { getUserMedia: gum } });
    const a = r.start();
    const b = r.start();
    await vi.advanceTimersByTimeAsync(50);
    expect(await a).toBeNull();
    expect(await b).toBeNull();
    expect(w.gum).toBe(1);
    expect(w.recs).toBe(1);
    expect(w.ctxs).toBe(1);
    expect(await r.start()).toBeNull(); // a third tap while recording does nothing too
    expect(w.gum).toBe(1);
    const res = r.result();
    r.stop();
    await res;
    expect(w.tracks.filter((t) => t.readyState === "live")).toHaveLength(0);
    expect(w.ctxClosed).toBe(1);
  });

  it("makes the audio context before the microphone prompt and resumes it", async () => {
    const { w, gum } = world();
    const r = new VoiceRecorder({ maxSeconds: 10, mediaDevices: { getUserMedia: gum } });
    const p = r.start();
    expect(w.ctxs).toBe(1); // synchronously, before any await
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(w.resumeBeforeGum).toBe(true);
    r.cancel();
  });

  it("closes the context and leaves no track when the permission is denied", async () => {
    const { w } = world();
    const r = new VoiceRecorder({ maxSeconds: 10, mediaDevices: { getUserMedia: () => Promise.reject(new DOMException("no", "NotAllowedError")) } });
    expect(await r.start()).toBe("permission_denied");
    expect(w.ctxClosed).toBe(1);
  });

  it("stops by the real clock and reports a take longer than the limit as over it", async () => {
    const { gum } = world();
    const r = new VoiceRecorder({ maxSeconds: 2, mediaDevices: { getUserMedia: gum } });
    const p = r.start();
    await vi.advanceTimersByTimeAsync(50);
    await p;
    const res = r.result();
    // the page was throttled: the clock moved on while no timer ran
    const real = performance.now;
    vi.spyOn(performance, "now").mockImplementation(() => real.call(performance) + 5000);
    await vi.advanceTimersByTimeAsync(300);
    const out = await res;
    expect(out.stoppedBy).toBe("limit");
    expect(out.realSeconds).toBeGreaterThan(2.5);
    expect(out.overLimit).toBe(true);
    expect(out.seconds).toBe(2);
  });
});

describe("draft ownership", () => {
  const tokenFor = (sub: string) => "x." + btoa(JSON.stringify({ sub })).replace(/=+$/, "") + ".y";
  const as = (sub: string | null) => { window.localStorage.clear(); if (sub) window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: tokenFor(sub), refreshToken: "r" })); };
  const d = { questionId: "q", blob: new Blob(["a"]), mime: "audio/webm", seconds: 3, peaks: [1], key: "k", savedAt: 1 };
  beforeEach(async () => { as(null); await clearDraft(currentOwner()); });
  afterEach(() => { window.localStorage.clear(); });

  it("reads the owner from the token", () => { as("u-1"); expect(currentOwner()).toBe("u-1"); as(null); expect(currentOwner()).toBeNull(); });
  it("a guest's recording goes to the first person who signs in, once", async () => {
    await saveDraft(currentOwner(), d);
    as("u-1");
    expect((await loadDraft(currentOwner()))?.owner).toBe("u-1");
    as("u-2");
    expect(await loadDraft(currentOwner())).toBeNull();
    expect(await loadDraft(currentOwner())).toBeNull();
  });
  it("another account never sees a signed-in person's recording, and it is kept for the person who made it (round 7 ruling)", async () => {
    as("u-1");
    await saveDraft(currentOwner(), d);
    as("u-2");
    expect(await loadDraft(currentOwner())).toBeNull();
    as("u-1");
    expect((await loadDraft(currentOwner()))?.owner).toBe("u-1");
  });
  it("a guest does not see a signed-in person's recording", async () => {
    as("u-1");
    await saveDraft(currentOwner(), d);
    as(null);
    expect(await loadDraft(currentOwner())).toBeNull();
    as("u-1");
    expect((await loadDraft(currentOwner()))?.owner).toBe("u-1");
  });
  it("sign-out clears it", async () => {
    as("u-1");
    await saveDraft(currentOwner(), d);
    const { signOut } = await import("@/lib/api/auth");
    signOut();
    await new Promise((r) => setTimeout(r, 20));
    as("u-1");
    expect(await loadDraft(currentOwner())).toBeNull();
  });
});
