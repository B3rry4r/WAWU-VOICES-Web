// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NO_TAG, tagFields, tagReady, tagWaitText, linkOk, type TagChoice } from "@/features/news/tag-choice";
import { TagPicker } from "@/features/news/TagPicker";
import { OverrideMessage, safeLink } from "@/components/feed/OverrideMessage";
import { AudioAdCard } from "@/components/feed/AudioAdCard";
import { audioProblem, pictureProblem } from "@/lib/api/admin-media";

const events: { id: string; kind: string }[] = [];
const played: string[] = [];
vi.mock("@/lib/api/polls", () => ({
  recordAdEvent: (id: string, kind: string) => { events.push({ id, kind }); return Promise.resolve(); },
}));
vi.mock("@/lib/api/profile", () => ({
  getPlayUrl: (id: string) => { played.push(id); return Promise.resolve({ url: `https://signed.test/${id}`, expiresAt: "x", mime: "audio/mp4" }); },
}));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => false }));
vi.mock("@/lib/api/feed", () => ({ getMe: () => Promise.resolve({ roles: [] }) }));
class FakeAudio extends EventTarget {
  currentTime = 0; duration = 10; paused = true; playbackRate = 1; src = "";
  play() { this.paused = false; this.dispatchEvent(new Event("play")); return Promise.resolve(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); } }
  setAttribute() { /* player flags */ }
  oncontextmenu: unknown = null; onended: (() => void) | null = null; onpause: (() => void) | null = null; onplay: (() => void) | null = null; ontimeupdate: (() => void) | null = null; preload = "";
}
vi.mock("@/features/profile/playback", () => ({
  makePlayer: () => new FakeAudio(),
  playWithResign: (a: FakeAudio) => a.play(),
}));

beforeEach(() => { events.length = 0; played.length = 0; });
afterEach(() => cleanup());

describe("V-FIX-B tag choice: Not news is selected to begin with, so posting stays one tap", () => {
  it("Not news is ready at once and sends no tag", () => {
    expect(tagReady(NO_TAG)).toBe(true);
    expect(tagWaitText(NO_TAG)).toBeNull();
    expect(tagFields(NO_TAG)).toBeNull();
  });
  it("Unverified News and Gossip are ready at once and send isNews with the tag", () => {
    expect(tagReady({ ...NO_TAG, pick: "GOSSIP" })).toBe(true);
    expect(tagFields({ ...NO_TAG, pick: "GOSSIP" })).toEqual({ isNews: true, newsTag: "GOSSIP" });
    expect(tagFields({ ...NO_TAG, pick: "UNVERIFIED_NEWS" })).toEqual({ isNews: true, newsTag: "UNVERIFIED_NEWS" });
  });
  it("a request for Verified News needs a named source and sends it as Unverified News with requestVerified", () => {
    const c: TagChoice = { pick: "REQUEST_VERIFIED", sourceName: "", sourceUrl: "" };
    expect(tagReady(c)).toBe(false);
    expect(tagWaitText(c)).toBe("Name your source to ask for Verified News.");
    const ok: TagChoice = { pick: "REQUEST_VERIFIED", sourceName: " Lagos State Press Office ", sourceUrl: "https://example.com/s" };
    expect(tagReady(ok)).toBe(true);
    expect(tagFields(ok)).toEqual({ isNews: true, newsTag: "UNVERIFIED_NEWS", requestVerified: true, newsSourceName: "Lagos State Press Office", newsSourceUrl: "https://example.com/s" });
    expect(tagReady({ ...ok, sourceUrl: "ftp://x" })).toBe(false);
    expect(linkOk("")).toBe(true);
    expect(linkOk("not a link")).toBe(false);
  });
  it("an editor's own Verified News names its source and sends VERIFIED_NEWS", () => {
    expect(tagFields({ pick: "VERIFIED_NEWS", sourceName: "NiMet", sourceUrl: "" })).toEqual({ isNews: true, newsTag: "VERIFIED_NEWS", newsSourceName: "NiMet" });
  });
});

function Harness({ editor }: { editor?: boolean }) {
  const [v, setV] = useState<TagChoice>(NO_TAG);
  return (
    <div>
      <TagPicker value={v} onChange={setV} editor={editor} />
      <button type="button" disabled={!tagReady(v)}>Post</button>
    </div>
  );
}

