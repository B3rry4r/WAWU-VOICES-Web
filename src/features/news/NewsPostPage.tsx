"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Rail } from "@/components/shell/ShellSlots";
import { Avatar, Banner, Button, EmptyState, Icon, NewsTag, Sheet, Skeleton } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { flagNewsTag, getNewsPost, listNews, listReplies } from "@/lib/api/news";
import type { NewsAnswer, NewsReply } from "@/lib/api/news";
import { ago, lagosClock, useSignedIn } from "@/features/results/shared";
import { NewsCard } from "./NewsCard";
import { ClipPlayer } from "./ClipPlayer";
import { kindOf } from "./tags";
import { ShareSheet } from "@/features/share";
import { SERVED } from "./served";

type Load = "loading" | "missing" | "error" | "ready";

function chosenLine(p: NewsAnswer): string | null {
  const n = p.news;
  if (!n) return null;
  const byPoster = n.chosenBy.startsWith("@") || n.chosenBy === "the poster";
  return `Tag chosen by ${n.chosenBy}${byPoster ? " when posting" : ""}, ${lagosClock(n.chosenAt)}`;
}

function ReplyCard({ r }: { r: NewsReply }) {
  const transcript = r.clip?.transcript?.status === "READY" ? r.clip.transcript.text : null;
  return (
    <article className="vx-answer" aria-label={"Reply from " + r.author.handle}>
      <div className="vx-answer__head">
        <Avatar name={r.author.displayName ?? r.author.handle} src={r.author.avatarUrl ?? undefined} />
        <div className="vx-answer__who">
          <span className="vx-answer__name">{"@" + r.author.handle}</span>
          <span className="vx-answer__time">{ago(r.createdAt) + (r.author.state ? " · " + r.author.state : "")}</span>
        </div>
      </div>
      {r.clip && SERVED.clipPlay ? <ClipPlayer clipId={r.clip.id} durationMs={r.clip.durationMs} peaks={r.clip.peaks} /> : null}
      {r.body ? <p className="vx-answer__text">{r.body}</p> : null}
      {!r.body && transcript ? <p className="vx-answer__transcript"><b>Transcript</b>{transcript}</p> : null}
    </article>
  );
}

