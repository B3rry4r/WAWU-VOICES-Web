// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

/** LISTEN-1 (LS2): the clip player reports on pause, on end and on leaving the page, and playback never waits for it. */
const reports: { aid: string; body: { secondsPlayed: number; finished: boolean }; leaving?: boolean }[] = [];
let reportImpl: () => Promise<unknown> = () => Promise.resolve();
class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 10;
  onended: (() => void) | null = null;
  paused = true;
  play() { this.paused = false; return Promise.resolve(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); } }
}
let audio: FakeAudio;
const starts: string[] = [];
vi.mock("@/lib/api/talk", () => ({
  countListen: (aid: string) => { starts.push(aid); return Promise.resolve(); },
  getPlayUrl: () => Promise.resolve({ url: "https://x/clip.m4a", expiresAt: new Date(Date.now() + 900_000).toISOString(), mime: "audio/mp4" }),
  reportListen: (aid: string, body: { secondsPlayed: number; finished: boolean }, leaving = false) => { reports.push({ aid, body, leaving }); return reportImpl(); },
}));
vi.mock("@/lib/audio-ref/player", () => ({
  makePlayer: () => { audio = new FakeAudio(); return audio; },
  playWithResign: (a: FakeAudio) => a.play(),
}));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => false }));

const AID = "0190a000-0000-7000-8000-000000000001";
async function setup(started = vi.fn()) {
  const { useClipPlayback } = await import("@/features/talk/lib");
  const hook = renderHook(() => useClipPlayback("clip-1", vi.fn(), started, AID));
  await act(async () => { await hook.result.current.toggle(true); });
  return hook;
}

describe("clip playback reports listen progress", () => {
  beforeEach(() => { reports.length = 0; starts.length = 0; reportImpl = () => Promise.resolve(); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetModules(); });

  it("a pause reports how far the person got", async () => {
    await setup();
    audio.currentTime = 4.4;
    act(() => audio.pause());
    expect(reports).toEqual([{ aid: AID, body: { secondsPlayed: 4, finished: false }, leaving: false }]);
  });

  it("the end reports finished", async () => {
    await setup();
    audio.currentTime = 10;
    act(() => { audio.pause(); audio.onended?.(); }); // a browser fires pause, then ended
    expect(reports).toEqual([{ aid: AID, body: { secondsPlayed: 10, finished: true }, leaving: false }]);
  });

  it("a pause inside the 10 s window is still sent at once, with the furthest point (lead ruling LS, 6 Nov)", async () => {
    await setup();
    audio.currentTime = 3;
    act(() => audio.pause());
    audio.paused = false;
    audio.currentTime = 6;
    act(() => audio.pause());
    expect(reports.map((r) => r.body.secondsPlayed)).toEqual([3, 6]);
  });

  it("pause, play to the end and leave at once: the last report says finished", async () => {
    const hook = await setup();
    audio.currentTime = 2;
    act(() => audio.pause());
    audio.paused = false;
    audio.currentTime = 10;
    act(() => { audio.pause(); audio.onended?.(); }); // the end of the clip
    hook.unmount(); // in-app navigation straight away
    expect(reports.at(-1)?.body).toEqual({ secondsPlayed: 10, finished: true });
    expect(reports.map((r) => r.body.secondsPlayed)).toEqual([2, 10]);
  });

  it("leaving the page or the player sends the held stretch with keepalive", async () => {
    const hook = await setup();
    audio.currentTime = 4;
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(reports.at(-1)).toMatchObject({ body: { secondsPlayed: 4, finished: false }, leaving: true });
    audio.currentTime = 6;
    hook.unmount();
    expect(reports.at(-1)).toMatchObject({ body: { secondsPlayed: 6, finished: false }, leaving: true });
  });

  it("leaving the page reports, and a seek back never lowers what was reached", async () => {
    await setup();
    audio.currentTime = 7;
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(reports.at(-1)?.body).toEqual({ secondsPlayed: 7, finished: false });
    vi.advanceTimersByTime(10_001);
    audio.currentTime = 1;
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(reports).toHaveLength(1);
  });

  it("playback never waits for a report: a hanging or failing request leaves play, pause and end working", async () => {
    reportImpl = () => new Promise(() => undefined);
    const started = vi.fn();
    const hook = await setup(started);
    expect(started).toHaveBeenCalledTimes(1); // the hook's own onStart
    expect(starts).toEqual([AID]); // and one counted start for the answer
    audio.currentTime = 5;
    act(() => audio.pause());
    reportImpl = () => Promise.reject(new Error("offline"));
    await act(async () => { await hook.result.current.toggle(true); }); // play again straight away
    expect(audio.paused).toBe(false);
    act(() => { audio.currentTime = 10; audio.onended?.(); });
    expect(hook.result.current.rev).toBeGreaterThan(0); // the button went back to its start state
  });
});
