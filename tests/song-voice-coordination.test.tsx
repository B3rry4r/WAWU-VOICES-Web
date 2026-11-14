// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

type Fake = { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; src: string; paused: boolean };
let made: Fake[] = [];
let refuseUntil = "";

vi.mock("@/lib/auth/session-storage", () => ({ sessionStorage: { getToken: () => null } }));

beforeEach(() => {
  made = [];
  refuseUntil = "";
  vi.resetModules();
  window.sessionStorage.clear();
  window.localStorage.clear();
  class FakeAudio {
    listeners: Record<string, (() => void)[]> = {};
    loop = false; preload = ""; src: string; paused = true;
    constructor(src?: string) { this.src = src ?? ""; made.push(this as unknown as Fake); }
    addEventListener(n: string, f: () => void) { (this.listeners[n] ||= []).push(f); }
    setAttribute() {}
    fire(n: string) { (this.listeners[n] || []).forEach((f) => f()); }
    play = vi.fn(async () => {
      if (refuseUntil && !(window as unknown as { __gesture?: string }).__gesture?.includes(refuseUntil)) throw new DOMException("no gesture", "NotAllowedError");
      this.paused = false; this.fire("playing");
    });
    pause = vi.fn(() => { this.paused = true; this.fire("pause"); });
  }
  vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function page() {
  const { SoundButton } = await import("@/components/shell/SoundButton");
  render(<div><p data-testid="neutral">hello</p><SoundButton /></div>);
}
const settle = () => act(async () => { await Promise.resolve(); });
const song = () => made.find((a) => a.src === "/voices-theme.mp3") as Fake;

describe("first tap on a phone (touch gives activation on pointerup, touchend and click)", () => {
  // A phone tap fires pointerdown, touchstart, pointerup, touchend, click in that order; the browser refuses play() until the later ones.
  it.each(["pointerup", "touchend", "click"])("starts on %s when the earlier events were refused, once, and never blocks the tap", async (ok) => {
    refuseUntil = ok;
    await page();
    const w = window as unknown as { __gesture?: string };
    const target = screen.getByTestId("neutral");
    const order = ["pointerdown", "touchstart", "pointerup", "touchend", "click"];
    const evs: Event[] = [];
    for (const n of order) {
      w.__gesture = n;
      const ev = new Event(n, { bubbles: true, cancelable: true });
      evs.push(ev);
      await act(async () => { target.dispatchEvent(ev); });
      await settle();
    }
    expect(evs.every((e) => !e.defaultPrevented)).toBe(true);
    expect(song().play.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(song().paused).toBe(false);
    expect(screen.getByRole("button", { name: "Stop the VOICES song" }).getAttribute("aria-pressed")).toBe("true");
    const calls = song().play.mock.calls.length;
    await act(async () => { fireEvent.click(target); fireEvent.pointerUp(target); });
    expect(song().play.mock.calls.length).toBe(calls);
  });

  it("a first touch on a voice player or the recorder still does not start it, on any of the events", async () => {
    await page();
    const v = document.createElement("div"); v.className = "vx-player"; document.body.appendChild(v);
    await act(async () => { v.dispatchEvent(new Event("touchstart", { bubbles: true })); });
    for (const n of ["pointerup", "touchend", "click"]) await act(async () => { v.dispatchEvent(new Event(n, { bubbles: true })); });
    await act(async () => { fireEvent.click(screen.getByTestId("neutral")); });
    await settle();
    expect(made.length).toBe(0);
    v.remove();
  });
});

describe("the song steps aside for a voice", () => {
  async function started() {
    await page();
    await act(async () => { fireEvent.click(screen.getByTestId("neutral")); });
    await settle();
    expect(song().paused).toBe(false);
  }

  it("a voice played through playWithResign pauses the song, keeps the off choice unwritten, and does not resume", async () => {
    await started();
    const { makePlayer, playWithResign } = await import("@/lib/audio-ref/player");
    const a = makePlayer("https://x/voice.m4a");
    await act(async () => { await playWithResign(a, async () => "https://x/v2.m4a"); });
    expect(song().paused).toBe(true);
    expect(window.localStorage.getItem("voices.song.off")).toBeNull();
    expect(screen.getByRole("button", { name: "Play the VOICES song" }).getAttribute("aria-pressed")).toBe("false");
    a.pause();
    await settle();
    expect(song().paused).toBe(true);
    // the speaker brings it back
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play the VOICES song" })); });
    expect(song().paused).toBe(false);
  });

  it("the profile playback helper pauses the song too", async () => {
    await started();
    const { makePlayer, playWithResign } = await import("@/features/profile/playback");
    await act(async () => { await playWithResign(makePlayer("https://x/v.m4a"), async () => "u"); });
    expect(song().paused).toBe(true);
    expect(window.localStorage.getItem("voices.song.off")).toBeNull();
  });

  it("the conversation VoicePlayer pauses the song when it plays", async () => {
    await started();
    const { VoicePlayer } = await import("@/components/vx/conversation");
    render(<VoicePlayer src="https://x/a.m4a" duration={9} seed={1} />);
    await act(async () => { fireEvent.click(document.querySelector(".vx-player button") as HTMLElement); });
    await settle();
    expect(song().paused).toBe(true);
    expect(window.localStorage.getItem("voices.song.off")).toBeNull();
  });

  it("starting a recording pauses the song (both recorders), before the microphone is asked", async () => {
    for (const mod of ["@/lib/audio-ref/recorder", "@/features/profile/voiceCardRecorder"]) {
      cleanup(); made = []; vi.resetModules();
      await started();
      const { VoiceRecorder } = await import(/* @vite-ignore */ mod);
      const gum = vi.fn(async () => { expect(song().paused).toBe(true); throw new DOMException("no", "NotAllowedError"); });
      vi.stubGlobal("MediaRecorder", class { static isTypeSupported() { return true; } });
      await new VoiceRecorder({ maxSeconds: 10, mediaDevices: { getUserMedia: gum } }).start();
      expect(gum).toHaveBeenCalled();
      expect(song().paused).toBe(true);
      expect(window.localStorage.getItem("voices.song.off")).toBeNull();
    }
  });
});