export function NewsPostPage({ answerId }: { answerId: string }) {
  const signedIn = useSignedIn();
  const [post, setPost] = useState<NewsAnswer | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [replies, setReplies] = useState<NewsReply[]>([]);
  const [nextReplies, setNextReplies] = useState<string | null>(null);
  const [more, setMore] = useState<NewsAnswer[]>([]);
  const [sharing, setSharing] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [note, setNote] = useState("");
  const [flagState, setFlagState] = useState<"idle" | "busy" | "done">("idle");
  const [flagError, setFlagError] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    setLoad("loading");
    getNewsPost(answerId)
      .then((p) => { setPost(p); setLoad("ready"); })
      .catch((e: unknown) => setLoad(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
    if (SERVED.replies) listReplies(answerId).then((r) => { setReplies(r.items); setNextReplies(r.nextCursor); }).catch(() => undefined);
    listNews({ limit: 4 }).then((p) => setMore(p.items.filter((x) => x.id !== answerId).slice(0, 3))).catch(() => undefined);
  }, [answerId]);
  useEffect(() => { fetchAll(); }, [fetchAll, signedIn]);

  async function sendFlag() {
    setFlagState("busy");
    setFlagError(null);
    try {
      await flagNewsTag(answerId, note.trim() || undefined);
      setFlagState("done");
      setFlagOpen(false);
    } catch (e) {
      setFlagState("idle");
      setFlagError(e instanceof ApiError && e.explained ? e.message : "Could not send the flag. Try again.");
    }
  }

  async function moreReplies() {
    if (!nextReplies) return;
    try {
      const r = await listReplies(answerId, { cursor: nextReplies });
      setReplies((old) => old.concat(r.items));
      setNextReplies(r.nextCursor);
    } catch { /* the button stays */ }
  }

  const flagBlock = (long: boolean) =>
    signedIn && post?.news ? (
      <section className="flex flex-col gap-2 border-t border-line pt-3" aria-label="Is this tag wrong?">
        <h3 className="m-0 text-body-strong">Is this tag wrong?</h3>
        <p className="m-0 text-caption text-ink-2">
          {long
            ? "If this is presented as news but is not, or the tag hides what it is, flag it. An editor reviews every flag. If the tag changes, the poster is told why."
            : "Flag it. An editor reviews every flag, and the poster is told if the tag changes."}
        </p>
        {flagState === "done" ? (
          <Banner tone="success">Flag sent. An editor will check this post.</Banner>
        ) : (
          <Button variant="secondary" icon="flag" onClick={() => setFlagOpen(true)}>Flag as misleading</Button>
        )}
      </section>
    ) : null;

  if (load === "missing" || load === "error") {
    return (
      <>
        <Link href="/news" className="mb-3 inline-flex items-center gap-1 text-label text-green-text no-underline"><Icon name="arrow-left" size={18} />Back to the Newsroom</Link>
        <EmptyState icon={load === "missing" ? "radio" : "wifi-off"} title={load === "missing" ? "This post is not available" : "Could not load this post"} action={load === "error" ? "Try again" : undefined} actionIcon="refresh-cw" onAction={fetchAll} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 pb-2 pt-1">
        <Link href="/news" aria-label="Back to the Newsroom" className="flex h-11 w-11 flex-none items-center justify-center rounded-pill bg-surface text-ink no-underline shadow-1 dt:hidden"><Icon name="arrow-left" size={24} /></Link>
        <Link href="/news" className="hidden items-center gap-1 text-label text-green-text no-underline hover:text-ink dt:inline-flex"><Icon name="arrow-left" size={18} />Newsroom</Link>
        <span className="t-bar-title mr-auto text-ink-2 dt:hidden">Newsroom</span>
        <button type="button" aria-label="Share this post" onClick={() => setSharing(true)} className="ml-auto flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-pill border-0 bg-surface p-0 text-ink shadow-1 dt:hidden"><Icon name="share-2" size={24} /></button>
      </div>

      {load === "loading" || !post ? (
        <div className="flex flex-col gap-4" aria-busy="true"><Skeleton variant="line" /><Skeleton variant="answer" /></div>
      ) : (
        <div className="flex flex-col gap-4 pb-6">
          {post.questionText ? (
            <Link href={`/q/${post.questionId}`} className="flex flex-col gap-1 rounded-l bg-surface-2 p-4 no-underline text-ink">
              <span className="text-eyebrow uppercase text-ink-2">Answering</span>
              <span className="font-display text-display-m">{post.questionText}</span>
            </Link>
          ) : null}
          <NewsCard post={post} signedIn={signedIn === true} repliesHref="#replies" open />
          {chosenLine(post) ? (
            <p className="m-0 flex items-center gap-2 text-caption text-ink-2"><Icon name="clock" size={18} />{chosenLine(post)}</p>
          ) : null}
          {post.news ? (
            <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1 dt:hidden" aria-label="This post’s tag">
              <NewsTag kind={kindOf(post.news.tag)} withNote />
              {flagBlock(false)}
            </section>
          ) : null}

          {SERVED.replies ? <section id="replies" className="flex flex-col gap-3" aria-label="Replies">
            <h2 className="m-0 font-display text-display-m">{post.replyCount + (post.replyCount === 1 ? " reply" : " replies")}</h2>
            {replies.map((r) => <ReplyCard key={r.id} r={r} />)}
            {nextReplies ? <Button variant="secondary" block onClick={moreReplies}>Show more</Button> : null}
          </section> : null}
        </div>
      )}

      {sharing ? <ShareSheet objectType="ANSWER" objectId={answerId} onClose={() => setSharing(false)} /> : null}
      {flagOpen ? (
        <Sheet
          title="Flag as misleading"
          onClose={() => setFlagOpen(false)}
          footer={<Button block icon="flag" loading={flagState === "busy"} onClick={sendFlag}>Flag as misleading</Button>}
        >
          <label className="flex flex-col gap-1 text-label">
            Add a note for the editor (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={4} className="rounded-m border border-line-strong bg-surface p-3 font-body text-body text-ink" />
          </label>
          {flagError ? <p className="m-0 mt-2 text-caption text-danger" role="alert">{flagError}</p> : null}
        </Sheet>
      ) : null}

      <Rail>
        {post?.news ? (
          <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="About this post">
            <h2 className="m-0 font-display text-display-s">About this post</h2>
            <div className="flex flex-col gap-1">
              <span className="text-eyebrow uppercase text-ink-2">This post’s tag</span>
              <NewsTag kind={kindOf(post.news.tag)} size="m" withNote />
            </div>
            {flagBlock(true)}
          </section>
        ) : null}
        {more.length ? (
          <section className="flex flex-col gap-3 rounded-l bg-surface p-4 shadow-1" aria-label="More in the Newsroom">
            <h2 className="m-0 font-display text-display-s">More in the Newsroom</h2>
            {more.map((m) => (
              <Link key={m.id} href={`/news/${m.id}`} className="flex flex-col gap-1 text-caption text-ink no-underline hover:underline">
                {m.news ? <NewsTag kind={kindOf(m.news.tag)} /> : null}
                <span>{m.body ?? "Voice post"}</span>
              </Link>
            ))}
          </section>
        ) : null}
      </Rail>
    </>
  );
}
