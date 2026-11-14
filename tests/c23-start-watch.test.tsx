// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useStartWatch } from "@/components/feed/useLoad";
import { noteServerDate, resetServerClock } from "@/lib/api/server-clock";

const OPENS = Date.parse("2026-11-14T23:00:00Z");
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

// C23: the page is loaded with a REAL load time (fetchedAt = the device clock at mount), unlike the older tests that pass 0.
// The API's Date header is right; the device clock is off by `skew`. Times below are REAL times (the device clock minus its skew).
function Watch({ onAsk, fetchedAt }: { onAsk: () => void; fetchedAt: { current: number } }) {
  useStartWatch(OPENS, async () => onAsk(), fetchedAt);
  return null;
}

async function run(skew: number, lead: number, r: number, watchMs: number) {
  const rnd = vi.spyOn(Math, "random").mockReturnValue(r);
  const real = OPENS - lead;
  vi.useFakeTimers({ now: real + skew });
  noteServerDate(new Date(real).toUTCString());
  const asks: number[] = [];
  const onAsk = () => asks.push(Date.now() - skew);
  render(<Watch onAsk={onAsk} fetchedAt={{ current: Date.now() }} />);
  const end = OPENS + watchMs;
  while (Date.now() - skew < end) await tick(100);
  rnd.mockRestore();
  return asks;
}

describe("C23: the first ask after the opening, with a real load time", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); resetServerClock(); });
  for (const [name, skew] of [["right", 0], ["10 minutes slow", -600_000], ["3 hours slow", -10_800_000], ["10 minutes fast", 600_000], ["3 hours fast", 10_800_000]] as const) {
    for (const lead of [5_000, 20_000, 100_000]) {
      for (const r of [0, 0.5, 0.9907]) {
        it(`clock ${name}, opening ${lead / 1000} s after the load, spread ${r}: asks within 0 to 5 s of the instant`, async () => {
          const asks = await run(skew, lead, r, 5_200);
          const before = asks.filter((t) => t < OPENS);
          const after = asks.filter((t) => t >= OPENS);
          expect(after.length).toBeGreaterThan(0);
          expect(after[0] - OPENS).toBeLessThanOrEqual(5_100);
          if (skew <= 0) expect(before.length).toBe(0);
          else for (let i = 1; i < before.length; i++) expect(before[i] - before[i - 1]).toBeGreaterThanOrEqual(59_900);
        });
      }
    }
  }
  for (const [name, skew] of [["right", 0], ["10 minutes slow", -600_000], ["3 hours slow", -10_800_000]] as const) {
    for (const lead of [5_000, 20_000, 100_000]) {
      for (const r of [0, 0.5, 0.9907]) {
        it(`clock ${name}, opening ${lead / 1000} s after the load, spread ${r}: "not open yet" is asked again after 5 s, not 60`, async () => {
          const asks = (await run(skew, lead, r, 20_000)).filter((t) => t >= OPENS);
          expect(asks.length).toBeGreaterThanOrEqual(2);
          expect(asks[1] - asks[0]).toBeGreaterThanOrEqual(5_000);
          expect(asks[1] - asks[0]).toBeLessThanOrEqual(5_600);
        });
      }
    }
  }

  // Header 10 minutes FAST, device clock right (so the server-corrected guess is the early one, 10 minutes before the real instant).
  it("header 10 min fast, device right, load 3 min before the real instant: the load counts, at most one ask a minute, ask within 5.1 s of the real instant", async () => {
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const real = OPENS - 180_000;
    vi.useFakeTimers({ now: real });
    noteServerDate(new Date(real + 600_000).toUTCString());
    const asks: number[] = [];
    render(<Watch onAsk={() => asks.push(Date.now())} fetchedAt={{ current: Date.now() }} />);
    while (Date.now() < OPENS + 5_200) await tick(100);
    rnd.mockRestore();
    const before = asks.filter((t) => t < OPENS);
    expect(before.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < before.length; i++) expect(before[i] - before[i - 1]).toBeGreaterThanOrEqual(59_900);
    expect(asks.filter((t) => t >= OPENS)[0] - OPENS).toBeLessThanOrEqual(5_100);
  });
  // Page loaded 20 s before the server-corrected guess (header 10 min fast, device right): ask on its arrival, once more 5 s later,
  // then once a minute, then at the device's (real) instant an ask at once and the retry steps.
  for (const r of [0, 0.5, 0.9907]) {
    it(`header 10 min fast, device right, load 20 s before the server-corrected guess, spread ${r}: arrival ask, 5 s, once a minute, then the real instant`, async () => {
      const rnd = vi.spyOn(Math, "random").mockReturnValue(r);
      const sInstant = OPENS - 600_000; // the opening by the (fast) header
      const start = sInstant - 20_000;
      vi.useFakeTimers({ now: start });
      noteServerDate(new Date(start + 600_000).toUTCString());
      const asks: number[] = [];
      render(<Watch onAsk={() => asks.push(Date.now())} fetchedAt={{ current: Date.now() }} />);
      while (Date.now() < OPENS + 12_000) await tick(100);
      rnd.mockRestore();
      const spread = r * 5_000;
      expect(asks[0] - sInstant).toBeGreaterThanOrEqual(spread);
      expect(asks[0] - sInstant).toBeLessThanOrEqual(spread + 300);
      expect(asks[1] - asks[0]).toBeGreaterThanOrEqual(5_000);
      expect(asks[1] - asks[0]).toBeLessThanOrEqual(5_600);
      const mid = asks.filter((t) => t >= asks[1] && t < OPENS);
      for (let i = 1; i < mid.length; i++) expect(mid[i] - mid[i - 1]).toBeGreaterThanOrEqual(59_900);
      const atReal = asks.filter((t) => t >= OPENS);
      expect(atReal[0] - OPENS).toBeLessThanOrEqual(5_100);
      expect(atReal[1] - atReal[0]).toBeGreaterThanOrEqual(5_000);
      expect(atReal[1] - atReal[0]).toBeLessThanOrEqual(5_600);
    });
  }
});
