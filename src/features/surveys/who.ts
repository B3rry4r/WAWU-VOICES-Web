"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { currentOwner } from "@/features/speak/draft";
import { sessionStorage } from "@/lib/auth/session-storage";

/** Who is signed in right now, read from the session in storage (another tab may have changed it): the token's subject, "unknown" for a token without one, null when nobody is. */
export function whoNow(): string | null {
  return sessionStorage.getToken() ? (currentOwner() ?? "unknown") : null;
}

/**
 * A tab knows who it belongs to. `who` is the person the tab loaded for (undefined until it has loaded).
 * `check()` is called right before every survey write: true when the person is still the same, otherwise it flips the tab to stale and returns false (nothing is sent).
 * The same comparison runs when the tab becomes visible again, on focus, on a page restore and on the browser's storage event, so the screen changes before the person types.
 * The tab is stale for as long as the two differ (if the same person is back, it carries on); the notice itself reads who is signed in live.
 */
export function useSameWho(who: string | null | undefined): { stale: boolean; check: () => boolean } {
  const [stale, setStale] = useState(false);
  const whoRef = useRef(who);
  whoRef.current = who;
  const check = useCallback((): boolean => {
    if (whoRef.current === undefined) return true;
    if (whoNow() === whoRef.current) {
      setStale(false);
      return true;
    }
    setStale(true);
    return false;
  }, []);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const onAny = () => void check();
    window.addEventListener("storage", onAny);
    window.addEventListener("focus", onAny);
    window.addEventListener("pageshow", onAny);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onAny);
      window.removeEventListener("focus", onAny);
      window.removeEventListener("pageshow", onAny);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);
  return { stale, check };
}

/** Who is signed in now, kept current while a notice is on screen (another tab can sign out and then sign in again). */
export function useWhoNow(): string | null {
  const [now, setNow] = useState<string | null>(() => whoNow());
  useEffect(() => {
    const on = () => setNow(whoNow());
    window.addEventListener("storage", on);
    window.addEventListener("focus", on);
    document.addEventListener("visibilitychange", on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener("focus", on);
      document.removeEventListener("visibilitychange", on);
    };
  }, []);
  return now;
}
