"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnswerCard, Button, Sheet, Toast, REACTIONS } from "@/components/vx";
import { ShareSheet } from "@/features/share";
import { answerCardProps } from "@/lib/feed-format";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, ReactionKind } from "@/lib/api/talk";
import { failText, isOutOfPosts, outOfPostsHref, unitsText, useClipPlayback, uuidKey } from "./lib";

/** The 402 on a reaction: the price and balance come from the server's details, never from this file. */
function outOfReactionsText(e: unknown): string {
  const d = (e instanceof ApiError ? e.details : undefined) as { costMilli?: number; balanceMilli?: number } | undefined;
  const cost = typeof d?.costMilli === "number" ? ` Another reaction costs ${unitsText(d.costMilli)}${typeof d.balanceMilli === "number" ? `, and your balance is ${unitsText(d.balanceMilli)}` : ""}.` : "";
  return `You have used your free reactions today.${cost} Get Voice Units to react.`;
}

const kindOf = (name: string): ReactionKind => name.toUpperCase().replace(/[ -]/g, "_") as ReactionKind;
const nameOf = (kind: string | null): string | undefined => REACTIONS.find((r) => kindOf(r.name) === kind)?.name;

/** A small message at the bottom of the screen, gone after a few seconds. */
export function useToast(): [ReactNode, (text: string, tone?: "success" | "info" | "danger") => void] {
  const [t, setT] = useState<{ text: string; tone: "success" | "info" | "danger"; n: number } | null>(null);
  const push = useCallback((text: string, tone: "success" | "info" | "danger" = "info") => setT({ text, tone, n: Date.now() }), []);
  useEffect(() => {
    if (!t) return undefined;
    const h = setTimeout(() => setT(null), 4500);
    return () => clearTimeout(h);
  }, [t]);
  const node = t ? (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[var(--z-toast)] mx-auto flex max-w-[420px] justify-center">
      <Toast tone={t.tone}>{t.text}</Toast>
    </div>
  ) : null;
  return [node, push];
}

/** The share sheet from the reach screens (W8b), opened for a question or a voice. */
export function useShareSheet(): [ReactNode, (type: "QUESTION" | "ANSWER", id: string) => void] {
  const [t, setT] = useState<{ type: "QUESTION" | "ANSWER"; id: string } | null>(null);
  const node = t ? <ShareSheet objectType={t.type} objectId={t.id} onClose={() => setT(null)} /> : null;
  return [node, (type, id) => setT({ type, id })];
}

interface Props {
  answer: Answer;
  signedIn: boolean;
  freeReactions?: number;
  onAllowance?: (a: Partial<Allowances>) => void;
  push: (t: string, tone?: "success" | "info" | "danger") => void;
  /** Where the replies live. Omit on the thread page itself. */
  threadHref?: string;
  unfolded?: boolean;
  compact?: boolean;
  /** Called after a change the parent may want (reaction or like totals). */
  onChange?: (a: Answer) => void;
}

/** The design system card wired to the real API. The card keeps its own toggles, so a click is read in the capture phase,
 *  sent to the API, and a refusal remounts the card from the server's truth. (A request: AnswerCard onLike / onReact / onReply / onShare / onMore props.) */
