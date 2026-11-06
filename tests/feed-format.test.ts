import { describe, expect, it } from "vitest";
import { ago, closesIn, voicesLabel, weekMeta } from "@/lib/feed-format";

const NOW = Date.parse("2026-11-12T12:00:00Z");

describe("feed-format", () => {
  it("closesIn counts down in minutes, hours and days, and is empty once past", () => {
    expect(closesIn("2026-11-12T12:45:00Z", NOW)).toBe("45 min");
    expect(closesIn("2026-11-12T21:00:00Z", NOW)).toBe("9h");
    expect(closesIn("2026-11-14T13:00:00Z", NOW)).toBe("2 days");
    expect(closesIn("2026-11-12T11:00:00Z", NOW)).toBeUndefined();
    expect(closesIn(null, NOW)).toBeUndefined();
  });
  it("ago, voicesLabel and weekMeta read like the boards", () => {
    expect(ago("2026-11-12T10:00:00Z", NOW)).toBe("2h");
    expect(ago("2026-11-09T12:00:00Z", NOW)).toBe("3d");
    expect(voicesLabel(12480)).toBe("12,480 voices");
    expect(voicesLabel(1)).toBe("1 voice");
    expect(weekMeta({ weekNumber: 1, questionCount: 10 }, true)).toBe("Week 1 · 10 questions · Poll open");
  });
});
