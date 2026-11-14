"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { monotonicNow, serverNow } from "@/lib/api/server-clock";

export type Load<T> = { state: "loading" } | { state: "error"; error: ApiError | Error; retry: () => void } | { state: "ready"; data: T };

function same(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
}

/** After the instant, while the API still says "not open": try again after 5, 15, 30 seconds, then every 60 (the API may answer from a cache for about 5 seconds). */
export const RETRY_MS = [5_000, 15_000, 30_000, 60_000];
/** A crowd must not call the API in the same second: each page waits 0 to this long after the instant. */
export const SPREAD_MS = 5_000;
/** A page that comes back to the front with data older than this fetches again. */
export const STALE_MS = 30_000;
/** Coming back to the tab (visible or focus) asks the server at most this often. */
export const BACK_MIN_MS = 5_000;
/** A long timer is never trusted alone: wake at least this often and read the real clock. */
const WAKE_MS = 15_000;

/**
 * Loads once on the client (the session lives in the browser), with a retry.
 * The result is kept with the inputs it was loaded for: on the render right after the inputs change (before the
 * effect has run) the answer is "loading", never the previous inputs' data, so no caller ever reads a result that
 * belongs to another query.
 *
 * V-PRELAUNCH round 2, `pending`: when given, it says from the loaded data the instant (epoch ms) at which something on
 * the screen is waiting to start (a question or a week that is SCHEDULED), or null when nothing is. While it is not
 * null this hook asks again by itself, without touching what is on the screen:
 *   - at that instant plus a random 0 to 5 seconds, then 5, 15, 30 and every 60 seconds while the API still says
 *     "not open" (and only while the page is visible);
 *   - when the page comes back (visible, focus, online, pageshow) if the instant has passed or the data is older than 30 seconds.
 * Every wake reads the real clock. Nothing waiting, nothing scheduled: one load and no more requests.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], pending?: (data: T) => number | null): Load<T> {
  const [held, setHeld] = useState<{ deps: unknown[]; res: Load<T> }>({ deps, res: { state: "loading" } });
  const [n, setN] = useState(0);
  const retry = useCallback(() => setN((x) => x + 1), []);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const fetchedAt = useRef(0);
  useEffect(() => {
    let live = true;
    setHeld({ deps, res: { state: "loading" } });
    fn().then(
      (data) => {
        if (!live) return;
        fetchedAt.current = Date.now();
        setHeld({ deps, res: { state: "ready", data } });
      },
      (error: Error) => live && setHeld({ deps, res: { state: "error", error, retry } }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);

  const ready = same(held.deps, deps) && held.res.state === "ready" ? held.res.data : undefined;
  const at = ready !== undefined && pendingRef.current ? pendingRef.current(ready) : null;
  useStartWatch(
    at,
    () =>
      fnRef.current().then((data) => {
        fetchedAt.current = Date.now();
        setHeld((cur) => (same(cur.deps, deps) ? { deps, res: { state: "ready", data } } : cur));
      }),
    fetchedAt,
  );
  return same(held.deps, deps) ? held.res : { state: "loading" };
}

/** Two clocks that differ by more than this are two different guesses of the opening instant. */
export const AGREE_MS = 10_000;
/** The device clock and the monotonic clock may differ by this much between two looks before it counts as a step of the device clock. */
export const STEP_MS = 30_000;
/** While the two guesses disagree and the later one has not come, ask at most this often (the earlier guess may be the wrong one). */
export const LIGHT_MS = 60_000;

/**
 * The clock-and-wake part of `useLoad`, for anything that waits for an instant (`at`, epoch ms on the server's clock; null = nothing to wait for).
 * `refresh` asks again and resolves when the answer is in. `fetchedAt` is when the screen's data was last fetched (device clock).
 *
 * Two guesses of the opening instant are kept: by the device clock (`Date.now()`) and by the server-corrected clock (`serverNow()`,
 * carried by `performance.now()`, so a step of the device clock does not move it). It starts asking at the EARLIER of the two
 * (plus the 0 to 5 second spread). While the guesses disagree by more than 10 seconds and the later one has not come, it asks at
 * most once a minute (an early ask is harmless: only the server's answer opens the page); at the later guess it asks again and
 * from there keeps to the retry steps. Waits are measured on the monotonic clock. A step of the device clock (the two clocks
 * disagreeing by more than 30 seconds since the last look) makes it plan again; returning to the tab asks when the device
 * clock is earlier than the last fetch.
 */
