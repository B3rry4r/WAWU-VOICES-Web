// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as talk from "@/lib/api/talk";
import { EditSheet } from "@/features/talk/OwnPost";

vi.mock("@/lib/api/units", () => ({ getPublicConfig: () => Promise.resolve({ costs: { textMaxChars: 2500 } }) }));
vi.mock("@/lib/api/talk", () => ({ editAnswer: vi.fn(() => Promise.resolve({ id: "a", body: "ok" })) }));

beforeEach(() => vi.mocked(talk.editAnswer).mockClear());
afterEach(cleanup);

const LINE = "This post is longer than 2,500 characters. Shorten it to save your changes.";

function open(len: number) {
  render(<EditSheet answer={{ id: "a", body: "x".repeat(len) } as never} onClose={() => undefined} onSaved={() => undefined} />);
  return screen.getByLabelText("Your words") as HTMLTextAreaElement;
}

describe("editing a post never cuts it", () => {
  it("a 4,002 character post: one more character keeps all 4,003, shows the line, sends nothing", async () => {
    const ta = open(4002);
    expect(screen.getByText(LINE)).toBeTruthy();
    fireEvent.change(ta, { target: { value: "x".repeat(4002) + "y" } });
    expect(ta.value.length).toBe(4003);
    expect(screen.getByText("4,003 / 2,500")).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(talk.editAnswer).not.toHaveBeenCalled();
    expect(screen.getByText(LINE)).toBeTruthy();
  });
  it("shortened to 2,400, Save sends 2,400", async () => {
    const ta = open(4002);
    fireEvent.change(ta, { target: { value: "z".repeat(2400) } });
    expect(screen.queryByText(LINE)).toBeNull();
    const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(talk.editAnswer).toHaveBeenCalledTimes(1));
    expect(vi.mocked(talk.editAnswer).mock.calls[0][1]).toHaveLength(2400);
  });
});
