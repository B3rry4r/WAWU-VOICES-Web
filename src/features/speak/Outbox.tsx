"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/vx";
import { isSignedIn } from "@/lib/api/auth";
import * as api from "@/lib/api/speak";
import { clearDraft, draftIsStale, loadDraft, STALE_NOTE, type Draft } from "./draft";
import { isSending, planFor, sendKeptRecording, type SendPlan } from "./outbox";
import { isMoodQuestion } from "@/features/mood/mood";

/**
 * Recordings made offline send themselves, or ask first (V-FIX-D, addendum 7.7). It looks when the app opens and when the connection comes
 * back. A recording the person already tapped Send on (it is `queued` on this device) is:
 *  - sent by itself when a free post covers it;
 *  - offered with its price and one Send button otherwise, never charged without the person seeing the cost;
 *  - removed with a plain note once it is more than 7 days old.
 * A recording the person has only listened to, and not sent, is never touched. The record screen shows its own take, so this stays away from it.
 */
type View =
  | { kind: "offer"; draft: Draft; plan: SendPlan; seconds: number }
  | { kind: "finish"; draft: Draft }
  | { kind: "note"; tone: "info" | "success" | "danger"; text: string; href?: string; hrefLabel?: string };

const secondsText = (s: number) => `${Math.max(1, Math.round(s))} seconds`;

export function Outbox() {
  const pathname = usePathname() ?? "/";
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const onSpeak = /(^|\/)speak(\/|$)/.test(pathname);

  const send = useCallback(async (d: Draft, plan: SendPlan) => {
    setBusy(true);
    const r = await sendKeptRecording(d, plan.tokenId);
    setBusy(false);
    if (r.ok) {
      await clearDraft();
      setView({ kind: "note", tone: "success", text: "Your saved voice was posted.", href: `/q/${r.questionId}/posted?a=${r.answerId}`, hrefLabel: "See it" });
    } else if (r.reason === "offline") {
      setView(null); // stays kept; the next time the connection is back it is tried again
    } else if (r.reason === "needs_tokens") {
      setView({ kind: "note", tone: "danger", text: r.message ?? "You need more tokens to send your saved recording.", href: "/units/buy?from=%2F", hrefLabel: "Get tokens" });
    } else if (r.reason === "failed") {
      setView({ kind: "note", tone: "danger", text: r.message ?? "We could not send your saved recording. It is kept on this device. Try again in a moment." });
    }
  }, []);

  const look = useCallback(async () => {
    if (running.current || onSpeak || !isSignedIn()) return;
    running.current = true;
    try {
      const d = await loadDraft();
      if (!d) return;
      if (draftIsStale(d)) {
        await clearDraft();
        setView({ kind: "note", tone: "info", text: STALE_NOTE });
        return;
      }
      if (!d.queued || isSending(d.key) || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      const [question, config, allowance] = await Promise.all([api.getQuestion(d.questionId), api.getPublicConfig(), api.getAllowance()]);
      if (question.status !== "LIVE") {
        await clearDraft();
        setView({ kind: "note", tone: "info", text: "The question for your saved recording has closed, so it was not sent and has been removed." });
        return;
      }
      if (isMoodQuestion(question) && !d.mood) {
        setView({ kind: "finish", draft: d });
        return;
      }
      const plan = planFor(d, { allowance, config });
      if (plan.free) await send(d, plan);
      else setView({ kind: "offer", draft: d, plan, seconds: d.seconds });
    } catch {
      /* offline again, or the server is busy: the recording is kept and this runs again on the next open or reconnect */
    } finally {
      running.current = false;
    }
  }, [onSpeak, send]);

  useEffect(() => {
    void look();
    const again = () => void look();
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [look, pathname]);

  async function remove() {
    await clearDraft();
    setView(null);
  }

  if (!view || onSpeak) return null;
  return (
    <div className="fixed inset-x-0 bottom-[96px] z-40 mx-auto grid max-w-[560px] gap-2 px-4 dt:bottom-4 dt:left-auto dt:right-4 dt:mx-0 dt:w-[560px]" data-testid="outbox">
      {view.kind === "offer" ? (
        <Banner tone="info" title="A recording is waiting" action={view.plan.label} onAction={() => void send(view.draft, view.plan)} onClose={() => void remove()}>
          {`You recorded ${secondsText(view.seconds)} while you were offline. `}{busy ? "Sending it now." : "It goes out when you tap Send. The price is on the button."}
        </Banner>
      ) : view.kind === "finish" ? (
        <Banner tone="info" title="A recording is waiting" onClose={() => void remove()}>
          <Link href={`/speak?q=${encodeURIComponent(view.draft.questionId)}`} className="underline">Pick your word and send it</Link>
        </Banner>
      ) : (
        <Banner tone={view.tone === "danger" ? "danger" : "info"} onClose={() => setView(null)}>
          {view.text}
          {view.href ? <> <Link href={view.href} className="underline">{view.hrefLabel}</Link></> : null}
        </Banner>
      )}
    </div>
  );
}
