import { describe, expect, it } from "vitest";
import { clock, countdown, date, dateTime, dayKey, dayMonth, monthYear, slot, weekday } from "@/lib/format/date";

describe("shared date helper (Lagos time)", () => {
  it("writes the clock as 12 hour, a space, lower case", () => {
    expect(clock("2026-11-04T23:39:00Z")).toBe("12:39 am");
    expect(clock("2026-11-05T11:39:00Z")).toBe("12:39 pm");
    expect(clock("2026-11-05T05:05:00Z")).toBe("6:05 am");
    expect(clock("2026-11-05T17:00:00Z")).toBe("6:00 pm");
    expect(clock("2026-11-05T17:00:00Z", { short: true })).toBe("6 pm");
    expect(clock("2026-11-05T17:30:00Z", { short: true })).toBe("6:30 pm");
  });

  it("writes dates as 5 Nov 2026 and Nov 2026", () => {
    expect(date("2026-11-05T10:00:00Z")).toBe("5 Nov 2026");
    expect(dayMonth("2026-11-05T10:00:00Z")).toBe("5 Nov");
    expect(monthYear("2026-11-05T10:00:00Z")).toBe("Nov 2026");
    expect(monthYear("2026-12-05T10:00:00Z", "long")).toBe("December 2026");
    expect(dateTime("2026-12-02T17:14:00Z")).toBe("2 Dec 2026, 6:14 pm");
    expect(weekday("2026-11-30T10:00:00Z")).toBe("Mon");
    expect(weekday("2026-11-30T10:00:00Z", "long")).toBe("Monday");
    expect(slot("2026-11-30T09:30:00Z")).toBe("Mon 30 Nov, 10:30 am");
  });

  it("reads Lagos time across midnight, not the device or UTC", () => {
    // 23:30 UTC on 5 Nov is 12:30 am on 6 Nov in Lagos (UTC+1).
    expect(dateTime("2026-11-05T23:30:00Z")).toBe("6 Nov 2026, 12:30 am");
    expect(dateTime("2026-11-05T22:59:00Z")).toBe("5 Nov 2026, 11:59 pm");
    expect(dayKey("2026-11-05T22:59:00Z")).toBe("2026-11-05");
    expect(dayKey("2026-11-05T23:00:00Z")).toBe("2026-11-06");
    expect(monthYear("2026-11-30T23:30:00Z")).toBe("Dec 2026");
    expect(date(new Date("2026-12-31T23:59:00Z"))).toBe("1 Jan 2027");
  });

  it("counts down in minutes, hours and days, and says nothing once past", () => {
    expect(countdown(30 * 1000)).toBe("1 min");
    expect(countdown(45 * 60000)).toBe("45 min");
    expect(countdown(59 * 60000 + 1)).toBe("1 h");
    expect(countdown(23 * 3600000 + 5 * 60000)).toBe("23 h");
    expect(countdown(24 * 3600000)).toBe("1 day");
    expect(countdown(4 * 24 * 3600000 + 3600000)).toBe("4 days");
    expect(countdown(0)).toBeUndefined();
    expect(countdown(-5)).toBeUndefined();
  });
});
