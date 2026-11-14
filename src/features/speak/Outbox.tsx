"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner, Button } from "@/components/vx";
import { isSignedIn } from "@/lib/api/auth";
import * as api from "@/lib/api/speak";
import { clearDraft, draftIsStale, loadDraft, openedFor, OTHER_TAB_NOTE, signedInAsSomeoneElse, STALE_NOTE, type Draft, type Owner } from "./draft";
import { isSending, planFor, sendKeptRecording, type SendPlan } from "./outbox";
import { isMoodQuestion } from "@/features/mood/mood";
import { publishedFromLink } from "@/features/share/share-visit";

/**
 * Recordings made offline send themselves, or ask first (V-FIX-D, addendum 7.7). It looks when the app opens and when the connection
 * comes back. A recording the person already tapped Send on (it is `queued` on this device) is:
 *  - sent by itself when a free post covers it, with "Sending your saved voice" on screen while it goes;
 *  - offered with its price and one Send button otherwise, never charged without the person seeing the cost;
 *  - kept, with its button (Try again, or its price again), when a send fails;
 *  - removed with a plain note once it is more than 7 days old.
 * A recording the person has only listened to, and not sent, is never touched. The record screen shows its own take, so this stays away from it.
 * Two tabs never send one recording: one sends, the other waits and shows the result.
 */
type View =
  | { kind: "offer"; draft: Draft; plan: SendPlan; error?: string }
  | { kind: "sending"; reply?: boolean }
  | { kind: "finish"; draft: Draft }
  | { kind: "note"; tone: "info" | "success" | "danger"; text: string; href?: string; hrefLabel?: string };

const secondsText = (s: number) => `${Math.max(1, Math.round(s))} seconds`;

export function Outbox() {
  const pathname = usePathname() ?? "/";
  const [view, setView] = useState<View | null>(null);
  const running = useRef(false);
  // The person this tab is for (see openedFor), read at the start of each look and held for that whole pass: load, send and clear all
  // name this person, and none of them acts if someone else has signed in since.
  const owner = useRef<Owner>(openedFor());
  // Who a banner on screen was opened for. Closing it removes that person's recording only, never one kept by someone who signed in since.
  const shownFor = useRef<Owner>(null);
  const onSpeak = /(^|\/)speak(\/|$)/.test(pathname);

  const send = useCallback(async (d: Draft, plan: SendPlan) => {
    setView({ kind: "sending", reply: !!d.reply });
    const who = owner.current;
    const r = await sendKeptRecording(d, plan.tokenId, async () => (await loadDraft(who))?.key === d.key, async () => {
      publishedFromLink(d.shareCode);
      await clearDraft(who);
    }, async () => (await loadDraft(who))?.key === d.key);
    if (r.ok && r.answerId === null) {
      setView(null); // another tab posted it: it says so, this one says nothing
    } else if (r.ok) {
      setView(r.replyTo
        ? { kind: "note", tone: "success", text: "Your saved voice reply was posted.", href: `/q/${r.questionId}/a/${r.replyTo}`, hrefLabel: "See it" }
        : { kind: "note", tone: "success", text: "Your saved voice was posted.", href: r.answerId ? `/q/${r.questionId}/posted?a=${r.answerId}` : undefined, hrefLabel: "See it" });
    } else if (signedInAsSomeoneElse(who)) {
      setView({ kind: "note", tone: "danger", text: OTHER_TAB_NOTE });
    } else if (r.reason === "offline") {
      setView(null); // stays kept; the next time the connection is back it is tried again
    } else if (r.reason === "needs_tokens") {
      setView({ kind: "note", tone: "danger", text: r.message ?? "You need more tokens to send your saved recording.", href: "/units/buy?from=%2F", hrefLabel: "Get tokens" });
    } else {
      shownFor.current = who;
      setView({ kind: "offer", draft: r.draft ?? d, plan, error: r.message ?? "We could not send it. It is kept on this device." });
    }
  }, []);

  const look = useCallback(async () => {
    if (running.current || onSpeak || !isSignedIn()) return;
    running.current = true;
    try {
      owner.current = openedFor();
      const who = owner.current;
      if (signedInAsSomeoneElse(who)) return; // another person signed in on another tab: their recordings are theirs to send, from their own tab
      const d = await loadDraft(who);
      if (!d) return;
      if (draftIsStale(d)) {
        await clearDraft(who);
        setView({ kind: "note", tone: "info", text: STALE_NOTE });
        return;
      }
      if (!d.queued || isSending(d.key) || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      const [question, config, allowance] = await Promise.all([api.getQuestion(d.questionId), api.getPublicConfig(), api.getAllowance()]);
      if (question.status !== "LIVE") {
        await clearDraft(who);
        setView({ kind: "note", tone: "info", text: "The question for your saved recording has closed, so it was not sent and has been removed." });
        return;
      }
      if (!d.reply && isMoodQuestion(question) && !d.mood) {
        shownFor.current = who;
        setView({ kind: "finish", draft: d });
        return;
      }
      const plan = planFor(d, { allowance, config });
      if (plan.free) await send(d, plan);
      else { shownFor.current = who; setView({ kind: "offer", draft: d, plan }); }
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
    // Closing a banner opened for A while B has kept a recording: B's is left alone, and the banner says why.
    if (signedInAsSomeoneElse(shownFor.current)) { setView({ kind: "note", tone: "danger", text: OTHER_TAB_NOTE }); return; }
    await clearDraft(shownFor.current);
    setView(null);
  }

  if (!view || onSpeak) return null;
  return (
    <div className="fixed inset-x-0 bottom-[96px] z-40 mx-auto grid max-w-[560px] gap-2 px-4 dt:bottom-4 dt:left-auto dt:right-4 dt:mx-0 dt:w-[560px]" data-testid="outbox">
      {view.kind === "offer" ? (
        <Banner tone={view.error ? "danger" : "info"} title={view.draft.reply ? "A voice reply is waiting" : "A recording is waiting"} onClose={() => void remove()}>
          <span className="block">{view.error ?? `Saved while you were offline, ${secondsText(view.draft.seconds)}.`}</span>
          <span className="mt-2 block">
            <Button variant="secondary" size="s" onClick={() => void send(view.draft, view.plan)}>{view.error && view.plan.free ? "Try again" : view.plan.label}</Button>
          </span>
        </Banner>
      ) : view.kind === "sending" ? (
        <Banner tone="info" title={view.reply ? "Sending your saved voice reply" : "Sending your saved voice"}>Keep this page open until it is posted.</Banner>
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
