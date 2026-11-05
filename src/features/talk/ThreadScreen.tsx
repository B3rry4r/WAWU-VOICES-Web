"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Badge, Banner, Button, EmptyState, Icon, IconButton, Skeleton, TopicChip, VoicePlayer } from "@/components/vx";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, Reply, ReplyStance } from "@/lib/api/talk";
import { ago } from "@/lib/feed-format";
import { useLoad } from "@/components/feed/useLoad";
import { StageNav } from "@/features/stage/StageNav";
import { AppBar, BarButton, Problem, failText, useClipPlayback, useSignedIn } from "./lib";
import { ReplyComposer } from "./ReplyComposer";
import { TalkCard, useShareSheet, useToast } from "./TalkCard";
import { TalkRail } from "./TalkRail";
import "./talk.css";

const STANCES: { id: ReplyStance; label: string }[] = [
  { id: "AGREE", label: "I agree" },
  { id: "DISAGREE", label: "I disagree" },
  { id: "EXPERIENCE", label: "My experience" },
];
const stanceIcon = { AGREE: "check", DISAGREE: "circle-x", EXPERIENCE: "user" } as const;

function ClipPlayer({ clipId, ms, push }: { clipId: string; ms: number; push: (t: string, tone?: "danger") => void }) {
  const clip = useClipPlayback(clipId, (e) => push(failText(e), "danger"));
  return <VoicePlayer key={clip.rev} duration={Math.max(1, Math.round(ms / 1000))} seed={clipId.length * 7} onPlayingChange={(on) => void clip.toggle(on)} />;
}

function ReplyRow({ r, onDelete, push }: { r: Reply; onDelete: (r: Reply) => void; push: (t: string, tone?: "danger") => void }) {
  const st = STANCES.find((s) => s.id === r.stance)!;
  return (
    <>
    <div className="mt-2 hidden items-center gap-2 text-[12px] font-bold uppercase leading-4 tracking-[0.08em] text-[var(--ink-2)] dt:flex"><Icon name={stanceIcon[r.stance]} size={14} />{st.label}</div>
    <article className="vx-answer" aria-label={`Reply from ${r.author.handle}`}>
      <div className="vx-answer__head">
        <Avatar name={r.author.displayName ?? r.author.handle} src={r.author.avatarUrl ?? undefined} size="s" />
        <div className="vx-answer__who">
          <span className="vx-answer__name">{`@${r.author.handle}`}</span>
          <span className="vx-answer__time">{ago(r.createdAt) + (r.author.state ? ` · ${r.author.state}` : "")}</span>
        </div>
        <span className="dt:hidden"><Badge tone="proposed" icon={stanceIcon[r.stance]}>{st.label}</Badge></span>
        {r.isMine ? <IconButton icon="x" label="Delete my reply" variant="ghost" size="s" onClick={() => onDelete(r)} /> : null}
      </div>
      {r.kind === "VOICE" && r.clip ? <ClipPlayer clipId={r.clip.id} ms={r.clip.durationMs ?? 10000} push={push} /> : null}
      {r.body ? <p className="vx-answer__text">{r.body}</p> : null}
      {r.kind === "VOICE" && r.clip?.transcript?.status === "READY" && r.clip.transcript.text ? <p className="vx-answer__transcript"><b>Transcript</b>{r.clip.transcript.text}</p> : null}
    </article>
    </>
  );
}

