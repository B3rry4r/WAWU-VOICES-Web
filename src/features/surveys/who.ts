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
 * Once stale a tab stays stale until it is reloaded.
 */
export function useSameWho(who: string | null | undefined): { stale: boolean; check: () => boolean } {
  const [stale, setStale] = useState(false);
  const whoRef = useRef(who);
  whoRef.current = who;
  const check = useCallback((): boolean => {
    if (whoRef.current === undefined) return true;
    if (whoNow() === whoRef.current) return true;
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
