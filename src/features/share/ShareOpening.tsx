"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStartWatch } from "@/components/feed/useLoad";
import { ApiError } from "@/lib/api/client";
import { probeSharePage } from "@/lib/api/reach";
import { noteServerTime } from "@/lib/api/server-clock";
import { questionStart } from "@/lib/feed-format";

/**
 * A share page for a question that has not opened is drawn by the server. This draws nothing. At the opening (and when the
 * person comes back to the page) it asks the API from the browser, the same call the server render makes, and only when the
 * answer says the question is open (or the link is gone) does it ask the server to draw the page again. While the API fails,
 * hangs or still says "not open", the coming-up page stays on the screen and the next ask comes on the same steps as every
 * other screen (5, 15, 30, then every 60 seconds).
 * `serverNow` is the server's own time when it drew the page: the device clock is corrected from it until an answer from the API says better.
 */
export function ShareOpening({ code, opensAt, serverNow }: { code: string; opensAt: number; serverNow: number }) {
  const router = useRouter();
  const fetchedAt = useRef(Date.now());
  useEffect(() => { noteServerTime(serverNow); }, [serverNow]);
  useStartWatch(
    opensAt,
    async () => {
      fetchedAt.current = Date.now();
      let open = false;
      try {
        const page = await probeSharePage(code);
        open = !page.question || questionStart(page.question) === null;
      } catch (e) {
        // The link is really gone: let the server draw its own answer. Every other failure (500, 502, 503, no answer, offline) leaves the page as it is.
        open = e instanceof ApiError && (e.status === 404 || e.status === 400);
      }
      if (!open) throw new Error("not open yet"); // the watch asks again on its next step
      router.refresh();
      await new Promise<void>((done) => setTimeout(done, 2_000));
    },
    fetchedAt,
  );
  return null;
}
