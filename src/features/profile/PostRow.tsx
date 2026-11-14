"use client";
import { VerifiedTick } from "@/features/verify/VerifiedTick";
import { countText } from "@/lib/format/plural";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPill, Avatar, Badge, Icon, IconButton, NewsTag, REACTIONS } from "@/components/vx";
import { OwnVoiceFlow, type PushToast } from "@/features/talk/TalkCard";
import type { Answer, Reply } from "@/lib/api/profile";
import { MoodChip } from "@/features/mood/MoodChip";
import { ClipPlayer } from "./ClipPlayer";
import { ago, placeLabel } from "./format";

const KIND_NAME: Record<string, string> = {
  POWERFUL: "Powerful", WILD: "Wild", RELATABLE: "Relatable", FUNNY: "Funny", SURPRISING: "Surprising", SAD: "Sad",
  WELL_SAID: "Well said", THOUGHT_PROVOKING: "Thought-provoking", EXACTLY: "Exactly", DISAGREE: "Disagree",
};
const LABEL_TEXT: Record<string, string> = {
  TRENDING: "Trending", MOST_RELATABLE: "Most Relatable", MOST_THOUGHT_PROVOKING: "Most Thought-Provoking",
  MOST_DEBATED: "Most Debated", MOST_SUPPORTED: "Most Supported", MOST_SURPRISING: "Most Surprising",
};
const NEWS_KIND = { VERIFIED_NEWS: "verified", UNVERIFIED_NEWS: "unverified", GOSSIP: "gossip" } as const;
const fmt = (n: number) => n.toLocaleString("en-NG");
const short = (n: number) => (n >= 1e4 ? `${Math.round(n / 100) / 10}K` : fmt(n));

function Transcript({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="vx-answer__tx">
      <button type="button" className="vx-link" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="captions" size={18} />
        {open ? "Hide transcript" : "Read transcript"}
      </button>
      <div className={"vx-answer__unfold" + (open ? " is-open" : "")}>
        <div><p className="vx-answer__transcript"><b>Transcript</b>{text}</p></div>
      </div>
    </div>
  );
}