describe("V-FIX-B TagPicker", () => {
  it("opens with Not news selected and the Post button ready", () => {
    render(<Harness />);
    const pressed = screen.queryAllByRole("button", { pressed: true });
    expect(pressed.map((b) => b.textContent)).toEqual(["Not news"]);
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("Request Verified News is enabled for everyone; choosing it asks for the source and the button waits for it, and going back to Not news frees it", async () => {
    render(<Harness />);
    const u = userEvent.setup();
    const chip = screen.getByRole("button", { name: /Request Verified News/ });
    expect(chip.getAttribute("aria-disabled")).toBeNull();
    await u.click(chip);
    expect(screen.getByTestId("tag-source")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);
    await u.type(screen.getByLabelText("Your source"), "Lagos State Press Office");
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(false);
    await u.click(screen.getByRole("button", { name: "Not news" }));
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("choosing Gossip says what Gossip means; Not news puts it back", async () => {
    render(<Harness />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Gossip" }));
    expect(screen.getByTestId("tag-note").textContent).toContain("Not presented as fact");
    expect(screen.queryAllByRole("button", { pressed: true }).map((b) => b.textContent)).toEqual(["Gossip"]);
    await u.click(screen.getByRole("button", { name: "Not news" }));
    expect(screen.queryAllByRole("button", { pressed: true }).map((b) => b.textContent)).toEqual(["Not news"]);
  });
  it("an editor sees Verified News in place of the request", () => {
    render(<Harness editor />);
    expect(screen.getByRole("button", { name: "Verified News" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Request Verified News/ })).toBeNull();
  });
});

describe("V-FIX-B the daily override on Home", () => {
  const base = { contentKind: "TEXT" as const, body: "Tell us where you are.", audioUrl: null, imageUrl: null, linkUrl: null, endsAt: "2026-11-15T10:00:00Z" };
  it("draws the message, the picture, the voice note and a link button that opens in a new tab", () => {
    render(<OverrideMessage o={{ ...base, imageUrl: "https://cdn.test/file/override_image/x.png", audioClipId: "11111111-1111-4111-8111-111111111111", audioDurationMs: 14000, linkUrl: "https://example.com/flood-help" }} />);
    expect(screen.getByTestId("override-message").textContent).toBe("Tell us where you are.");
    expect(screen.getByTestId("override-image").getAttribute("src")).toBe("https://cdn.test/file/override_image/x.png");
    expect(screen.getByTestId("override-audio")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open the link/ });
    expect(link.getAttribute("href")).toBe("https://example.com/flood-help");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
  it("an override with only words draws only words; a link that is not http(s) is not a button", () => {
    render(<OverrideMessage o={{ ...base, linkUrl: "javascript:alert(1)" }} />);
    expect(screen.getByTestId("override-message")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByTestId("override-image")).toBeNull();
    expect(screen.queryByTestId("override-audio")).toBeNull();
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("https://example.com/a")).toBe("https://example.com/a");
  });
  it("the voice note is asked for on tap, not on load", async () => {
    render(<OverrideMessage o={{ ...base, audioClipId: "22222222-2222-4222-8222-222222222222", audioDurationMs: 9000 }} />);
    expect(played).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /Play voice/ }));
    await waitFor(() => expect(played).toEqual(["22222222-2222-4222-8222-222222222222"]));
  });
});

describe("V-FIX-B the audio advert", () => {
  const ad = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "AUDIO_SLOT" as const, brand: "Mama Nkechi's Kitchen", label: "Ad" as const, headline: "Hear this week's soup of the day", body: null, imageUrl: null, audioClipId: "33333333-3333-4333-8333-333333333333", audioDurationMs: 15000, linkUrl: "https://example.com/kitchen", ctaLabel: "Visit page" };
  it("is labelled Ad, counts one view, plays only on tap and counts a listen once", async () => {
    render(<AudioAdCard ad={ad} />);
    expect(screen.getByLabelText("Ad from Mama Nkechi's Kitchen")).toBeTruthy();
    expect(screen.getByText("Ad")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Visit page/ }).getAttribute("href")).toBe("https://example.com/kitchen");
    await waitFor(() => expect(events.filter((e) => e.kind === "IMPRESSION")).toHaveLength(1));
    expect(played).toHaveLength(0);
    expect(events.filter((e) => e.kind === "LISTEN")).toHaveLength(0);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: /Play voice/ }));
    await waitFor(() => expect(events.filter((e) => e.kind === "LISTEN")).toHaveLength(1));
    expect(played).toEqual([ad.audioClipId]);
    await u.click(screen.getByRole("button", { name: /Pause voice/ }));
    await u.click(screen.getByRole("button", { name: /Play voice/ }));
    await new Promise((r) => setTimeout(r, 30));
    expect(events.filter((e) => e.kind === "LISTEN")).toHaveLength(1);
    await u.click(screen.getByRole("link", { name: /Visit page/ }));
    expect(events.filter((e) => e.kind === "TAP")).toHaveLength(1);
  });
  it("draws nothing for an advert with no recording ready", () => {
    const { container } = render(<AudioAdCard ad={{ ...ad, audioClipId: null }} />);
    expect(container.textContent).toBe("");
    expect(events).toHaveLength(0);
  });
});

describe("V-FIX-B team uploads are checked before they are sent", () => {
  it("pictures: type and size", () => {
    expect(pictureProblem({ type: "image/gif", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(pictureProblem({ type: "image/png", size: 6_000_000 })).toMatch(/too large/);
    expect(pictureProblem({ type: "image/webp", size: 1000 })).toBeNull();
  });
  it("recordings: type and length", () => {
    expect(audioProblem({ type: "video/mp4" }, 10, 30)).toMatch(/recording in/);
    expect(audioProblem({ type: "audio/mp4" }, 45, 30)).toMatch(/30 seconds at most/);
    expect(audioProblem({ type: "audio/webm;codecs=opus" }, 12, 30)).toBeNull();
    expect(audioProblem({ type: "audio/mpeg" }, 0.1, 30)).toMatch(/too short/);
  });
});
