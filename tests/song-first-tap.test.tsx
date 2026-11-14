// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

type Fake = { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; src: string };
let made: Fake[] = [];
let refuse = false;
let token: string | null = null;

vi.mock("@/lib/auth/session-storage", () => ({ sessionStorage: { getToken: () => token } }));

beforeEach(() => {
  made = [];
  refuse = false;
  token = null;
  vi.resetModules();
  window.sessionStorage.clear();
  window.localStorage.clear();
  class FakeAudio {
    listeners: Record<string, (() => void)[]> = {};
    loop = false; preload = ""; src: string;
    constructor(src: string) { this.src = src; made.push(this as unknown as Fake); }
    addEventListener(n: string, f: () => void) { (this.listeners[n] ||= []).push(f); }
    fire(n: string) { (this.listeners[n] || []).forEach((f) => f()); }
    play = vi.fn(async () => { if (refuse) throw new DOMException("no gesture", "NotAllowedError"); this.fire("playing"); });
    pause = vi.fn(() => this.fire("pause"));
  }
  vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function page(extra?: React.ReactNode) {
  const { SoundButton } = await import("@/components/shell/SoundButton");
  render(<div><p data-testid="neutral">hello</p>{extra}<SoundButton /></div>);
}
const settle = () => act(async () => { await Promise.resolve(); });

describe("V-SONG-FIRST-TAP", () => {
  it("makes no audio until the first interaction, then plays once and the button says playing", async () => {
    await page();
    expect(made.length).toBe(0);
    expect(screen.getByRole("button", { name: "Play the VOICES song" }).getAttribute("aria-pressed")).toBe("false");
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); });
    await settle();
    expect(made.length).toBe(1);
    expect(made[0].play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Stop the VOICES song" }).getAttribute("aria-pressed")).toBe("true");
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); fireEvent.keyDown(document.body, { key: "a" }); });
    expect(made[0].play).toHaveBeenCalledTimes(1);
  });

  it("starts on keydown and on touchstart too, and does not swallow the tap", async () => {
    const clicked = vi.fn();
    await page(<button type="button" onClick={clicked}>Other</button>);
    const ev = new Event("touchstart", { bubbles: true, cancelable: true });
    await act(async () => { screen.getByRole("button", { name: "Other" }).dispatchEvent(ev); });
    await settle();
    expect(ev.defaultPrevented).toBe(false);
    expect(made[0].play).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Other" })); });
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("starts on keydown", async () => {
    await page();
    await act(async () => { fireEvent.keyDown(document.body, { key: "Tab" }); });
    await settle();
    expect(made[0].play).toHaveBeenCalledTimes(1);
  });

  it("stays off after the visitor turned it off with the button, even after a reload", async () => {
    await page();
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); });
    await settle();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop the VOICES song" })); });
    expect(window.localStorage.getItem("voices.song.off")).toBe("1");
    expect(screen.getByRole("button", { name: "Play the VOICES song" }).getAttribute("aria-pressed")).toBe("false");
    // a reload: fresh module, fresh page, same browser storage
    cleanup(); made = []; vi.resetModules();
    await page();
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); fireEvent.keyDown(document.body, { key: "a" }); });
    await settle();
    expect(made.length).toBe(0);
    expect(screen.getByRole("button", { name: "Play the VOICES song" })).toBeTruthy();
    // the button still turns it on, and that forgets the off choice
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Play the VOICES song" })); });
    expect(made[0].play).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("voices.song.off")).toBeNull();
  });

  it("works when storage throws", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    await page();
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); });
    await settle();
    expect(made[0].play).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it.each([
    ["a voice play button", <div key="a" className="vx-player"><button type="button" className="vx-player__play">p</button></div>],
    ["the record button", <div key="b" className="vx-rec"><button type="button" className="vx-rec__btn">r</button></div>],
  ])("does not start when the first tap is %s, and a later tap does not either", async (_n, el) => {
    await page(el);
    const b = document.querySelector("button.vx-player__play, button.vx-rec__btn") as HTMLElement;
    await act(async () => { fireEvent.pointerDown(b); });
    await settle();
    expect(made.length).toBe(0);
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); });
    await settle();
    expect(made.length).toBe(0);
  });

  it("does not start when the first tap is the speaker button itself (its click decides)", async () => {
    await page();
    const btn = screen.getByRole("button", { name: "Play the VOICES song" });
    await act(async () => { fireEvent.pointerDown(btn); fireEvent.click(btn); });
    await settle();
    expect(made[0].play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Stop the VOICES song" })).toBeTruthy();
  });

  it("never starts by itself for a signed-in person", async () => {
    token = "t";
    await page();
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); });
    await settle();
    expect(made.length).toBe(0);
  });

  it("when the browser refuses the gesture it says nothing, remembers nothing, and tries on the next one", async () => {
    refuse = true;
    await page();
    await act(async () => { fireEvent.pointerDown(screen.getByTestId("neutral")); });
    await settle();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.localStorage.getItem("voices.song.off")).toBeNull();
    expect(screen.getByRole("button", { name: "Play the VOICES song" })).toBeTruthy();
    refuse = false;
    await act(async () => { fireEvent.keyDown(document.body, { key: "a" }); });
    await settle();
    expect(screen.getByRole("button", { name: "Stop the VOICES song" })).toBeTruthy();
  });
});
