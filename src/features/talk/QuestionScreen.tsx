"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Banner, Button, EmptyState, FreePosts, Skeleton, Tabs } from "@/components/vx";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, AnswerSort, Question } from "@/lib/api/talk";
import { closesIn } from "@/lib/feed-format";
import { useLoad } from "@/components/feed/useLoad";
import { Stage } from "@/features/stage/Stage";
import { AppBar, BarButton, Problem, ShellTweaks, failText, useSignedIn } from "./lib";
import { TalkCard, useShareSheet, useToast } from "./TalkCard";

const short = (n: number) => (n >= 1e4 ? `${Math.round(n / 100) / 10}K` : n.toLocaleString("en-NG"));
const SORTS = [{ id: "TOP", label: "Top" }, { id: "NEW", label: "New" }, { id: "DEBATED", label: "Debated" }];

export function QuestionScreen({ id }: { id: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [toast, push] = useToast();
  const [shareNode, share] = useShareSheet();
  const q = useLoad<Question>(() => api.getQuestion(id), [id, signedIn]);
  const [allow, setAllow] = useState<Allowances | null>(null);
  useEffect(() => {
    if (signedIn) api.getAllowance().then(setAllow, () => setAllow(null));
  }, [signedIn]);
  const [saved, setSaved] = useState<boolean | null>(null);
  useEffect(() => { if (q.state === "ready") setSaved(q.data.iSaved); }, [q]);

  const [sort, setSort] = useState<AnswerSort>("TOP");
  const [items, setItems] = useState<Answer[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "more">("loading");
  const [err, setErr] = useState<unknown>(null);
  const loadPage = useCallback(async (cursor?: string) => {
    setState(cursor ? "more" : "loading");
    try {
      const p = await api.listAnswers(id, sort, cursor);
      const got = p.items.filter((x) => x.type === "answer" && x.answer).map((x) => x.answer as Answer);
      setItems((cur) => (cursor ? [...cur, ...got] : got));
      setNext(p.nextCursor);
      setState("ready");
    } catch (e) {
      setErr(e);
      setState("error");
    }
  }, [id, sort]);
  useEffect(() => { void loadPage(); }, [loadPage, signedIn]);

  if (q.state === "loading" || signedIn === null) return <><ShellTweaks tabBar /><AppBar title="Question" back="/" /><div className="mt-4 grid gap-4" aria-busy="true"><Skeleton variant="tile" /><Skeleton variant="answer" /></div></>;
  if (q.state === "error") {
    const gone = "status" in q.error && (q.error as { status: number }).status === 404;
    return (
      <>
        <ShellTweaks tabBar />
        <AppBar title="Question" back="/" />
        <div className="mt-4">
          {gone ? <EmptyState icon="message-square" title="We could not find this question" body="It may have been removed, or the link is wrong." action="Back to Home" onAction={() => router.push("/")} /> : <Problem error={q.error} onRetry={q.retry} />}
        </div>
      </>
    );
  }
  const question = q.data;
  const open = question.status === "LIVE";
  const left = allow?.freePostsRemaining;
  const close = closesIn(question.endsAt);
  const daily = question.kind === "DAILY";

  async function toggleSave() {
    if (!signedIn) return push("Sign in to save a question.", "info");
    const was = !!saved;
    setSaved(!was);
    try { await (was ? api.unsaveQuestion(id) : api.saveQuestion(id)); push(was ? "Removed from saved." : "Saved.", "success"); } catch (e) { setSaved(was); push(failText(e), "danger"); }
  }

  const writeHref = `/q/${id}/write`;
  return (
    <>
      <ShellTweaks tabBar />
      <AppBar title={daily ? "Today’s question" : "Question"} back="/">
        <BarButton icon="bookmark" label="Save this question" pressed={!!saved} onClick={toggleSave} />
        <BarButton icon="share-2" label="Share this question" onClick={() => share("QUESTION", id)} />
      </AppBar>
      <Stage questionId={id} active="discuss" counts={{ speak: short(question.voiceCount), discuss: short(question.answerCount) }} />

      <section aria-label="The question" className="flex flex-col gap-3 pb-2 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {question.category ? <span className="text-[12px] font-bold uppercase leading-4 tracking-[0.08em] text-[var(--green-text)]">{question.category.name}</span> : null}
          {question.topicTitle ? <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">{question.topicTitle}</span> : null}
        </div>
        <h1 className="m-0 font-display text-[32px] font-normal leading-9 tracking-[-0.01em] [text-wrap:balance] dt:text-[44px] dt:leading-[48px]">{question.text}</h1>
        {question.hint ? <p className="m-0 text-[17px] font-medium leading-6 text-[var(--ink-2)]">{question.hint}</p> : null}
        <div className="flex items-center gap-[10px]">
          {question.recentVoices.length ? (
            <span className="flex items-center" aria-hidden="true">
              {question.recentVoices.slice(0, 3).map((v, i) => (
                <span key={v.id} className={`inline-flex rounded-full shadow-[0_0_0_2px_var(--bg)] ${i ? "-ml-[10px]" : ""}`}><Avatar name={v.handle} src={v.avatarUrl ?? undefined} size="s" /></span>
              ))}
            </span>
          ) : null}
          <span className="text-[15px] leading-5 text-[var(--ink-2)]"><b className="text-[var(--ink)]">{short(question.voiceCount)} {question.voiceCount === 1 ? "voice" : "voices"}</b>{close && open ? ` · closes in ${close}` : ""}</span>
        </div>
        {open ? (
          <>
            <div className="grid grid-cols-[1fr_1fr] gap-3 dt:max-w-[420px]">
              <Button size="l" icon="mic" block href="/speak">Speak</Button>
              <Button size="l" variant="secondary" block href={writeHref}>Write instead</Button>
            </div>
            <p className="m-0 text-[14px] leading-5 text-[var(--ink-2)]">You have 10 seconds on a free post. Reading and listening are always free.</p>
          </>
        ) : (
          <Banner tone="info" title="This question has closed.">You can still read and listen to every voice.</Banner>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between border-b border-[var(--line)] pt-2">
        <h2 className="m-0 font-display text-[20px] font-normal">Voices</h2>
        <span className="text-[13px] text-[var(--ink-2)]">{question.answerCount.toLocaleString("en-NG")}</span>
      </div>
      <div className="my-3"><Tabs label="Sort voices" items={SORTS} value={sort} onChange={(s) => setSort(s as AnswerSort)} /></div>

      {state === "loading" ? <div className="grid gap-3" aria-busy="true"><Skeleton variant="answer" /><Skeleton variant="answer" /></div> : null}
      {state === "error" && !items.length ? <Problem error={err} onRetry={() => void loadPage()} /> : null}
      {state !== "loading" && !(state === "error" && !items.length) && !items.length ? (
        <EmptyState icon="mic" title="No voices yet" body="Be the first to answer this question." action={open ? "Write instead" : undefined} onAction={open ? () => router.push(writeHref) : undefined} />
      ) : null}
      <div className="grid gap-3">
        {items.map((a) => (
          <div key={a.id} className="grid gap-1">
            <TalkCard answer={a} signedIn={!!signedIn} freeReactions={allow?.freeReactionsLeftToday} onAllowance={(p) => setAllow((c) => (c ? { ...c, ...p } : c))} push={push} />
            {a.replyCount > 0 ? (
              <Link href={`/q/${id}/a/${a.id}`} className="flex items-center gap-2 px-2 text-[14px] font-semibold">
                {`View ${a.replyCount} ${a.replyCount === 1 ? "reply" : "replies"}`}
                {a.agreeCount + a.disagreeCount > 0 ? <span className="font-medium text-[var(--ink-2)]">{`${a.agreeCount} agree · ${a.disagreeCount} disagree`}</span> : null}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      {state === "error" && items.length ? <div className="mt-3"><Problem error={err} onRetry={() => void loadPage(next ?? undefined)} /></div> : null}
      {next ? <div className="mt-3"><Button variant="secondary" size="l" block loading={state === "more"} onClick={() => void loadPage(next)}>Load more voices</Button></div> : null}
      {open ? <p className="mt-6 text-center"><Link href={writeHref} className="text-[15px] font-semibold">Add your voice in words</Link></p> : null}

      {open ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottombar-h)+env(safe-area-inset-bottom,0px))] z-[var(--z-sticky)] border-t border-[var(--line)] bg-[var(--surface)] px-3 py-[10px] dt:hidden">
          <div className="flex items-center gap-[10px]">
            <Link href={writeHref} className="flex min-h-12 min-w-0 flex-1 items-center rounded-full bg-[var(--surface)] px-[18px] text-[16px] font-medium text-[var(--ink-2)] no-underline shadow-[inset_0_0_0_1px_var(--line-strong)]">Add your voice in words</Link>
            {left !== undefined ? <FreePosts left={left} pill /> : null}
          </div>
        </div>
      ) : null}
      {open && left !== undefined ? <div className="mt-4 hidden dt:block"><FreePosts left={left} /></div> : null}
      {toast}
      {shareNode}
    </>
  );
}
