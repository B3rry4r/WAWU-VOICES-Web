import { describe, expect, it } from "vitest";
import { ago, handleProblem, isUuid, joinedLabel, minuteLabel, placeLabel, unitsFigure } from "@/features/profile/format";

describe("profile formats", () => {
  it("shows units with at most one decimal", () => {
    expect(unitsFigure(12500)).toBe("12.5");
    expect(unitsFigure(12000)).toBe("12");
    expect(unitsFigure(100)).toBe("0.1");
    expect(unitsFigure(0)).toBe("0");
  });
  it("joined month and year in Lagos time", () => {
    expect(joinedLabel("2026-11-02T10:00:00Z")).toBe("Joined Nov 2026");
    expect(joinedLabel("2026-10-31T23:30:00Z")).toBe("Joined Nov 2026"); // already 1 Nov in Lagos (UTC+1)
  });
  it("place is the city, else the state", () => {
    expect(placeLabel({ city: "Enugu", state: "Enugu State" })).toBe("Enugu");
    expect(placeLabel({ city: null, state: "Kano" })).toBe("Kano");
    expect(placeLabel({ city: null, state: null })).toBeUndefined();
  });
  it("ago", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(ago("2026-11-05T11:55:00Z", now)).toBe("5m");
    expect(ago("2026-11-05T08:00:00Z", now)).toBe("4h");
    expect(ago("2026-11-03T12:00:00Z", now)).toBe("2d");
  });
  it("clock words", () => {
    expect(minuteLabel(480)).toBe("8 am");
    expect(minuteLabel(0)).toBe("12 am");
    expect(minuteLabel(13 * 60 + 30)).toBe("1:30 pm");
  });
  it("handle rules mirror the API (3 to 20 of a-z 0-9 . _)", () => {
    expect(handleProblem("ada.okafor")).toBeNull();
    expect(handleProblem("ab")).toMatch(/3 to 20/);
    expect(handleProblem("ada!")).toMatch(/letters, numbers/i);
    expect(handleProblem("a".repeat(21))).toMatch(/3 to 20/);
    expect(isUuid("01a1ad10-629a-77bd-9c51-e4ca6c7681ec")).toBe(true);
    expect(isUuid("tunde.a")).toBe(false);
  });
});
