// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/client";

// A plain function, not vi.fn: a vi.fn that returns a rejected promise reports an unhandled rejection of its own.
const calls: unknown[][] = [];
let reply: () => Promise<unknown> = () => Promise.resolve({ id: "r1", blocked: false });
vi.mock("@/lib/api/talk", () => ({ createReport: (...a: unknown[]) => { calls.push(a); return reply(); } }));

import { ReportSheet } from "@/features/results/ReportSheet";

beforeEach(() => { calls.length = 0; });
afterEach(cleanup);

describe("ReportSheet", () => {
  it("three taps in one tick send one report, and the buttons are disabled while it is out", async () => {
    let finish!: (v: unknown) => void;
    reply = () => new Promise((r) => (finish = r));
    render(<ReportSheet postId="p1" signedIn onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "The numbers look wrong" });
    act(() => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    expect(calls).toHaveLength(1);
    await waitFor(() => expect((screen.getByRole("button", { name: /The numbers look wrong/ }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Spam or a scam" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Spam or a scam" }));
    expect(calls).toHaveLength(1);
    await act(async () => finish({ id: "r1", blocked: false }));
    expect((await screen.findByRole("status")).textContent).toContain("We got your report");
    expect(calls).toHaveLength(1);
  });

  it("shows the server's own-post message on a 422", async () => {
    reply = () => Promise.reject(new ApiError(422, "VALIDATION_FAILED", "You cannot report your own post.", true));
    render(<ReportSheet postId="p1" signedIn onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Spam or a scam" }));
    expect((await screen.findByRole("alert")).textContent).toBe("You cannot report your own post.");
    // the buttons come back so the person can close the sheet or pick again
    expect((screen.getByRole("button", { name: "Spam or a scam" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