export function TalkCard({ answer, signedIn, freeReactions, onAllowance, push, threadHref, unfolded, compact, onChange }: Props) {
  const router = useRouter();
  const [a, setA] = useState(answer);
  const [rev, setRev] = useState(0);
  const [more, setMore] = useState(false);
  const [shareNode, share] = useShareSheet();
  const liked = useRef(answer.iLiked);
  const likeBusy = useRef(false);
  const onFail = useCallback((e: unknown) => push(failText(e), "danger"), [push]);
  const onStart = useCallback(() => { void api.countListen(answer.id); }, [answer.id]);
  const clip = useClipPlayback(answer.clip?.id, onFail, onStart);
  useEffect(() => setA(answer), [answer]);
  useEffect(() => { liked.current = a.iLiked; }, [a.iLiked]);
  const upd = (n: Answer) => { setA(n); onChange?.(n); };
  const back = () => setRev((r) => r + 1);

  /** One like request at a time; the next action comes from the ref (what the server last said), never from a stale render. */
  async function like() {
    if (likeBusy.current) return;
    likeBusy.current = true;
    const was = liked.current;
    try {
      const s = was ? await api.unlikeAnswer(a.id) : await api.likeAnswer(a.id);
      liked.current = s.iLiked;
      upd({ ...a, iLiked: s.iLiked, likeCount: s.likeCount });
      if (s.iLiked === was) back();
    } catch (e) {
      back();
      push(failText(e), "danger");
    } finally {
      likeBusy.current = false;
    }
  }

  // Reactions: the card toggles itself on every tap, so what it shows is always the last tap. The last tap is queued
  // and sent once the one in flight settles, so the server's row ends equal to the screen.
  const shown = useRef<string | null>(answer.myReaction);
  const confirmed = useRef<string | null>(answer.myReaction);
  const reactBusy = useRef(false);
  async function flush() {
    if (reactBusy.current) return;
    reactBusy.current = true;
    try {
      while (shown.current !== confirmed.current) {
        const target = shown.current;
        const s = target === null ? await api.removeReaction(a.id) : await api.setReaction(a.id, target as ReactionKind, uuidKey());
        confirmed.current = s.myReaction;
        setA((cur) => {
          const n = { ...cur, myReaction: s.myReaction, reactionCount: s.reactionCount, reactionBreakdown: s.reactionBreakdown };
          onChange?.(n);
          return n;
        });
        if (s.charge && target !== null) onAllowance?.({ balanceMilli: s.charge.balanceMilli, ...(s.charge.usedFreeDaily && freeReactions !== undefined ? { freeReactionsLeftToday: Math.max(0, freeReactions - 1) } : {}) });
      }
    } catch (e) {
      shown.current = confirmed.current;
      back();
      if (isOutOfPosts(e)) push(outOfReactionsText(e), "info");
      else push(failText(e), "danger");
    } finally {
      reactBusy.current = false;
    }
  }
  function react(name: string) {
    const kind = kindOf(name);
    shown.current = shown.current === kind ? null : kind;
    void flush();
  }

  function capture(e: MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest("button");
    if (!el) return;
    const label = el.getAttribute("aria-label") ?? "";
    const stop = () => { e.stopPropagation(); e.preventDefault(); };
    if (el.classList.contains("vx-player__play")) { void clip.toggle(label.startsWith("Play")); return; }
    if (el.classList.contains("vx-player__speed")) return;
    if (label.startsWith("Like,")) { if (likeBusy.current) { stop(); return; } void like(); return; }
    if (label === "React" || label.startsWith("Your reaction")) {
      if (!signedIn) { stop(); push("Sign in to react. Reading, listening and liking stay free.", "info"); }
      return;
    }
    if (el.classList.contains("vx-react__btn")) {
      if (!signedIn) { stop(); return; }
      react(el.querySelectorAll("span")[1]?.textContent ?? "");
      return;
    }
    if (label.startsWith("Reply,")) { stop(); router.push(threadHref ?? `/q/${a.questionId}/a/${a.id}`); return; }
    if (label === "Share") { stop(); share("ANSWER", a.id); return; }
    if (label.startsWith("More:")) { stop(); setMore(true); }
  }

  const props = answerCardProps(a);
  const handle = a.author?.handle;
  return (
    <>
      <div onClickCapture={capture}>
        <AnswerCard
          key={`${rev}-${clip.rev}`}
          {...props}
          reaction={nameOf(confirmed.current)}
          freeReactions={freeReactions}
          unfolded={unfolded}
          compact={compact}
        />
      </div>
      {shareNode}
      {more ? (
        <Sheet title="This voice" onClose={() => setMore(false)}>
          <div className="grid gap-2 pb-2">
            <Button variant="secondary" size="l" block icon="flag" href={`/report/ANSWER/${a.id}`}>Report this voice</Button>
            <Button variant="secondary" size="l" block icon="link" onClick={() => { setMore(false); share("ANSWER", a.id); }}>Copy link</Button>
            {handle && !a.isMine ? (
              <Button
                variant="secondary"
                size="l"
                block
                icon="user"
                onClick={async () => {
                  setMore(false);
                  if (!signedIn) return push("Sign in to block someone.", "info");
                  try { await api.blockUser(a.author!.id); push(`You blocked @${handle}.`, "success"); } catch (e) { push(failText(e), "danger"); }
                }}
              >
                {`Block @${handle}`}
              </Button>
            ) : null}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

export { outOfPostsHref };
