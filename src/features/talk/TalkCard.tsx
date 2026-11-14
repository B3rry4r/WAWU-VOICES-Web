"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnswerCard, Button, Sheet, Toast, REACTIONS } from "@/components/vx";
import { ShareSheet } from "@/features/share";
import { answerCardProps } from "@/lib/feed-format";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, ReactionKind } from "@/lib/api/talk";
import { MoodChip } from "@/features/mood/MoodChip";
import { DeleteDialog, EditSheet } from "./OwnPost";
import { failText, isOutOfPosts, outOfPostsHref, unitsText, useClipPlayback, uuidKey } from "./lib";

/** The 402 on a reaction: the price and balance come from the server's details, never from this file. */
function outOfReactionsText(e: unknown): string {
  const d = (e instanceof ApiError ? e.details : undefined) as { costMilli?: number; balanceMilli?: number } | undefined;
  const cost = typeof d?.costMilli === "number" ? ` Another reaction costs ${unitsText(d.costMilli)}${typeof d.balanceMilli === "number" ? `, and your balance is ${unitsText(d.balanceMilli)}` : ""}.` : "";
  return `You have used your free reactions today.${cost} Get tokens to react.`;
}

const kindOf = (name: string): ReactionKind => name.toUpperCase().replace(/[ -]/g, "_") as ReactionKind;
const nameOf = (kind: string | null): string | undefined => REACTIONS.find((r) => kindOf(r.name) === kind)?.name;

/** A small message at the bottom of the screen, gone after a few seconds. */
/** A toast may carry one action (lead ruling WF-6, 6 Nov, A-L6: block shows "Undo" for a few seconds). */
export interface ToastAction { label: string; run: () => void }
export type PushToast = (text: string, tone?: "success" | "info" | "danger", action?: ToastAction) => void;

export function useToast(): [ReactNode, PushToast] {
  const [t, setT] = useState<{ text: string; tone: "success" | "info" | "danger"; n: number; action?: ToastAction } | null>(null);
  const push = useCallback<PushToast>((text, tone = "info", action) => setT({ text, tone, n: Date.now(), action }), []);
  useEffect(() => {
    if (!t) return undefined;
    const h = setTimeout(() => setT(null), t.action ? 6000 : 4500);
    return () => clearTimeout(h);
  }, [t]);
  const node = t ? (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-[var(--z-toast)] mx-auto flex max-w-[420px] justify-center">
      <span className={t.action ? "pointer-events-auto" : undefined}>
        <Toast tone={t.tone} action={t.action?.label} onAction={t.action ? () => { const a = t.action!; setT(null); a.run(); } : undefined}>{t.text}</Toast>
      </span>
    </div>
  ) : null;
  return [node, push];
}

/** The share sheet from the reach screens (W8b), opened for a question or a voice. */
export function useShareSheet(): [ReactNode, (type: "QUESTION" | "ANSWER", id: string, opts?: { notOpen?: boolean }) => void] {
  const [t, setT] = useState<{ type: "QUESTION" | "ANSWER"; id: string; notOpen?: boolean } | null>(null);
  const node = t ? <ShareSheet objectType={t.type} objectId={t.id} notOpen={t.notOpen} onClose={() => setT(null)} /> : null;
  return [node, (type, id, opts) => setT({ type, id, notOpen: opts?.notOpen })];
}

interface Props {
  answer: Answer;
  signedIn: boolean;
  freeReactions?: number;
  onAllowance?: (a: Partial<Allowances>) => void;
  push: PushToast;
  /** Where the replies live. Omit on the thread page itself. */
  threadHref?: string;
  unfolded?: boolean;
  compact?: boolean;
  className?: string;
  /** A list may draw the card inside its own frame (a tap target). Only the card itself goes in it, never the sheets, and a hidden card draws no frame. */
  frame?: (card: ReactNode) => ReactNode;
  /** Called after a change the parent may want (reaction or like totals). */
  onChange?: (a: Answer) => void;
  /** Called after I delete my own voice, so the page can leave it. */
  onDeleted?: (id: string) => void;
}

/** People blocked in this tab (WF-7b): their cards leave every list at once, and Undo brings them back. A reload reads the server's own list. */
const blockedHere = new Set<string>();
const blockListeners = new Set<() => void>();
let blockedVersion = 0;
function setBlockedHere(id: string, on: boolean) {
  if (on) blockedHere.add(id); else blockedHere.delete(id);
  blockedVersion++;
  blockListeners.forEach((f) => f());
}
function useBlockedHere(id: string | undefined): boolean {
  useSyncExternalStore(
    (f) => { blockListeners.add(f); return () => { blockListeners.delete(f); }; },
    () => blockedVersion,
    () => 0,
  );
  return !!id && blockedHere.has(id);
}

/** The design system card wired to the real API. The card is controlled (liked, likeCount, reaction, reactionCounts, trayOpen, playing):
 *  it shows what the server last said, a tap is sent through onLike / onReact / onReply / onShare / onMore, and a refusal puts the props back. */
