import { countListen, reportListen } from "@/lib/api/talk";
import { createListenReporter } from "./listen-report";

/**
 * Listen tracking for a player that plays an ANSWER's clip (LISTEN-1). Counts a start, then reports how far the
 * person got on pause, on end and on leaving the page, at most one report per 10 seconds, fire and forget. Returns a
 * function that stops it. Players of anything that is not an answer (a reply, a Voice Card) never call this.
 */
export function trackListen(answerId: string, el: HTMLAudioElement): () => void {
  void countListen(answerId);
  let reached = 0;
  const reporter = createListenReporter((p, leaving) => reportListen(answerId, p, leaving));
  /** `leaving` is the page going away: the request then carries keepalive so the browser still sends it. */
  const note = (leaving = false) => {
    const t = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    if (t > reached) reached = t;
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    // lead ruling LS, 6 Nov: pause, end, hide, pagehide and unmount send at once, inside the 10 s window too
    reporter.progress(reached, dur > 0 && reached >= dur * 0.9, true, leaving);
  };
  const ended = () => {
    if (Number.isFinite(el.duration) && el.duration > 0) reached = Math.max(reached, el.duration);
    note();
  };
  const hide = () => { if (document.visibilityState === "hidden") note(true); };
  const pagehide = () => note(true);
  const onPause = () => note();
  el.addEventListener("pause", onPause);
  el.addEventListener("ended", ended);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", pagehide);
  return () => {
    note(true); // the player is going away (in-app navigation): send the last stretch now
    el.removeEventListener("pause", onPause);
    el.removeEventListener("ended", ended);
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("pagehide", pagehide);
    reporter.dispose();
  };
}