/** Tells one post from the next for a screen reader: its first words, else when it was sent. */
function postName(a: Answer): string {
  const words = (a.body ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  return words ? `Post: ${words}` : `Voice from ${ago(a.createdAt)}`;
}

/** One of a person's voices, with the question it answers ("On:" link). Only what is live: counts are shown, not buttons. */
export function PostRow({ a: first, own }: { a: Answer; /** On my own Profile only: the three dots, and what to do when I delete one. */ own?: { push: PushToast; onDeleted: (id: string) => void } }) {
  const [a, setA] = useState(first);
  const [more, setMore] = useState(false);
  useEffect(() => setA(first), [first]);
  const who = a.author;
  const place = who ? placeLabel({ city: null, state: who.state ?? null }) : undefined;
  const label = a.labels[0] ? LABEL_TEXT[a.labels[0]] : undefined;
  const top = [...a.reactionBreakdown].sort((x, y) => y.count - x.count).slice(0, 3);
  const emoji = (k: string) => REACTIONS.find((r) => r.name === KIND_NAME[k])?.e ?? "";
  const transcript = a.clip?.transcript?.status === "READY" ? a.clip.transcript.text : null;
  return (
    <div className="pf-post" data-post-id={a.id}>
      {a.questionText ? <Link className="pf-on" href={`/q/${a.questionId}`}>On: {a.questionText}</Link> : null}
      {a.mood ? <MoodChip mood={a.mood} className="mb-[6px]" /> : null}
      <article className="vx-answer" aria-label={`Voice from ${who?.handle ?? "this person"}`}>
        <div className="vx-answer__head">
          <Avatar name={who?.displayName || who?.handle} src={who?.avatarUrl ?? undefined} />
          <div className="vx-answer__who">
            <span className="vx-answer__name"><span className="vx-answer__nm">{who ? "@" + who.handle : "Anonymous"}</span>{who ? <AdminPill admin={(who as { admin?: boolean }).admin} /> : null}</span>
            {/* V-ANON: the API lists a person's anonymous posts on their own page only; the tag is theirs alone. */}
            {!who && a.isMine ? <span data-testid="anon-tag" className="text-caption text-[var(--ink-2)]">Posted without your name</span> : null}
            <span className="vx-answer__time">{ago(a.createdAt) + (place ? " · " + place : "")}</span>
          </div>
          {own && a.isMine ? <IconButton icon="ellipsis" label={`More: edit, delete, copy link. ${postName(a)}`} variant="ghost" size="s" onClick={() => setMore(true)} /> : null}
        </div>
        {label || a.news ? (
          <div className="vx-answer__labels">
            {a.news ? <NewsTag kind={NEWS_KIND[a.news.tag]} /> : null}
            {label ? <Badge tone="rank" icon="trending-up">{label}</Badge> : null}
          </div>
        ) : null}
        {a.clip ? <ClipPlayer clip={a.clip} answerId={a.id} /> : null}
        {a.body ? <p className="vx-answer__text whitespace-pre-line">{a.body}</p> : null}
        {transcript ? <Transcript text={transcript} /> : null}
        {a.reactionCount > 0 ? (
          <div className="vx-answer__sum"><span className="e" aria-hidden="true">{top.map((t) => emoji(t.kind)).join(" ")}</span>{countText(a.reactionCount, "reaction")}</div>
        ) : null}
        <div className="pf-counts">
          <span><Icon name="heart" size={18} />{short(a.likeCount)}<span className="pf-sr">{a.likeCount === 1 ? " like" : " likes"}</span></span>
          <span><Icon name="message-circle" size={18} />{short(a.replyCount)}<span className="pf-sr">{a.replyCount === 1 ? " reply" : " replies"}</span></span>
        </div>
      </article>
      {own && more ? <OwnVoiceFlow answer={a} push={own.push} onClose={() => setMore(false)} onSaved={(n) => setA((cur) => ({ ...cur, ...n }))} onDeleted={own.onDeleted} /> : null}
    </div>
  );
}

/** A reply someone wrote. Replies do not carry their question, so there is no "On:" link. */
export function ReplyRow({ r }: { r: Reply }) {
  const stance = { AGREE: "Agrees", DISAGREE: "Disagrees", EXPERIENCE: "Shares an experience" }[r.stance];
  const au = r.author; // null: posted without a name, so nothing of the writer shows
  return (
    <div className="pf-post">
      <article className="vx-answer" aria-label={`Reply from ${au ? au.handle : "an anonymous poster"}`}>
        <div className="vx-answer__head">
          <Avatar name={au ? au.displayName || au.handle : "Anonymous"} src={au?.avatarUrl ?? undefined} />
          <div className="vx-answer__who">
            <span className="vx-answer__name">{au ? <><span className="vx-answer__nm">{"@" + au.handle}</span><VerifiedTick verified={au.verified} /><AdminPill admin={(au as { admin?: boolean }).admin} /></> : "Anonymous"}</span>
            {/* V-FIX-D: the API lists a person's unnamed replies on their own page only; the tag is theirs alone. */}
            {!au && r.isMine ? <span data-testid="anon-tag" className="text-caption text-[var(--ink-2)]">Posted without your name</span> : null}
            <span className="vx-answer__time">{ago(r.createdAt) + " · " + stance}</span>
          </div>
        </div>
        {r.clip ? <ClipPlayer clip={r.clip} /> : null}
        {r.body ? <p className="vx-answer__text">{r.body}</p> : null}
        <div className="pf-counts"><span><Icon name="heart" size={18} />{short(r.helpfulCount)}<span className="pf-sr"> found this helpful</span></span></div>
      </article>
    </div>
  );
}