export function ThreadScreen({ qid, aid }: { qid: string; aid: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [toast, push] = useToast();
  const [shareNode, share] = useShareSheet();
  const a = useLoad<Answer>(() => api.getAnswer(aid), [aid, signedIn]);
  const [question, setQuestion] = useState<{ text: string; open: boolean } | null>(null);
  useEffect(() => { api.getQuestion(qid).then((q) => setQuestion({ text: q.text, open: q.status === "LIVE" }), () => undefined); }, [qid]);
  const [allow, setAllow] = useState<Allowances | null>(null);
  useEffect(() => { if (signedIn) api.getAllowance().then(setAllow, () => undefined); }, [signedIn]);
  const [filter, setFilter] = useState<ReplyStance | undefined>();
  const [pick, setPick] = useState<ReplyStance | undefined>();
  const [items, setItems] = useState<Reply[]>([]);
  const [counts, setCounts] = useState({ agree: 0, disagree: 0, experience: 0 });
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "more">("loading");
  const [err, setErr] = useState<unknown>(null);
  const load = useCallback(async (cursor?: string) => {
    setState(cursor ? "more" : "loading");
    try {
      const p = await api.listReplies(aid, filter, cursor);
      setItems((c) => (cursor ? [...c, ...p.items] : p.items));
      setNext(p.nextCursor);
      if (p.counts) setCounts(p.counts);
      setState("ready");
    } catch (e) { setErr(e); setState("error"); }
  }, [aid, filter]);
  useEffect(() => { void load(); }, [load, signedIn]);

  async function del(r: Reply) {
    try { await api.deleteReply(r.id); setItems((c) => c.filter((x) => x.id !== r.id)); push("Reply deleted.", "success"); void load(); } catch (e) { push(failText(e), "danger"); }
  }

  if (a.state === "loading") return <><AppBar title="Replies" back={`/q/${qid}`} /><div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="answer" /><Skeleton variant="answer" /></div></>;
  if (a.state === "error") return <><AppBar title="Replies" back={`/q/${qid}`} /><div className="mt-4"><Problem error={a.error} onRetry={a.retry} /></div></>;
  const ans = a.data;
  const who = ans.author ? `@${ans.author.handle}` : "Anonymous";
  const open = question ? question.open : true;
  const total = counts.agree + counts.disagree + counts.experience;
  const writeHref = `/q/${qid}/write?reply=${aid}${pick ? `&stance=${pick}` : ""}`;
  const chips: { id?: ReplyStance; label: string; n: number }[] = [
    { label: "All", n: total },
    { id: "AGREE", label: "I agree", n: counts.agree },
    { id: "DISAGREE", label: "I disagree", n: counts.disagree },
    { id: "EXPERIENCE", label: "My experience", n: counts.experience },
  ];
  return (
    <>
      
      <AppBar title="Replies" sub={`${ans.replyCount.toLocaleString("en-NG")} ${ans.replyCount === 1 ? "reply" : "replies"} to ${who}`} back={`/q/${qid}`}>
        <BarButton icon="share-2" label="Share this voice" onClick={() => share("ANSWER", aid)} />
      </AppBar>
      <StageNav questionId={qid} active="discuss" visited={["speak"]} />
      <Link href={`/q/${qid}`} className="mt-4 block rounded-[var(--radius-l)] bg-[var(--surface-2)] p-4 no-underline">
        <span className="vx-eyebrow flex items-center gap-2 text-[var(--ink-2)]">Replies to a voice on</span>
        <span className="mt-1 block font-display text-[18px] leading-6 text-[var(--ink)]">{question?.text || ans.questionText || ""}</span>
      </Link>
      <div className="mt-3">
        <TalkCard answer={ans} signedIn={!!signedIn} push={push} unfolded className="tk-flat" threadHref={`/q/${qid}/a/${aid}`} />
      </div>
      {!open ? <div className="mt-3"><Banner tone="info" title="This question has closed.">You can still read and listen to every reply. New replies are closed.</Banner></div> : null}
      {open && signedIn && allow ? (
        <div className="mt-4 hidden dt:block">
          <ReplyComposer aid={aid} qid={qid} who={who} allow={allow} stance={pick} onPosted={() => { push("Reply posted.", "success"); void load(); }} onBuy={(href) => router.push(href)} />
        </div>
      ) : null}
      <h2 className="m-0 mt-6 hidden font-display text-[20px] font-normal dt:block">{`${total.toLocaleString("en-NG")} ${total === 1 ? "reply" : "replies"}`}</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Show replies">
        {chips.map((c) => (
          <TopicChip key={c.label} label={c.label} count={c.n} selected={filter === c.id} onClick={() => setFilter(c.id)} />
        ))}
      </div>
      <div className={`tk-replies mt-3 grid gap-3 ${open ? "pb-48" : "pb-6"} dt:pb-6`}>
        {state === "loading" ? <><Skeleton variant="answer" /><Skeleton variant="answer" /></> : null}
        {state === "error" && !items.length ? <Problem error={err} onRetry={() => void load()} /> : null}
        {state === "ready" && !items.length ? <EmptyState icon="message-square" title="No replies yet" body={`Be the first to reply to ${who}.`} /> : null}
        {items.map((r) => <ReplyRow key={r.id} r={r} onDelete={del} push={push} />)}
        {next ? <Button variant="secondary" size="l" block loading={state === "more"} onClick={() => void load(next)}>Load more replies</Button> : null}
      </div>
      {open ? (
        <div className="tk-dock fixed inset-x-0 bottom-[calc(var(--bottombar-h)+env(safe-area-inset-bottom,0px))] z-[var(--z-sticky)] border-t border-[var(--line)] bg-[var(--surface)] px-3 py-[10px] dt:hidden">
          <div className="mb-2 flex gap-2 overflow-x-auto" role="group" aria-label="How are you replying?">
            {STANCES.map((s) => <TopicChip key={s.id} label={s.label} selected={pick === s.id} onClick={() => setPick(pick === s.id ? undefined : s.id)} />)}
          </div>
          {signedIn === false ? <Banner tone="info" title="Sign in to reply.">Reading and listening are free. We ask for your number when you post.</Banner> : (
            <Link href={writeHref} className="flex min-h-12 items-center rounded-full bg-[var(--surface)] px-[18px] text-[16px] font-medium text-[var(--ink-2)] no-underline shadow-[inset_0_0_0_1px_var(--line-strong)]">{`Reply to ${who} in words`}</Link>
          )}
        </div>
      ) : null}
      <TalkRail questionId={qid} />
      {toast}
      {shareNode}
    </>
  );
}
