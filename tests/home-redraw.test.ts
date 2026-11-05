import { describe, expect, it } from "vitest";
import { isOpen, shortCount, unitsLabel, voicesShort } from "@/lib/feed-format";
import { DRAWN, categoryLook } from "@/lib/categories";

const NOW = Date.parse("2026-11-12T12:00:00Z");

describe("home redraw helpers", () => {
  it("counts read like the boards", () => {
    expect(shortCount(8200)).toBe("8,200");
    expect(shortCount(12400)).toBe("12.4K");
    expect(shortCount(21400)).toBe("21.4K");
    expect(voicesShort(1)).toBe("1 voice");
    expect(voicesShort(3100)).toBe("3,100 voices");
  });
  it("units", () => {
    expect(unitsLabel(200)).toBe("0.2 units");
    expect(unitsLabel(1000)).toBe("1 unit");
    expect(unitsLabel(12500)).toBe("12.5 units");
  });
  it("a question is open by its dates (V-27)", () => {
    const base = { status: "SCHEDULED", startsAt: "2026-11-12T00:00:00Z", endsAt: "2026-11-13T00:00:00Z" };
    expect(isOpen(base, NOW)).toBe(true);
    expect(isOpen({ ...base, startsAt: "2026-11-13T00:00:00Z" }, NOW)).toBe(false);
    expect(isOpen({ ...base, endsAt: "2026-11-12T11:00:00Z" }, NOW)).toBe(false);
    expect(isOpen({ ...base, status: "CLOSED" }, NOW)).toBe(false);
  });
  it("the eight drawn tiles keep their drawn labels and colours, other categories get their own name", () => {
    expect(DRAWN.map((d) => d.label)).toEqual(["Money", "Power and light", "Work and pay", "Love", "Roads and travel", "Faith", "Family", "Elections"]);
    expect(categoryLook({ slug: "power", name: "Power" })).toMatchObject({ label: "Power and light", tone: "sky", icon: "lightbulb" });
    expect(categoryLook({ slug: "sport", name: "Sport" }).label).toBe("Sport");
  });
});
