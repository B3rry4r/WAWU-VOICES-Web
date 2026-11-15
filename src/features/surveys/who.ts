"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { signedInAsSomeoneElse, type Owner } from "@/features/speak/draft";

/**
 * The survey screen follows the same rule as the record screen (draft.ts): the tab's person is `openedFor()`, read once when the screen loads.
 * `check()` is called right before every survey write, restore and clear: true when nobody else is signed in, otherwise the tab turns stale
 * (OTHER_TAB_NOTE is shown) and nothing is sent. The same comparison runs when the tab becomes visible again, on focus, on a page restore and on the storage event.
 */
export function useSameWho(who: Owner | undefined): { stale: boolean; check: () => boolean } {
  const [stale, setStale] = useState(false);
  const whoRef = useRef(who);
  whoRef.current = who;
  const check = useCallback((): boolean => {
    if (whoRef.current === undefined) return true;
    const other = signedInAsSomeoneElse(whoRef.current);
    setStale(other);
    return !other;
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
