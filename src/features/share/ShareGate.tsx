"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStartWatch } from "@/components/feed/useLoad";
import { Logo } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { probeShareExtras, probeSharePage } from "@/lib/api/reach";
import type { SharePage } from "@/lib/api/reach";
import { noteServerTime, serverNow } from "@/lib/api/server-clock";
import { questionStart } from "@/lib/feed-format";
import { ShareGone } from "./ShareGone";
import { SharePageView } from "./SharePageView";
import type { ShareExtras } from "./SharePageView";

type View =
  | { kind: "server" } // what the server drew (`children`): a question that has not opened
  | { kind: "waiting" } // the server could not draw the page: "Opening. One moment."
  | { kind: "page"; page: SharePage; extras: ShareExtras; now: number } // drawn here from what the browser read
  | { kind: "gone" };

/** "Opening. One moment." for a share page the server could not draw. Same frame as the other share pages. */
function ShareWaiting() {
  return (
    <div className="min-h-dvh bg-bg text-ink" data-testid="share-waiting">
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-3 dt:px-8 dt:py-5">
        <Logo height={36} />
      </header>
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 pb-16 pt-16 text-center" role="status" aria-live="polite">
        <h1 className="m-0 font-display text-display-l">Opening.</h1>
        <p className="m-0 text-body text-ink-2">One moment.</p>
      </main>
    </div>
  );
}

/**
 * The one place that decides whether a share page is waiting, live or gone.
 *
 * - `children` (the server's drawing of a question that has not opened) stay on the screen until the browser has the open page.
 * - No `children` (the server could not draw the page at all, or its render threw): the waiting state.
 * From the opening instant (or at once, for the waiting state) it asks the API from the browser, the same call the server makes,
 * on the steps every other screen uses (a spread of 0 to 5 seconds, then 5, 15, 30, then every 60 seconds). The answer decides:
 * open: the page is drawn here from that answer, no server render in the path; link gone (404, 400): the not-found page;
 * anything else (500, 502, 503, no answer, offline, still not open): nothing changes on the screen and the next step asks again.
 * Nothing is asked before the instant for a page the server drew. Once the page is open nothing more is asked.
 * `serverNow` is the server's own time when it drew the page: the device clock is corrected from it until an answer from the API says better.
 */
export function ShareGate({ code, opensAt = null, serverNow: drawnAt, children }: { code: string; opensAt?: number | null; serverNow?: number; children?: ReactNode }) {
  const [view, setView] = useState<View>(children !== undefined && children !== null ? { kind: "server" } : { kind: "waiting" });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fetchedAt = useRef(Date.now());
  const waitFrom = useRef(serverNow());
  useEffect(() => { if (drawnAt !== undefined) noteServerTime(drawnAt); }, [drawnAt]);

  const at = view.kind === "server" ? opensAt : view.kind === "waiting" ? waitFrom.current : view.kind === "page" ? (view.page.question ? questionStart(view.page.question) : null) : null;

  useStartWatch(
    at,
    async () => {
      fetchedAt.current = Date.now();
      let page: SharePage;
      try {
        page = await probeSharePage(code);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) { setView({ kind: "gone" }); return; }
        throw e; // 500, 502, 503, hang, offline: the screen stays and the watch asks again on its next step
      }
      const stillClosed = !!page.question && questionStart(page.question) !== null;
      if (stillClosed && viewRef.current.kind === "server") throw new Error("not open yet"); // the server's drawing is as good as this answer
      const extras: ShareExtras = stillClosed ? {} : await probeShareExtras(page);
      setView({ kind: "page", page, extras, now: Date.now() });
    },
    fetchedAt,
  );

  if (view.kind === "server") return <>{children}</>;
  if (view.kind === "gone") return <ShareGone />;
  if (view.kind === "page") return <SharePageView page={view.page} now={view.now} extras={view.extras} />;
  return <ShareWaiting />;
}
