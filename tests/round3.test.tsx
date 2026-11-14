// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
}));

import { ShareOpening } from "@/features/share/ShareOpening";
import { ShareSheet } from "@/features/share/ShareSheet";
import { useStartWatch } from "@/components/feed/useLoad";
import { noteServerDate, noteServerTime, resetServerClock, serverNow } from "@/lib/api/server-clock";
import { apiFetch } from "@/lib/api/client";

const OPENS = Date.parse("2026-11-14T23:00:00Z");
const q = (open: boolean) => ({ id: "q9", status: open ? "LIVE" : "SCHEDULED", startsAt: new Date(OPENS).toISOString(), text: "x" });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe("H1: a waiting share page is never replaced while the API is failing", () => {
  let mode: "500" | "502" | "503" | "hang" | "offline" | "404" | "scheduled" | "open" = "500";
  let asks = 0;
  beforeEach(() => {
    vi.useFakeTimers({ now: OPENS - 30_000 });
    refresh.mockClear(); asks = 0; resetServerClock();
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: RequestInit) => {
      asks += 1;
      if (mode === "offline") return Promise.reject(new TypeError("offline"));
      if (mode === "hang") return new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
      if (mode === "500" || mode === "502" || mode === "503") return Promise.resolve(json({ error: { code: "X", message: "no" } }, Number(mode)));
      if (mode === "404") return Promise.resolve(json({ error: { code: "NOT_FOUND", message: "no" } }, 404));
      return Promise.resolve(json({ code: "c1", question: q(mode === "open") }));
    }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  for (const m of ["500", "502", "503", "hang", "offline", "scheduled"] as const) {
    it(`${m}: no page refresh while it lasts, then the page is drawn again once the question is open`, async () => {
      mode = m;
      render(<ShareOpening code="c1" opensAt={OPENS} serverNow={Date.now()} />);
      await tick(29_000);
      expect(asks).toBe(0);
      await tick(40_000);
      expect(asks).toBeGreaterThan(1);
      expect(refresh).not.toHaveBeenCalled();
      mode = "open";
      await tick(61_000);
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  }
  it("a link that is really gone (404) is handed to the server, which says so", async () => {
    mode = "404";
    render(<ShareOpening code="c1" opensAt={OPENS} serverNow={Date.now()} />);
    await tick(40_000);
    expect(refresh).toHaveBeenCalled();
  });
  it("offline at the instant: back online, the page is drawn again at once", async () => {
    mode = "offline";
    render(<ShareOpening code="c1" opensAt={OPENS} serverNow={Date.now()} />);
    await tick(40_000);
    mode = "open";
    act(() => { window.dispatchEvent(new Event("online")); });
    await tick(300);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("L-a: the device clock is corrected from the API's Date header", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); resetServerClock(); });
  it("reads the offset, and Age when a cache held the answer", () => {
    vi.useFakeTimers({ now: 1_000_000_000_000 });
    noteServerDate(new Date(1_000_000_600_000).toUTCString(), null);
    expect(serverNow()).toBe(1_000_000_600_000);
    noteServerDate(new Date(1_000_000_600_000).toUTCString(), "20");
    expect(serverNow()).toBe(1_000_000_620_000);
    noteServerDate("not a date");
    expect(serverNow()).toBe(1_000_000_620_000); // unreadable: unchanged
    noteServerDate(null);
    expect(serverNow()).toBe(1_000_000_620_000);
  });
  it("apiFetch keeps the newest Date header", async () => {
    vi.useFakeTimers({ now: OPENS });
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 200, { date: new Date(OPENS + 600_000).toUTCString() })));
    await apiFetch("/x");
    expect(serverNow()).toBe(OPENS + 600_000);
  });
  function Watch({ onAsk }: { onAsk: () => void }) {
    useStartWatch(OPENS, async () => onAsk(), { current: 0 });
    return null;
  }
  for (const [name, skew] of [["right", 0], ["10 minutes slow", -600_000], ["10 minutes fast", 600_000], ["3 hours slow", -10_800_000]] as const) {
    it(`device clock ${name}: asks within 0 to 5 s of the real instant and never before`, async () => {
      const real = OPENS - 20_000;
      vi.useFakeTimers({ now: real + skew });
      noteServerDate(new Date(real).toUTCString()); // the header was read now
      let askedAtReal = -1;
      const start = real;
      const onAsk = () => { if (askedAtReal < 0) askedAtReal = start + (Date.now() - (start + skew)); };
      render(<Watch onAsk={onAsk} />);
      await tick(19_000);
      expect(askedAtReal).toBe(-1);
      await tick(6_000);
      expect(askedAtReal).toBeGreaterThanOrEqual(OPENS);
      expect(askedAtReal - OPENS).toBeLessThanOrEqual(5_100);
    });
  }
});

describe("L-g: coming back to the tab asks at most once every 5 seconds", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); resetServerClock(); });
  it("focus and visibility events inside 5 seconds make one ask", async () => {
    vi.useFakeTimers({ now: OPENS + 120_000 });
    let n = 0;
    function W() { useStartWatch(OPENS, async () => { n += 1; }, { current: Date.now() }); return null; }
    render(<W />);
    await tick(10);
    const base = n;
    for (let i = 0; i < 5; i++) { act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); }); await tick(500); }
    expect(n - base).toBeLessThanOrEqual(1);
  });
});

describe("M1: the refused share sheet", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (m: string) => ({ matches: false, media: m, addEventListener: () => undefined, removeEventListener: () => undefined }));
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "QUESTION_NOT_OPEN", message: "no" } }, 409)));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it("shows only the message and one button; none of the card words, greyed buttons or free line; copies /q/<id>", async () => {
    const write = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: write } });
    window.history.pushState({}, "", "/home-ish?x=1");
    render(<ShareSheet objectType="QUESTION" objectId="q7" notOpen onClose={() => undefined} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const t = document.body.textContent ?? "";
    expect(t).toContain("We cannot make a share link for this question yet.");
    expect(t).not.toContain("A card and a link go out.");
    expect(t).not.toContain("Sharing is free.");
    expect(screen.queryByRole("button", { name: "WhatsApp" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Share to" })).toBeNull();
    const buttons = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(buttons.filter((b) => !/close/i.test(String(b)))).toEqual(["Copy the question’s address"]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Copy the question/ })); });
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/q/q7`);
    expect(String(write.mock.calls[0])).not.toContain("home-ish");
  });
});
