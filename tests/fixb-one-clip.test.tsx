// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverrideMessage } from "@/components/feed/OverrideMessage";
import { AudioAdCard } from "@/components/feed/AudioAdCard";
import { toggleSong, stopSong } from "@/lib/theme-song";
import { stopPlayback } from "@/features/profile/playback";

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

  it("starting the theme song stops a playing clip, and starting a clip stops the song", async () => {
    render(<OverrideMessage o={{ contentKind: "TEXT", body: "Hello", audioUrl: null, imageUrl: null, linkUrl: null, endsAt: "2999-01-01T00:00:00Z", audioClipId: "11111111-1111-4111-8111-111111111111", audioDurationMs: 9000 }} />);
    const u = userEvent.setup();
    const note = screen.getByTestId("override-audio");
    await u.click(note.querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(made.filter((a) => !a.paused)).toHaveLength(1));
    const clip = made[0];
    await toggleSong();
    const song = made[made.length - 1];
    expect(song).not.toBe(clip);
    expect(clip.paused).toBe(true);
    expect(song.paused).toBe(false);
    expect(note.querySelector("button[aria-label^='Play']")).not.toBeNull();
    // and back: a clip starting steps the song aside (pauseSongForVoice) as it always did
    await u.click(note.querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(song.paused).toBe(true));
    stopSong();
    stopPlayback();
  });

  it("an advert's link pauses only the advert, not an override note that is playing", async () => {
    render(
      <>
        <OverrideMessage o={{ contentKind: "TEXT", body: "Hello", audioUrl: null, imageUrl: null, linkUrl: null, endsAt: "2999-01-01T00:00:00Z", audioClipId: "11111111-1111-4111-8111-111111111111", audioDurationMs: 9000 }} />
        <AudioAdCard ad={{ id: "a1", kind: "AUDIO_SLOT", brand: "Soup", label: "Ad", headline: "Soup of the day", body: null, imageUrl: null, audioClipId: "22222222-2222-4222-8222-222222222222", audioDurationMs: 9000, linkUrl: "https://example.com/soup", ctaLabel: "Visit" }} />
      </>,
    );
    const u = userEvent.setup();
    await u.click(screen.getByTestId("override-audio").querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(made.filter((a) => !a.paused)).toHaveLength(1));
    const link = screen.getByRole("link", { name: /Visit/ });
    link.addEventListener("click", (e) => e.preventDefault());
    await u.click(link);
    expect(made[0].paused).toBe(false);
    // with the advert playing, its link pauses it
    await u.click(screen.getByTestId("audio-ad").querySelector("button[aria-label^='Play']") as HTMLElement);
    await waitFor(() => expect(made).toHaveLength(2));
    await u.click(link);
    expect(made[1].paused).toBe(true);
  });
});
