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
  const reporter = createListenReporter((p) => reportListen(answerId, p, typeof document !== "undefined" && document.visibilityState === "hidden"));
  const note = () => {
    const t = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    if (t > reached) reached = t;
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    reporter.progress(reached, dur > 0 && reached >= dur * 0.9);
  };
  const ended = () => {
    if (Number.isFinite(el.duration) && el.duration > 0) reached = Math.max(reached, el.duration);
    note();
  };
  const hide = () => { if (document.visibilityState === "hidden") note(); };
  el.addEventListener("pause", note);
  el.addEventListener("ended", ended);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", note);
  return () => {
    el.removeEventListener("pause", note);
    el.removeEventListener("ended", ended);
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("pagehide", note);
    reporter.dispose();
  };
}
