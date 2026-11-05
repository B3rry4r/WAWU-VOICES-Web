"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnswerCard, Button, Sheet, Toast, REACTIONS } from "@/components/vx";
import { ShareSheet } from "@/features/share";
import { makePlayer } from "@/lib/audio-ref/player";
import { answerCardProps } from "@/lib/feed-format";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, ReactionKind } from "@/lib/api/talk";
import { failText, isOutOfPosts, outOfPostsHref, uuidKey } from "./lib";

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
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[var(--z-toast)] mx-auto flex max-w-[420px] justify-center" role="status">
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
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  useEffect(() => setA(answer), [answer]);
  const upd = (n: Answer) => { setA(n); onChange?.(n); };
  const back = () => setRev((r) => r + 1);

  async function play(start: boolean) {
    if (!a.clip) return;
    if (!start) { audio.current?.pause(); return; }
    try {
      if (!audio.current) {
        const p = await api.getPlayUrl(a.clip.id);
        audio.current = makePlayer(p.url);
        void api.countListen(a.id);
      }
      await audio.current.play();
    } catch (e) {
      push(failText(e), "danger");
    }
  }

  async function like() {
    const was = a.iLiked;
    try {
      const s = was ? await api.unlikeAnswer(a.id) : await api.likeAnswer(a.id);
      upd({ ...a, iLiked: s.iLiked, likeCount: s.likeCount });
    } catch (e) {
      back();
      push(failText(e), "danger");
    }
  }

  async function react(name: string) {
    const kind = kindOf(name);
    const removing = a.myReaction === kind;
    try {
      const s = removing ? await api.removeReaction(a.id) : await api.setReaction(a.id, kind, uuidKey());
      upd({ ...a, myReaction: s.myReaction, reactionCount: s.reactionCount, reactionBreakdown: s.reactionBreakdown });
      if (s.charge && !removing) onAllowance?.({ balanceMilli: s.charge.balanceMilli, ...(s.charge.usedFreeDaily && freeReactions !== undefined ? { freeReactionsLeftToday: Math.max(0, freeReactions - 1) } : {}) });
    } catch (e) {
      back();
      if (isOutOfPosts(e)) push("You have used your free reactions today. A reaction now costs 0.1 unit, and you have no units. Get Voice Units to react.", "info");
      else push(failText(e), "danger");
    }
  }

  function capture(e: MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest("button");
    if (!el) return;
    const label = el.getAttribute("aria-label") ?? "";
    const stop = () => { e.stopPropagation(); e.preventDefault(); };
    if (el.classList.contains("vx-player__play")) { void play(label.startsWith("Play")); return; }
    if (el.classList.contains("vx-player__speed")) return;
    if (label.startsWith("Like,")) { void like(); return; }
    if (label === "React" || label.startsWith("Your reaction")) {
      if (!signedIn) { stop(); push("Sign in to react. Reading, listening and liking stay free.", "info"); }
      return;
    }
    if (el.classList.contains("vx-react__btn")) {
      if (!signedIn) { stop(); return; }
      void react(el.querySelectorAll("span")[1]?.textContent ?? "");
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
          key={rev}
          {...props}
          reaction={nameOf(a.myReaction)}
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
