"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useStartWatch } from "@/components/feed/useLoad";

/**
 * V-PRELAUNCH round 2: a share page for a question that has not opened is drawn by the server. This draws nothing; at the opening
 * (and when the person comes back to the page) it asks the server to draw the page again, the same way every other screen turns live.
 */
export function ShareOpening({ opensAt }: { opensAt: number }) {
  const router = useRouter();
  const fetchedAt = useRef(Date.now());
  useStartWatch(
    opensAt,
    () => new Promise<void>((done) => {
      fetchedAt.current = Date.now();
      router.refresh();
      setTimeout(done, 2_000);
    }),
    fetchedAt,
  );
  return null;
}