export function TalkCard({ answer, signedIn, freeReactions, onAllowance, push, threadHref, unfolded, compact, className, frame, onChange, onDeleted }: Props) {
  const router = useRouter();
  const [a, setA] = useState(answer);
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gone, setGone] = useState(false);
  const [tray, setTray] = useState(false);
  // lead ruling WF, 6 Nov (held): Escape closes the reaction tray.
  useEffect(() => {
    if (!tray) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTray(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tray]);
  const [playing, setPlaying] = useState(false);
  const [shareNode, share] = useShareSheet();
  const likeBusy = useRef(false);
  const onFail = useCallback((e: unknown) => push(failText(e), "danger"), [push]);
  const clip = useClipPlayback(answer.clip?.id, onFail, undefined, answer.id);
  useEffect(() => setA(answer), [answer]);
  const authorBlocked = useBlockedHere(answer.author?.id);
  // The clip reset signal (the voice ended, another took over, or it could not play): the player goes back to its start.
  useEffect(() => { setPlaying(false); }, [clip.rev]);
  const upd = (n: Answer) => { setA(n); onChange?.(n); };

  /** One like request at a time. The heart and count move at once and are put back if the server refuses. */
  async function like(next: boolean) {
    if (likeBusy.current) return;
    likeBusy.current = true;
    const before = a;
    setA({ ...a, iLiked: next, likeCount: Math.max(0, a.likeCount + (next ? 1 : -1)) });
    try {
      const s = next ? await api.likeAnswer(a.id) : await api.unlikeAnswer(a.id);
      upd({ ...a, iLiked: s.iLiked, likeCount: s.likeCount });
    } catch (e) {
      setA(before);
      push(failText(e), "danger");
    } finally {
      likeBusy.current = false;
    }
  }

  // Reactions: what the card shows is always the last tap. The last tap is queued and sent once the one in flight settles,
  // so the server's row ends equal to the screen.
  const [shown, setShown] = useState<string | null>(answer.myReaction);
  const shownRef = useRef<string | null>(answer.myReaction);
  const confirmed = useRef<string | null>(answer.myReaction);
  const reactBusy = useRef(false);
  const show = (v: string | null) => { shownRef.current = v; setShown(v); };
  async function flush() {
    if (reactBusy.current) return;
    reactBusy.current = true;
    try {
      while (shownRef.current !== confirmed.current) {
        const target = shownRef.current;
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
      show(confirmed.current);
      if (isOutOfPosts(e)) push(outOfReactionsText(e), "info");
      else push(failText(e), "danger");
    } finally {
      reactBusy.current = false;
    }
  }
  function react(name: string | null) {
    if (!signedIn) return;
    const kind = name === null ? null : kindOf(name);
    show(kind === shownRef.current ? null : kind);
    void flush();
  }

  const props = answerCardProps(a);
  const { reactions: _drop, ...card } = props;
  void _drop;
  // "Read transcript" appears only when the transcript is READY (the server may send text for a PENDING or FAILED one).
  const tx = a.clip?.transcript;
  const voice = card.voice ? { ...card.voice, transcript: tx && tx.status === "READY" && tx.text ? tx.text : undefined } : undefined;
  const counts: Record<string, number> = {};
  for (const r of a.reactionBreakdown) { const n = nameOf(r.kind); if (n) counts[n] = r.count; }
  const handle = a.author?.handle;
  if (authorBlocked || gone) return null;
  const cardEl = (
      <AnswerCard
        key={clip.rev}
        {...card}
        voice={voice}
        liked={a.iLiked}
        likeCount={a.likeCount}
        onLike={(next) => void like(next)}
        reaction={nameOf(shown)}
        reactionCounts={counts}
        onReact={(name) => react(name)}
        trayOpen={tray}
        onTrayChange={(open) => {
          if (open && !signedIn) { push("Sign in to react. Reading, listening and liking stay free.", "info"); return; }
          setTray(open);
        }}
        playing={playing}
        onPlay={() => { setPlaying(true); void clip.toggle(true); }}
        onPause={() => { setPlaying(false); void clip.toggle(false); }}
        onReply={() => router.push(threadHref ?? `/q/${a.questionId}/a/${a.id}`)}
        onShare={() => share("ANSWER", a.id)}
        onMore={() => setMore(true)}
        freeReactions={freeReactions}
        unfolded={unfolded}
        compact={compact}
        className={className}
      />
  );
  return (
    <>
      {/* LCH-02: the word sits above the card, as the MoodAnswers board draws it. */}
      {(() => {
        const body = a.mood ? <div className="grid gap-[6px]"><MoodChip mood={a.mood} className="justify-self-start" />{cardEl}</div> : cardEl;
        return frame ? frame(body) : body;
      })()}
      {shareNode}
      {editing ? <EditSheet answer={a} onClose={() => setEditing(false)} onSaved={(n) => { upd(n); setEditing(false); push("Your post is updated.", "success"); }} /> : null}
      {deleting ? (
        <DeleteDialog
          noun="voice"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            try { await api.deleteAnswer(a.id); } catch (e) { push(failText(e), "danger"); setDeleting(false); return; }
            setDeleting(false);
            setGone(true);
            push("Your post is deleted.", "success");
            onDeleted?.(a.id);
          }}
        />
      ) : null}
      {more ? (
        <Sheet title="This voice" onClose={() => setMore(false)}>
          <div className="grid gap-2 pb-2">
            {a.isMine ? (
              <>
                {a.kind === "TEXT" ? <Button variant="secondary" size="l" block icon="message-square" onClick={() => { setMore(false); setEditing(true); }}>Edit this post</Button> : null}
                <Button variant="secondary" size="l" block icon="trash-2" onClick={() => { setMore(false); setDeleting(true); }}>Delete this post</Button>
              </>
            ) : <Button variant="secondary" size="l" block icon="flag" href={`/report/ANSWER/${a.id}`}>Report this voice</Button>}
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
                  try {
                    const uid = a.author!.id;
                    await api.blockUser(uid);
                    setBlockedHere(uid, true);
                    push(`You blocked @${handle}.`, "success", { label: "Undo", run: () => { api.unblockUser(uid).then(() => { setBlockedHere(uid, false); push(`@${handle} is unblocked.`, "info"); }, (e) => push(failText(e), "danger")); } });
                  } catch (e) { push(failText(e), "danger"); }
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
