"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { serverNow } from "@/lib/api/server-clock";

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

/**
 * The clock-and-wake part of `useLoad`, for anything that waits for an instant (`at`, epoch ms; null = nothing to wait for).
 * `refresh` asks again and resolves when the answer is in. `fetchedAt` is when the screen's data was last fetched.
 */
export function useStartWatch(at: number | null, refresh: () => Promise<unknown>, fetchedAt: { current: number }): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (at === null) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight = false;
    let tries = 0; // asks made after the instant
    let lastAsk = 0; // device clock
    const spread = Math.random() * SPREAD_MS;
    const visible = () => document.visibilityState !== "hidden";
    const ask = (): boolean => {
      if (inflight || !live) return false;
      inflight = true;
      lastAsk = Date.now();
      const done = () => { inflight = false; }; // on a failure keep what is on the screen; the next wake tries again
      refreshRef.current().then(done, done);
      return true;
    };
    // The opening instant is compared on the server's clock (corrected from the API's Date header); waits between asks use the device clock.
    const wake = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (!live) return;
      const due = at + spread;
      const toDue = due - serverNow();
      if (toDue > 0) {
        timer = setTimeout(wake, Math.min(toDue, WAKE_MS));
        return;
      }
      if (!visible()) return; // asleep or in the background: the visibility event wakes us
      const now = Date.now();
      let next = tries === 0 ? now : lastAsk + RETRY_MS[Math.min(tries - 1, RETRY_MS.length - 1)];
      if (now >= next) {
        // An ask still in flight (a slow answer) does not use up a step: the step comes when it has ended.
        if (ask()) {
          tries += 1;
          next = Date.now() + RETRY_MS[Math.min(tries - 1, RETRY_MS.length - 1)];
        }
      }
      timer = setTimeout(wake, Math.max(250, Math.min(next - Date.now(), WAKE_MS)));
    };
    const back = (throttle: boolean) => () => {
      if (!visible()) return;
      const now = Date.now();
      const pastIt = serverNow() >= at;
      if ((pastIt || now - fetchedAt.current >= STALE_MS) && !(throttle && now - lastAsk < BACK_MIN_MS)) {
        if (pastIt) tries = Math.max(tries, 1);
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
