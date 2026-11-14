// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createShareLink = vi.fn();
const recordShareEvent = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock("@/lib/api/reach", () => ({ createShareLink: (...a: unknown[]) => createShareLink(...a), recordShareEvent: (...a: unknown[]) => recordShareEvent(...a) }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/features/reach/shared", () => ({ useDesktop: () => false }));

import { ShareSheet } from "@/features/share/ShareSheet";

const LINK = {
  code: "abc1234", url: "https://v.test/s/abc1234", cardStatus: "READY", imageUrl: "https://v.test/card.png",
  storyImageUrl: "https://v.test/api/v1/share/abc1234/story", squareImageUrl: "https://v.test/api/v1/share/abc1234/square",
  previewText: "Say it\nAdd your voice: https://v.test/s/abc1234",
};
const TYPES = ["QUESTION", "ANSWER", "POLL_RESULT", "WEEKLY_REPORT", "PROFILE"] as const;

let fetchMock: ReturnType<typeof vi.fn>;
let downloads: string[];
beforeEach(() => {
  createShareLink.mockReset().mockResolvedValue(LINK);
  recordShareEvent.mockClear();
  downloads = [];
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["png"])) }));
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("V-FIX-D: the share sheet draws the board's targets and offers both card sizes, for every kind of share", () => {
  for (const type of TYPES) {
    it(`${type}: WhatsApp, Status, Stories, Facebook, X, TikTok, Telegram, SMS, Copy link, in that order`, async () => {
      render(<ShareSheet objectType={type} objectId="o1" onClose={() => {}} />);
      await waitFor(() => expect(screen.getByAltText("The card that goes out with your link")).toBeTruthy());
      const group = screen.getByRole("group", { name: "Share to" });
      const names = Array.from(group.querySelectorAll("a,button")).map((e) => e.getAttribute("aria-label"));
      expect(names.slice(0, 9)).toEqual(["WhatsApp", "Status", "Stories", "Facebook", "X", "TikTok", "Telegram", "SMS", "Copy link"]);
    });
  }

  it("Status opens WhatsApp with the share words and counts WHATSAPP_STATUS", async () => {
    render(<ShareSheet objectType="ANSWER" objectId="o1" onClose={() => {}} />);
    await waitFor(() => expect(createShareLink).toHaveBeenCalled());
    const a = await screen.findByRole("link", { name: "Status" });
    expect(a.getAttribute("href")).toContain("https://wa.me/?text=");
    await userEvent.click(a);
    expect(recordShareEvent).toHaveBeenCalledWith("abc1234", "intent", "WHATSAPP_STATUS");
  });

  it("Stories saves the 1080 x 1920 story card, shows the how-to and counts INSTAGRAM_STORIES", async () => {
    render(<ShareSheet objectType="QUESTION" objectId="o1" onClose={() => {}} />);
    const btn = await screen.findByRole("button", { name: "Stories" });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId("card-saved")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(LINK.storyImageUrl);
    expect(downloads).toEqual(["voices-story-card.png"]);
    expect(screen.getByText("Your story card is saved")).toBeTruthy();
    // only what is true: a picture was downloaded
    expect(screen.getByText("Saved to your downloads. Open the app and add it from there.")).toBeTruthy();
    expect(screen.queryByText(/Your story\./)).toBeNull();
    expect(screen.queryByText(/from your photos/)).toBeNull();
    expect(recordShareEvent).toHaveBeenCalledWith("abc1234", "intent", "INSTAGRAM_STORIES");
  });

  it("the square card is one tap away after Stories, from the square route", async () => {
    render(<ShareSheet objectType="POLL_RESULT" objectId="o1" onClose={() => {}} />);
    const btn = await screen.findByRole("button", { name: "Stories" });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(btn);
    await userEvent.click(await screen.findByRole("button", { name: /Save the square version instead/ }));
    await waitFor(() => expect(downloads).toEqual(["voices-story-card.png", "voices-square-card.png"]));
    expect(fetchMock).toHaveBeenLastCalledWith(LINK.squareImageUrl);
    expect(screen.getByText("Your square version is saved")).toBeTruthy();
  });

  it("TikTok saves the story card and says only that it was saved", async () => {
    render(<ShareSheet objectType="PROFILE" objectId="o1" onClose={() => {}} />);
    const btn = await screen.findByRole("button", { name: "TikTok" });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByText("Saved to your downloads. Open the app and add it from there.")).toBeTruthy());
    expect(screen.queryByText(/Open TikTok/)).toBeNull();
    expect(recordShareEvent).toHaveBeenCalledWith("abc1234", "intent", "TIKTOK");
  });

  it("the story and square pictures are shown small before anything is saved", async () => {
    render(<ShareSheet objectType="QUESTION" objectId="o1" onClose={() => {}} />);
    const box = await screen.findByTestId("card-previews");
    expect(box.querySelectorAll("img")).toHaveLength(2);
    expect(screen.getByAltText("The story version of the card")).toBeTruthy();
    expect(screen.getByAltText("The square version of the card")).toBeTruthy();
  });

  it("where the device can share a file, Stories, TikTok and Status hand the picture to the phone's own share sheet and download nothing", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<ShareSheet objectType="ANSWER" objectId="o1" onClose={() => {}} />);
    await screen.findByTestId("card-previews");
    for (const name of ["Stories", "TikTok"]) {
      await userEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(share).toHaveBeenCalledTimes(name === "Stories" ? 1 : 2));
    }
    await userEvent.click(screen.getByRole("link", { name: "Status" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(3));
    const files = share.mock.calls.map((c) => (c as unknown as [{ files: File[] }])[0].files[0].name);
    expect(files).toEqual(["voices-story-card.png", "voices-story-card.png", "voices-story-card.png"]);
    expect(downloads).toEqual([]);
    expect(screen.queryByTestId("card-saved")).toBeNull();
    // and More is offered because the browser can share
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
    Reflect.deleteProperty(navigator, "canShare");
    Reflect.deleteProperty(navigator, "share");
  });

  it("a card that is not ready says so in plain words and saves nothing", async () => {
    fetchMock.mockResolvedValue({ ok: false, blob: () => Promise.resolve(new Blob()) });
    render(<ShareSheet objectType="WEEKLY_REPORT" objectId="o1" onClose={() => {}} />);
    const btn = await screen.findByRole("button", { name: "Stories" });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByText("The card is still being made. Try again in a moment.")).toBeTruthy());
    expect(downloads).toEqual([]);
  });
});
