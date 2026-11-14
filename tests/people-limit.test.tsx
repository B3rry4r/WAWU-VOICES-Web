// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Composer } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { failText } from "@/features/talk/lib";
import { TEXT_MAX_CHARS_FALLBACK, textLimit } from "@/features/talk/textLimit";

vi.mock("@/lib/api/units", () => ({ getPublicConfig: () => Promise.resolve({ costs: { textMaxChars: 1200 } }) }));
vi.mock("@/lib/api/talk", () => ({ editAnswer: vi.fn() }));

afterEach(cleanup);

describe("the longest written post", () => {
  it("reads the config's number and falls back to 2,500 in one constant", () => {
    expect(TEXT_MAX_CHARS_FALLBACK).toBe(2500);
    expect(textLimit(undefined)).toBe(2500);
    expect(textLimit({})).toBe(2500);
    expect(textLimit({ textMaxChars: 1200 })).toBe(1200);
  });
  it("the counter shows the limit and the person is stopped at it with plain words", () => {
    render(<Composer maxChars={textLimit(undefined)} countChars={(t) => [...t].length} onVoice={false} />);
    expect(screen.getByText("0 / 2,500")).toBeTruthy();
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "a".repeat(3000) } });
    expect(ta.value.length).toBe(2500);
    expect(screen.getByText("2,500 / 2,500")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Keep it to 2,500 characters.");
  });
  it("shows the server's own words when it still refuses", () => {
    const e = new ApiError(422, "VALIDATION_FAILED", "x", true, { fields: [{ path: "body", message: "Keep it to 2,500 characters." }] });
    expect(failText(e)).toBe("Keep it to 2,500 characters.");
    expect(failText(new ApiError(422, "VALIDATION_FAILED", "x", false))).toBe("Check what you wrote and try again.");
  });
  it("the edit sheet uses the same limit", async () => {
    const { EditSheet } = await import("@/features/talk/OwnPost");
    render(<EditSheet answer={{ id: "a", body: "hi" } as never} onClose={() => undefined} onSaved={() => undefined} />);
    expect(screen.getByText("2 / 2,500")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("2 / 1,200")).toBeTruthy());
    const ta = screen.getByLabelText("Your words") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "b".repeat(1500) } });
    expect(ta.value.length).toBe(1200);
    expect(screen.getByText("Keep it to 1,200 characters.")).toBeTruthy();
  });
});
