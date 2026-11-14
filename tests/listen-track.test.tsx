// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** LISTEN-1 (LS7 follow-up): every player of an ANSWER's clip reports; a player of anything else never does. */
const starts: string[] = [];
const reports: { aid: string; body: { secondsPlayed: number; finished: boolean }; leaving?: boolean }[] = [];
class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 10;
  paused = true;
  playbackRate = 1;
  src = "";
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); } }
  setAttribute() { /* player flags */ }
  oncontextmenu: unknown = null;
  onended: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onplay: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  preload = "";
}
let audio: FakeAudio;
vi.mock("@/lib/api/talk", () => ({
  countListen: (aid: string) => { starts.push(aid); return Promise.resolve(); },
  reportListen: (aid: string, body: { secondsPlayed: number; finished: boolean }, leaving = false) => { reports.push({ aid, body, leaving }); return Promise.resolve(); },
}));
vi.mock("@/features/profile/playback", () => ({
  makePlayer: () => { audio = new FakeAudio(); return audio; },
  playWithResign: (a: FakeAudio) => a.play(),
  claimPlayback: () => undefined,
  releasePlayback: () => undefined,
  stopPlayback: () => undefined,
}));

async function press(label: RegExp) {
  await userEvent.click(await screen.findByRole("button", { name: label }));
}

describe("LivePlayer listen tracking", () => {
  beforeEach(() => { starts.length = 0; reports.length = 0; });
  afterEach(() => cleanup());

  it("an answer's clip counts a start and reports on pause and end", async () => {
    const { LivePlayer } = await import("@/features/profile/ClipPlayer");
    render(<LivePlayer answerId="ans-1" clipId="clip-1" durationMs={10000} peaks={null} getUrl={async () => "https://x/a.m4a"} failMessage="no" />);
    await press(/play voice/i);
    await waitFor(() => expect(starts).toEqual(["ans-1"]));
    audio.currentTime = 6;
    act(() => audio.pause());
    expect(reports).toEqual([{ aid: "ans-1", body: { secondsPlayed: 6, finished: false }, leaving: false }]);
  });

  it("a clip that is not an answer's (a Voice Card) never reports", async () => {
    const { LivePlayer } = await import("@/features/profile/ClipPlayer");
    render(<LivePlayer clipId="clip-2" durationMs={10000} peaks={null} getUrl={async () => "https://x/b.m4a"} failMessage="no" />);
    await press(/play voice/i);
    await waitFor(() => expect(audio).toBeDefined());
    audio.currentTime = 8;
    act(() => audio.pause());
    expect(starts).toEqual([]);
    expect(reports).toEqual([]);
  });
});
