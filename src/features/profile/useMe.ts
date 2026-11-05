"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getMe, type Me } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";

export type MeState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error"; error: ApiError | Error }
  | { status: "needs-profile"; me: Me }
  | { status: "ready"; me: Me };

/** The signed-in person from GET /me. `guest` when there is no session or the API says 401. */
export function useMe(): { state: MeState; reload: () => void; setMe: (m: Me) => void } {
  const [state, setState] = useState<MeState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    if (!isSignedIn()) { setState({ status: "guest" }); return; }
    setState({ status: "loading" });
    getMe().then(
      (me) => { if (live) setState(me.profileComplete && me.profile ? { status: "ready", me } : { status: "needs-profile", me }); },
      (e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) setState({ status: "guest" });
        else setState({ status: "error", error: e instanceof Error ? e : new Error("failed") });
      },
    );
    return () => { live = false; };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setMe = useCallback((me: Me) => setState({ status: "ready", me }), []);
  return { state, reload, setMe };
}
