// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/" }));

import { AnswerCard } from "@/components/vx";
import { countText } from "@/lib/format/plural";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("singular at exactly 1", () => {
  it("countText", () => {
    expect(countText(1, "vote")).toBe("1 vote");
    expect(countText(0, "vote")).toBe("0 votes");
    expect(countText(1200, "reaction")).toBe("1,200 reactions");
    expect(countText(1, "reply", "replies")).toBe("1 reply");
    expect(countText(2, "reply", "replies")).toBe("2 replies");
  });
});

describe("reaction tray tab order", () => {
  it("Tab goes from React to the tray, then on to Reply", async () => {
    const user = userEvent.setup();
    render(<AnswerCard author={{ name: "Ada" }} time="1h ago" text="Hello" likes={1} replies={1} />);
    expect(screen.getByRole("button", { name: "Reply, 1 reply" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Like, 1 like" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "React" }));
    const buttons = Array.from(document.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
    const react = buttons.indexOf("React");
    const reply = buttons.indexOf("Reply, 1 reply");
    const tray = buttons.findIndex((t) => /Relatable|Well said|Same/.test(t));
    expect(react).toBeGreaterThan(-1);
    expect(tray).toBeGreaterThan(react);
    expect(tray).toBeLessThan(reply);
  });
});
