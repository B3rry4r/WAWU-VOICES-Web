// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "@/components/vx/overlays";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <Sheet title="Report" open={open} onClose={() => setOpen(false)}>
        <button>First action</button>
        <button>Last action</button>
      </Sheet>
    </div>
  );
}

afterEach(cleanup);

describe("Sheet focus", () => {
  it("moves focus into the sheet on open", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open sheet"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByText("First action"));
  });

  it("keeps Tab and Shift+Tab inside the sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open sheet"));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    screen.getByText("First action").focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByLabelText("Close"));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByText("Last action"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Close"));
  });

  it("returns focus to the opener on close (Escape)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText("Open sheet");
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