export function useStartWatch(at: number | null, refresh: () => Promise<unknown>, fetchedAt: { current: number }): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (at === null) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight = false;
    let tries = 0; // asks made in the current run of steps
    let lastAsk = -Infinity; // monotonic clock
    let lateAsked = false; // the ask at the later guess has been made
    const spread = Math.random() * SPREAD_MS;
    let lookWall = Date.now();
    let lookMono = monotonicNow();
    const visible = () => document.visibilityState !== "hidden";
    /** Has the device clock stepped since the last look? Plans again if so. */
    const stepped = (): boolean => {
      const w = Date.now();
      const m = monotonicNow();
      const off = Math.abs(w - lookWall - (m - lookMono));
      lookWall = w;
      lookMono = m;
      if (off <= STEP_MS) return false;
      lateAsked = false;
      return true;
    };
    const ask = (): boolean => {
      if (inflight || !live) return false;
      inflight = true;
      lastAsk = monotonicNow();
      const done = () => { inflight = false; }; // on a failure keep what is on the screen; the next wake tries again
      refreshRef.current().then(done, done);
      return true;
    };
    /** Milliseconds to the instant on each guess: the earlier and the later. */
    const lead = (plus: number) => {
      const a = at + plus - Date.now();
      const b = at + plus - serverNow();
      return { early: Math.min(a, b), late: Math.max(a, b), split: Math.abs(a - b) > AGREE_MS };
    };
    const wake = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!live) return;
      stepped();
      const { early, late, split } = lead(spread);
      if (early > 0) {
        timer = setTimeout(wake, Math.min(early, WAKE_MS));
        return;
      }
      if (!visible()) return; // asleep or in the background: the visibility event wakes us
      const light = split && late > 0; // only the earlier guess has come
      if (split && !light && !lateAsked) { lateAsked = true; tries = 0; } // the later guess has come: ask now, then the retry steps
      const gap = (n: number) => (light ? LIGHT_MS : RETRY_MS[Math.min(n - 1, RETRY_MS.length - 1)]);
      const now = monotonicNow();
      const age = Date.now() - fetchedAt.current;
      // Only the earlier guess has come and the data was fetched a moment ago (the page just loaded): that fetch is the first ask.
      if (light && tries === 0 && age >= 0 && age < LIGHT_MS) { tries = 1; lastAsk = now - age; }
      let next = tries === 0 ? now : lastAsk + gap(tries);
      if (now >= next) {
        // An ask still in flight (a slow answer) does not use up a step: the step comes when it has ended.
        if (ask()) {
          tries += 1;
          next = monotonicNow() + gap(tries);
        }
      }
      const wait = Math.max(250, Math.min(next - monotonicNow(), WAKE_MS));
      timer = setTimeout(wake, light ? Math.min(wait, Math.max(250, late)) : wait);
    };
    const back = (throttle: boolean) => () => {
      if (!visible()) return;
      const wall = Date.now();
      const didStep = stepped();
      const { late, split } = lead(spread);
      const pastIt = at - serverNow() <= 0 || at - wall <= 0; // either clock says it has come
      const light = split && late > 0;
      // The device clock earlier than the last fetch means it went backwards: the age of the data cannot be read from it.
      const stale = wall - fetchedAt.current >= STALE_MS || wall < fetchedAt.current || didStep;
      if ((pastIt || stale) && !(throttle && monotonicNow() - lastAsk < (light ? LIGHT_MS : BACK_MIN_MS))) {
        if (pastIt) tries = Math.max(tries, light ? 2 : 1);
        ask();
      }
      wake();
    };
    const backView = back(true);
    const backNow = back(false);
    wake();
    document.addEventListener("visibilitychange", backView);
    window.addEventListener("focus", backView);
    window.addEventListener("online", backNow);
    window.addEventListener("pageshow", backNow);
    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", backView);
      window.removeEventListener("focus", backView);
      window.removeEventListener("online", backNow);
      window.removeEventListener("pageshow", backNow);
    };
  }, [at, fetchedAt]);
}
