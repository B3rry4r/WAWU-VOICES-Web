import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createListenReporter, REPORT_GAP_MS, type ListenProgress } from "@/features/talk/listen-report";
import { VISITOR_COOKIE, visitorId } from "@/lib/api/visitor";

/** LISTEN-1 (LS2): the player reports progress on pause, on end and on leaving the page, at most every 10 seconds, and never blocks playback. */
describe("listen reporter", () => {
  let t = 0;
  const sent: ListenProgress[] = [];
  const make = (send: (p: ListenProgress) => unknown = (p) => { sent.push(p); }) => createListenReporter(send, { now: () => t });
  beforeEach(() => { vi.useFakeTimers(); t = 1_000_000; sent.length = 0; });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) => { t += ms; vi.advanceTimersByTime(ms); };

  it("reports a pause at once, and the end when it comes", () => {
    const r = make();
    r.progress(4.2, false); // pause
    expect(sent).toEqual([{ secondsPlayed: 4, finished: false }]);
    advance(REPORT_GAP_MS + 1);
    r.progress(10, true); // end
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ secondsPlayed: 10, finished: true });
  });

  it("sends at most one report per 10 seconds and holds the furthest point for the next slot", () => {
    const r = make();
    r.progress(3, false);
    advance(2_000);
    r.progress(5, false);
    advance(2_000);
    r.progress(7, false);
    expect(sent).toHaveLength(1); // still inside the 10 seconds
    advance(REPORT_GAP_MS - 4_000);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ secondsPlayed: 7, finished: false });
    // never more than one in any 10 second span
    advance(3_000);
    r.progress(9, false);
    advance(3_000);
    r.progress(9.5, true);
    expect(sent).toHaveLength(2);
    advance(REPORT_GAP_MS);
    expect(sent).toHaveLength(3);
    expect(sent[2].finished).toBe(true);
  });

  it("the pause that comes just before the end does not make a second request", () => {
    const r = make();
    r.progress(9.8, true); // pause at the end of the clip
    r.progress(10, true); // ended
    advance(REPORT_GAP_MS * 2);
    expect(sent).toEqual([{ secondsPlayed: 10, finished: true }]);
  });

  it("sends nothing when nothing new was played, or at second zero", () => {
    const r = make();
    r.progress(0, false);
    r.progress(0.2, false);
    expect(sent).toHaveLength(0);
    r.progress(6, false);
    advance(REPORT_GAP_MS + 1);
    r.progress(6, false);
    r.progress(2, false); // a seek back is not progress
    advance(REPORT_GAP_MS * 2);
    expect(sent).toHaveLength(1);
  });

  it("playback never waits for a report: a slow, rejected or throwing send changes nothing for the caller", async () => {
    const never = make(() => new Promise<void>(() => undefined));
    expect(() => never.progress(5, false)).not.toThrow();
    const rejects = make(() => Promise.reject(new Error("offline")));
    expect(() => rejects.progress(5, false)).not.toThrow();
    const throws = make(() => { throw new Error("boom"); });
    expect(() => throws.progress(5, false)).not.toThrow();
    // progress() returns nothing to await: it is synchronous
    expect(never.progress(6, false)).toBeUndefined();
    await Promise.resolve(); // an unhandled rejection would fail the run here
  });

  it("a held report is dropped when the player goes away", () => {
    const r = make();
    r.progress(3, false);
    advance(1_000);
    r.progress(5, false);
    r.dispose();
    advance(REPORT_GAP_MS * 2);
    expect(sent).toHaveLength(1);
  });
});

describe("visitor id cookie", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  /** A cookie jar that behaves like document.cookie for one cookie. */
  const jar = (blocked = false) => {
    let stored = "";
    return {
      get cookie() { return stored; },
      set cookie(v: string) { if (!blocked) stored = v.split(";")[0]; },
    };
  };

  it("makes a random id once and keeps it; it holds nothing readable", () => {
    const j = jar();
    const a = visitorId(j, true)!;
    expect(a).toMatch(UUID);
    expect(visitorId(j, true)).toBe(a);
    expect(j.cookie).toBe(`${VISITOR_COOKIE}=${a}`);
    expect(visitorId(jar(), true)).not.toBe(a);
  });

  it("sets a year-long first-party cookie, Secure on https", () => {
    const raw: string[] = [];
    const j = { cookie: "", } as { cookie: string };
    Object.defineProperty(j, "cookie", { get: () => "", set: (v: string) => { raw.push(v); } });
    visitorId(j, true);
    expect(raw[0]).toMatch(/Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/);
  });

  it("returns nothing when cookies are blocked, or there is no browser", () => {
    expect(visitorId(jar(true), true)).toBeUndefined();
    expect(visitorId(undefined)).toBeUndefined();
  });
});

describe("the report request", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it("POSTs secondsPlayed and finished to the listen route with the visitor id, and a failure is silent", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let stored = "";
    vi.stubGlobal("document", { get cookie() { return stored; }, set cookie(v: string) { stored = v.split(";")[0]; } });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => { calls.push({ url, init }); return Promise.reject(new TypeError("offline")); });
    vi.resetModules();
    const { reportListen } = await import("@/lib/api/talk");
    const aid = "0190a000-0000-7000-8000-000000000001";
    await expect(reportListen(aid, { secondsPlayed: 7, finished: false })).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(new RegExp(`/answers/${aid}/listen$`));
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ secondsPlayed: 7, finished: false });
    const headers = calls[0].init.headers as Headers;
    expect(headers.get("X-Visitor-Id")).toBe(stored.split("=")[1]);
  });
});
