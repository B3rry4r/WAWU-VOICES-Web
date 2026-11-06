// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { nextOpening, useOpensAt } from "@/features/vote/chrome";
import { shortRef } from "@/features/units/PaymentDoneScreen";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("polish A", () => {
  it("finds the soonest scheduled start and ignores open polls", () => {
    expect(nextOpening([{ status: "OPEN", startsAt: "2020-01-01T00:00:00Z" }, { status: "SCHEDULED", startsAt: "2030-01-02T00:00:00Z" }, { status: "SCHEDULED", startsAt: "2030-01-01T00:00:00Z" }, null])).toBe(Date.parse("2030-01-01T00:00:00Z"));
    expect(nextOpening([{ status: "OPEN", startsAt: "2020-01-01T00:00:00Z" }])).toBeNull();
  });
  it("fires once when the start passes, and not before", () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    renderHook(() => useOpensAt(Date.now() + 5000, onOpen));
    vi.advanceTimersByTime(4000);
    expect(onOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it("shortens a long payment reference to its last 8 characters", () => {
    expect(shortRef("voices-0b1c2d3e-aaaa-bbbb-cccc-1234567890ab")).toBe("567890ab");
    // lead ruling WF, 6 Nov (B-L2): the person's own VU- reference is shown whole, never cut.
    expect(shortRef("VU-261202-48213")).toBe("VU-261202-48213");
    expect(shortRef("short")).toBe("short");
  });
});
