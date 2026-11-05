"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";

export type Load<T> = { state: "loading" } | { state: "error"; error: ApiError | Error; retry: () => void } | { state: "ready"; data: T };

/** Loads once on the client (the session lives in the browser), with a retry. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): Load<T> {
  const [res, setRes] = useState<Load<T>>({ state: "loading" });
  const [n, setN] = useState(0);
  const retry = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    let live = true;
    setRes({ state: "loading" });
    fn().then(
      (data) => live && setRes({ state: "ready", data }),
      (error: Error) => live && setRes({ state: "error", error, retry }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return res;
}
