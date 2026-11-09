"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NetworkError } from "@/lib/api/client";
import { BUSY_WORDS, isBusy } from "@/lib/api/busy";
import { sessionStorage } from "@/lib/auth/session-storage";

/** null until the browser has been read (the server render knows nothing about the session). */
export function useSignedIn(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    setV(sessionStorage.getToken() !== null);
    const on = () => setV(sessionStorage.getToken() !== null);
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  return v;
}

export type Loaded<T> = { state: "loading" } | { state: "error"; error: unknown } | { state: "ready"; data: T };

/** Load once when `enabled`, again on `reload`. Ignores answers that arrive after the page moved on. */
export function useLoad<T>(fn: () => Promise<T>, enabled = true): { result: Loaded<T>; reload: () => void } {
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    setResult({ state: "loading" });
    fnRef.current().then(
      (data) => live && setResult({ state: "ready", data }),
      (error: unknown) => live && setResult({ state: "error", error }),
    );
    return () => {
      live = false;
    };
  }, [enabled, n]);
  return { result, reload: useCallback(() => setN((x) => x + 1), []) };
}

/** A sentence for a failed read. The server's own words only when it explained itself. */
export function readErrorText(e: unknown): string {
  if (e instanceof NetworkError) return "Could not reach VOICES. Check your connection and try again.";
  if (isBusy(e)) return BUSY_WORDS;
  if (e instanceof ApiError && e.explained && e.message) return e.message;
  return "Something went wrong. Try again.";
}

/** True from the desktop breakpoint (1024 px). False on the first render, then the real answer. */
export function useDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const q = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return d;
}
