import { describe, expect, it } from "vitest";
import { clock, countdown, date, longSlot, published, weekdayClock, dateTime, dayKey, dayMonth, monthYear, slot, weekday } from "@/lib/format/date";

describe("shared date helper (Lagos time)", () => {
  it("writes the clock as the boards do: 12 hour, no space, lower case", () => {
    expect(clock("2026-11-04T23:39:00Z")).toBe("12:39am");
    expect(clock("2026-11-05T11:39:00Z")).toBe("12:39pm");
    expect(clock("2026-11-05T05:05:00Z")).toBe("6:05am");
    expect(clock("2026-11-05T17:00:00Z")).toBe("6:00pm");
    expect(clock("2026-11-05T17:00:00Z", { short: true })).toBe("6pm");
    expect(clock("2026-11-05T17:30:00Z", { short: true })).toBe("6:30pm");
  });

  it("writes hours without a space and minutes with one", () => { expect(countdown(9 * 3600000)).toBe("9h"); expect(countdown(12 * 60000)).toBe("12 min"); });

  it("writes dates as 5 Nov 2026 and Nov 2026", () => {
    expect(date("2026-11-05T10:00:00Z")).toBe("5 Nov 2026");
    expect(dayMonth("2026-11-05T10:00:00Z")).toBe("5 Nov");
    expect(monthYear("2026-11-05T10:00:00Z")).toBe("Nov 2026");
    expect(monthYear("2026-12-05T10:00:00Z", "long")).toBe("December 2026");
    expect(dateTime("2026-12-02T17:14:00Z")).toBe("2 Dec 2026, 6:14pm");
    expect(weekday("2026-11-30T10:00:00Z")).toBe("Mon");
    expect(weekday("2026-11-30T10:00:00Z", "long")).toBe("Monday");
    expect(slot("2026-11-30T09:30:00Z")).toBe("Mon 30 Nov, 10:30am");
  });

  it("reads Lagos time across midnight, not the device or UTC", () => {
    // 23:30 UTC on 5 Nov is 12:30 am on 6 Nov in Lagos (UTC+1).
    expect(dateTime("2026-11-05T23:30:00Z")).toBe("6 Nov 2026, 12:30am");
    expect(dateTime("2026-11-05T22:59:00Z")).toBe("5 Nov 2026, 11:59pm");
    expect(dayKey("2026-11-05T22:59:00Z")).toBe("2026-11-05");
    expect(dayKey("2026-11-05T23:00:00Z")).toBe("2026-11-06");
    expect(monthYear("2026-11-30T23:30:00Z")).toBe("Dec 2026");
    expect(date(new Date("2026-12-31T23:59:00Z"))).toBe("1 Jan 2027");
  });

  it("counts down in minutes, hours and days, and says nothing once past", () => {
    expect(countdown(30 * 1000)).toBe("1 min");
    expect(countdown(45 * 60000)).toBe("45 min");
    expect(countdown(59 * 60000 + 1)).toBe("1h");
    expect(countdown(23 * 3600000 + 5 * 60000)).toBe("23h");
    expect(countdown(24 * 3600000)).toBe("1 day");
    expect(countdown(4 * 24 * 3600000 + 3600000)).toBe("4 days");
    expect(countdown(0)).toBeUndefined();
    expect(countdown(-5)).toBeUndefined();
  });

  it("has the admin board forms", () => {
    expect(published("2026-11-30T17:00:00Z")).toBe("30 Nov, 6pm");
    expect(published("2026-11-30T17:03:00Z")).toBe("30 Nov, 6:03pm");
    expect(longSlot("2026-12-06T22:59:00Z")).toBe("Sunday 6 Dec, 11:59pm");
    expect(weekdayClock("2026-12-01T07:00:00Z")).toBe("Tue 8am");
  });
});
