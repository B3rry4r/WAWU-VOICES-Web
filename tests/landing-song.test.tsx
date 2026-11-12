// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LANDING_HEADLINE, LANDING_HEADLINE_EN, LANDING_HEADLINE_YO } from "@/features/entry/landing-words";

type Fake = { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; loop: boolean; preload: string; src: string; fire: (n: string) => void };
let made: Fake[] = [];
let refuse = false;

beforeEach(() => {
  made = [];
  refuse = false;
  vi.resetModules();
  window.sessionStorage.clear();
  class FakeAudio {
    listeners: Record<string, (() => void)[]> = {};
    loop = false; preload = ""; src: string;
    constructor(src: string) { this.src = src; made.push(this as unknown as Fake); }
    addEventListener(n: string, f: () => void) { (this.listeners[n] ||= []).push(f); }
    fire(n: string) { (this.listeners[n] || []).forEach((f) => f()); }
    play = vi.fn(async () => { if (refuse) { this.fire("error"); throw new Error("no"); } this.fire("playing"); });
    pause = vi.fn(() => this.fire("pause"));
  }
  vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("V-43 headline", () => {
  it("is the Yoruba line then Let’s talk., marks intact", () => {
    expect(LANDING_HEADLINE_YO.normalize("NFD")).toBe("E\u0323 je\u0323\u0301 ka\u0301 so\u0323\u0300ro\u0323\u0300!");
    expect(LANDING_HEADLINE_YO).toContain("Ẹ");
    expect(LANDING_HEADLINE_EN).toBe("Let’s talk.");
    expect(LANDING_HEADLINE).toBe(`${LANDING_HEADLINE_YO} ${LANDING_HEADLINE_EN}`);
    expect(LANDING_HEADLINE).not.toMatch(/—/);
  });
});

describe("V-43 theme song", () => {
  it("makes no audio element and plays nothing until a tap, then stops on the second tap", async () => {
    const { SoundButton } = await import("@/components/shell/SoundButton");
    render(<SoundButton />);
    expect(made.length).toBe(0);
    const btn = screen.getByRole("button", { name: "Play the VOICES song" });
    await act(async () => { fireEvent.click(btn); });
    expect(made.length).toBe(1);
    expect(made[0].src).toBe("/voices-theme.mp3");
    expect(made[0].loop).toBe(true);
    expect(made[0].play).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("voices.song")).toBe("on");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop the VOICES song" })); });
    expect(made[0].pause).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("voices.song")).toBe("off");
    expect(screen.getByRole("button", { name: "Play the VOICES song" })).toBeTruthy();
  });

  it("says so in plain words when the song cannot load", async () => {
    refuse = true;
    const { SoundButton } = await import("@/components/shell/SoundButton");
    render(<SoundButton />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play the VOICES song" })); });
    expect((await screen.findByRole("alert")).textContent).toBe("The song could not be played. Check your connection and try again.");
    expect(screen.getByRole("button", { name: "Play the VOICES song" })).toBeTruthy();
  });

  it("one song for every control: a second button shows the same state", async () => {
    const { SoundButton } = await import("@/components/shell/SoundButton");
    render(<><SoundButton /><SoundButton /></>);
    await act(async () => { fireEvent.click(screen.getAllByRole("button")[0]); });
    expect(screen.getAllByRole("button", { name: "Stop the VOICES song" }).length).toBe(2);
    expect(made.length).toBe(1);
  });
});
