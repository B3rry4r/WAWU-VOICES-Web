"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NetworkError } from "@/lib/api/client";
import { getMyVerification } from "@/lib/api/verify";
import type { VerificationState } from "@/lib/api/verify";
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

/**
 * Is the signed-in person verified (V-46)? true or false once known; null for a guest and while it loads. A failed read is
 * also null: the screen then lets the server decide, so a bad connection never locks anybody out.
 */
export function useVerified(signedIn: boolean | null): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    if (signedIn !== true) {
      setV(null);
      return undefined;
    }
    let live = true;
    getMyVerification().then(
      (s) => live && setV(s.verified),
      () => live && setV(null),
    );
    return () => {
      live = false;
    };
  }, [signedIn]);
  return v;
}

/** The words for a failed call: the server's own when it explained, else a plain line. */
export function failWords(e: unknown): string {
  if (e instanceof NetworkError) return "Could not reach VOICES. Check your connection and try again.";
  if (e instanceof ApiError && e.explained && e.message) {
    const f = (e.details as { fields?: { message?: unknown }[] } | undefined)?.fields;
    const lines = Array.isArray(f) ? f.map((x) => (typeof x?.message === "string" ? x.message : "")).filter(Boolean) : [];
    return lines.length ? lines.join(" ") : e.message;
  }
  return "Something went wrong. Try again.";
}

/** Loads my verification and keeps it fresh: `set` takes the state an upload or a send answered with. */
export function useMyVerification(enabled: boolean) {
  const [state, setState] = useState<VerificationState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    setError(null);
    getMyVerification().then(
      (s) => mine === seq.current && setState(s),
      (e: unknown) => mine === seq.current && setError(e),
    );
  }, []);
  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  return { state, error, reload: load, set: setState };
}
