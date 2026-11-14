// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverrideMessage } from "@/components/feed/OverrideMessage";
import { AudioAdCard } from "@/components/feed/AudioAdCard";

/** V-FIX-B round 2: starting any clip stops the one that is playing (the real playback module, a fake audio element). */
const made: FakeAudio[] = [];
class FakeAudio extends EventTarget {
  currentTime = 0; duration = 10; paused = true; playbackRate = 1; src = "";
  play() { this.paused = false; this.dispatchEvent(new Event("play")); (this as unknown as { onplay?: () => void }).onplay?.(); return Promise.resolve(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); (this as unknown as { onpause?: () => void }).onpause?.(); } }
  setAttribute() { /* flags */ }
  oncontextmenu: unknown = null; onended: (() => void) | null = null; onpause: (() => void) | null = null; onplay: (() => void) | null = null; ontimeupdate: (() => void) | null = null; preload = "";
  constructor() { super(); made.push(this); }
}
vi.stubGlobal("Audio", FakeAudio);
vi.mock("@/lib/theme-song", () => ({ pauseSongForVoice: () => undefined }));
vi.mock("@/lib/api/polls", () => ({ recordAdEvent: () => Promise.resolve() }));
vi.mock("@/lib/api/profile", () => ({ getPlayUrl: (id: string) => Promise.resolve({ url: `https://signed.test/${id}`, expiresAt: "x", mime: "audio/mp4" }) }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => false }));

afterEach(() => { cleanup(); made.length = 0; });

describe("one clip at a time", () => {
  it("playing the override's voice note and then the advert leaves one playing", async () => {
    render(
      <>
        <OverrideMessage o={{ contentKind: "TEXT", body: "Hello", audioUrl: null, imageUrl: null, linkUrl: null, endsAt: "2999-01-01T00:00:00Z", audioClipId: "11111111-1111-4111-8111-111111111111", audioDurationMs: 9000 }} />
        <AudioAdCard ad={{ id: "a1", kind: "AUDIO_SLOT", brand: "Soup", label: "Ad", headline: "Soup of the day", body: null, imageUrl: null, audioClipId: "22222222-2222-4222-8222-222222222222", audioDurationMs: 9000, linkUrl: null, ctaLabel: null }} />
      </>,
    );
    const u = userEvent.setup();
    const note = screen.getByTestId("override-audio");
    const ad = screen.getByTestId("audio-ad");
    await u.click(note.querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(made.filter((a) => !a.paused)).toHaveLength(1));
    await u.click(ad.querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(made).toHaveLength(2));
    await waitFor(() => expect(made.filter((a) => !a.paused)).toHaveLength(1));
    expect(made[0].paused).toBe(true);
    expect(made[1].paused).toBe(false);
    // the note's button shows Play again; the advert's shows Pause
    expect(note.querySelector("button[aria-label^='Play']")).not.toBeNull();
    expect(ad.querySelector("button[aria-label^='Pause']")).not.toBeNull();
    // and back: the advert stops when the note starts again
    await u.click(note.querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(made[1].paused).toBe(true));
    expect(made[0].paused).toBe(false);
  });
});
