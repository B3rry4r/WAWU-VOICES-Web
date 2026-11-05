"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Icon, NewsTag, ReactionTray, REACTIONS } from "@/components/vx";
import { short, fmt } from "@/components/vx/helpers";
import { likeAnswer, setReaction } from "@/lib/api/news";
import type { NewsAnswer, ReactionKind } from "@/lib/api/news";
import { ApiError } from "@/lib/api/client";
import { ago } from "@/features/results/shared";
import { ClipPlayer } from "./ClipPlayer";
import { ShareSheet } from "@/features/share";
import { SERVED } from "./served";
import { kindOf } from "./tags";

const KINDS: ReactionKind[] = ["POWERFUL", "WILD", "RELATABLE", "FUNNY", "SURPRISING", "SAD", "WELL_SAID", "THOUGHT_PROVOKING", "EXACTLY", "DISAGREE"];
const nameOf = (k: ReactionKind | null) => (k ? REACTIONS[KINDS.indexOf(k)]?.name ?? null : null);
const kindFromName = (n: string | null): ReactionKind | null => { const i = REACTIONS.findIndex((r) => r.name === n); return i < 0 ? null : KINDS[i]; };

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

/** One news post in the Newsroom, with live like and react. Share and the more menu are not here until their screens are built. */
export function NewsCard({ post, signedIn, repliesHref, open }: { post: NewsAnswer; signedIn: boolean; repliesHref: string; open?: boolean }) {
  const [liked, setLiked] = useState(post.iLiked);
  const [likes, setLikes] = useState(post.likeCount);
  const [mine, setMine] = useState<ReactionKind | null>(post.myReaction);
  const [total, setTotal] = useState(post.reactionCount);
  const [top, setTop] = useState(post.reactionBreakdown);
  const [tray, setTray] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tx, setTx] = useState(!!open);
  const [sharing, setSharing] = useState(false);
  const a = post.author;
  const reacted = REACTIONS[KINDS.indexOf(mine as ReactionKind)];
  const emojis = [...top].sort((x, y) => y.count - x.count).slice(0, 3).map((b) => REACTIONS[KINDS.indexOf(b.kind)]?.e).filter(Boolean);
  const transcript = post.clip?.transcript?.status === "READY" ? post.clip.transcript.text : null;

  async function like() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      const s = await likeAnswer(post.id, next, signedIn);
      setLiked(s.iLiked);
      setLikes(s.likeCount);
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      setNote("Could not save your like. Try again.");
    }
  }

  async function react(name: string | null) {
    setTray(false);
    setNote(null);
    try {
      const s = await setReaction(post.id, kindFromName(name), newKey());
      setMine(s.myReaction);
      setTotal(s.reactionCount);
      setTop(s.reactionBreakdown);
    } catch (e) {
      setNote(e instanceof ApiError && e.explained ? e.message : "Could not save your reaction. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {post.categoryName ? <span className="text-[12px] font-bold uppercase leading-4 tracking-wide text-ink-2">{post.categoryName}</span> : null}
      <article className="vx-answer" aria-label={"News from " + (a ? a.handle : "an anonymous poster")}>
        <div className="vx-answer__head">
          <Avatar name={a ? a.displayName ?? a.handle : "Anonymous"} src={a?.avatarUrl ?? undefined} />
          <div className="vx-answer__who">
            <span className="vx-answer__name">{a ? "@" + a.handle : "Anonymous"}</span>
            <span className="vx-answer__time">{ago(post.createdAt) + (a?.state ? " · " + a.state : "")}</span>
          </div>
        </div>
        {post.news ? <div className="vx-answer__labels"><NewsTag kind={kindOf(post.news.tag)} /></div> : null}
        {post.clip && SERVED.clipPlay ? <ClipPlayer clipId={post.clip.id} durationMs={post.clip.durationMs} peaks={post.clip.peaks} /> : null}
        {post.body ? <p className="vx-answer__text">{post.body}</p> : null}
        {transcript && !SERVED.clipPlay ? <p className="vx-answer__transcript"><b>Transcript</b>{transcript}</p> : null}
        {transcript && SERVED.clipPlay ? (
          <div className="vx-answer__tx">
            <button type="button" className="vx-link" aria-expanded={tx} onClick={() => setTx(!tx)}>
              <Icon name="captions" size={18} />
              {tx ? "Hide transcript" : "Read transcript"}
            </button>
            <div className={"vx-answer__unfold" + (tx ? " is-open" : "")}>
              <div><p className="vx-answer__transcript"><b>Transcript</b>{transcript}</p></div>
            </div>
          </div>
        ) : null}
        {total > 0 ? (
          <div className="vx-answer__sum">
            <span className="e" aria-hidden="true">{emojis.join(" ")}</span>
            {fmt(total) + " reactions"}
          </div>
        ) : null}
        <div className="vx-answer__actions">
          {tray ? <div className="vx-answer__tray"><ReactionTray value={nameOf(mine)} onChange={react} /></div> : null}
          {SERVED.likes ? (
            <button type="button" className="vx-act" aria-pressed={liked} aria-label={"Like, " + likes + " likes"} onClick={like}>
              <Icon name="heart" size={20} fill={liked} />
              {short(likes)}
            </button>
          ) : (
            <span className="vx-act" aria-label={likes + " likes"}><Icon name="heart" size={20} />{short(likes)}</span>
          )}
          {signedIn && SERVED.reactions ? (
            <button type="button" className={"vx-act" + (reacted ? " vx-act--reacted" : "")} aria-expanded={tray} aria-label={reacted ? "Your reaction: " + reacted.name + ". Change" : "React"} onClick={() => setTray(!tray)}>
              {reacted ? <span className="vx-act__emoji" aria-hidden="true">{reacted.e}</span> : <Icon name="smile-plus" size={20} />}
              {reacted ? reacted.name : "React"}
            </button>
          ) : null}
          {SERVED.replies ? (
            <Link href={repliesHref} className="vx-act" aria-label={"Replies, " + post.replyCount}>
              <Icon name="message-circle" size={20} />
              {short(post.replyCount)}
            </Link>
          ) : (
            <span className="vx-act" aria-label={post.replyCount + " replies"}><Icon name="message-circle" size={20} />{short(post.replyCount)}</span>
          )}
          <button type="button" className="vx-act vx-act--end" aria-label="Share" onClick={() => setSharing(true)}>
            <Icon name="share-2" size={20} />
            Share
          </button>
        </div>
        {note ? <p className="m-0 text-[13px] leading-4 text-danger" role="alert">{note}</p> : null}
      </article>
      {sharing ? <ShareSheet objectType="ANSWER" objectId={post.id} onClose={() => setSharing(false)} /> : null}
      {post.news?.tag === "VERIFIED_NEWS" && post.news.sourceName ? (
        <a className="vx-link" href={post.news.sourceUrl ?? undefined} target="_blank" rel="noreferrer noopener">
          <Icon name="link" size={18} />
          {"Source: " + post.news.sourceName}
        </a>
      ) : null}
    </div>
  );
}
