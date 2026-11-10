"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";

export type Load<T> = { state: "loading" } | { state: "error"; error: ApiError | Error; retry: () => void } | { state: "ready"; data: T };

function same(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
}

/**
 * Loads once on the client (the session lives in the browser), with a retry.
 * The result is kept with the inputs it was loaded for: on the render right after the inputs change (before the
 * effect has run) the answer is "loading", never the previous inputs' data, so no caller ever reads a result that
 * belongs to another query.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): Load<T> {
  const [held, setHeld] = useState<{ deps: unknown[]; res: Load<T> }>({ deps, res: { state: "loading" } });
  const [n, setN] = useState(0);
  const retry = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    let live = true;
    setHeld({ deps, res: { state: "loading" } });
    fn().then(
      (data) => live && setHeld({ deps, res: { state: "ready", data } }),
      (error: Error) => live && setHeld({ deps, res: { state: "error", error, retry } }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return same(held.deps, deps) ? held.res : { state: "loading" };
}
