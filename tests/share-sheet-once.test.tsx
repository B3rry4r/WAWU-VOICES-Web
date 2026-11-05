// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const createShareLink = vi.fn();
const recordShareEvent = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock("@/lib/api/reach", () => ({ createShareLink: (...a: unknown[]) => createShareLink(...a), recordShareEvent: (...a: unknown[]) => recordShareEvent(...a) }));
const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("@/features/reach/shared", () => ({ useDesktop: () => false }));

import { ShareSheet } from "@/features/share/ShareSheet";

const READY = { code: "abc", url: "https://v.test/s/abc", cardStatus: "READY", imageUrl: "https://v.test/card.png", previewText: "Say it\nhttps://v.test/s/abc" };

beforeEach(() => {
  createShareLink.mockReset();
  apiFetch.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe("ShareSheet makes one link per open", () => {
  it("one POST for a ready card, even under StrictMode's double effect", async () => {
    createShareLink.mockResolvedValue(READY);
    render(<StrictMode><ShareSheet objectType="QUESTION" objectId="q1" onClose={() => {}} /></StrictMode>);
    await waitFor(() => expect(screen.getByAltText("The card that goes out with your link")).toBeTruthy());
    expect(createShareLink).toHaveBeenCalledTimes(1);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("a card still being made is waited for with GET /card, never a second POST", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    createShareLink.mockResolvedValue({ ...READY, cardStatus: "PENDING", imageUrl: null });
    apiFetch.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new SyntaxError("png"));
    render(<StrictMode><ShareSheet objectType="QUESTION" objectId="q2" onClose={() => {}} /></StrictMode>);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1600);
    await waitFor(() => expect(screen.getByAltText("The card that goes out with your link")).toBeTruthy());
    expect(createShareLink).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toBe("/share/abc/card");
    vi.useRealTimers();
  });

  it("opening it again later makes a new link", async () => {
    createShareLink.mockResolvedValue(READY);
    const a = render(<ShareSheet objectType="QUESTION" objectId="q3" onClose={() => {}} />);
    await waitFor(() => expect(createShareLink).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 5));
    a.unmount();
    render(<ShareSheet objectType="QUESTION" objectId="q3" onClose={() => {}} />);
    await waitFor(() => expect(createShareLink).toHaveBeenCalledTimes(2));
  });
});
