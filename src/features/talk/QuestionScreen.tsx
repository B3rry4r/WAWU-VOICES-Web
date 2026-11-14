"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Banner, Button, EmptyState, FreePosts, NotFoundState, Icon, Sheet, Skeleton, Tabs } from "@/components/vx";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, AnswerSort, Question } from "@/lib/api/talk";
import { closesIn, comingUp, questionStart, uniqueVoices, voicesOf } from "@/lib/feed-format";
import { getPublicConfig } from "@/lib/api/feed";
import { useLoad } from "@/components/feed/useLoad";
import { StageNav } from "@/features/stage/StageNav";
import { LiveResultsLink } from "@/components/feed/LinkCards";
import { AppBar, BarButton, Problem, failText, unitsText, useSignedIn } from "./lib";
import { ComingUpQuestion } from "./ComingUp";
import { TalkCard, useShareSheet, useToast } from "./TalkCard";
import { TalkRail } from "./TalkRail";
import { MoodChip } from "@/features/mood/MoodChip";
import { MoodFilter, MoodSplit } from "@/features/mood/MoodSplit";
import { isMoodQuestion, pickHref } from "@/features/mood/mood";
import type { Mood } from "@/lib/api/mood";
import "./talk.css";

const short = (n: number) => (n >= 1e4 ? `${Math.round(n / 100) / 10}K` : n.toLocaleString("en-NG"));
const SORTS = [{ id: "TOP", label: "Top" }, { id: "NEW", label: "New" }, { id: "DEBATED", label: "Debated" }];

/** What the person has to post with (lead ruling WF-6, 6 Nov, B-N4): free posts while there are any; with none left, their units (or "Out of free posts"). Never "a free post" when there is none. */
export function postingLine(seconds: number, allow: Allowances | null): string {
  const tail = "Reading and listening are always free.";
  if (!allow || allow.freePostsRemaining > 0) return `You have ${allow?.costs.freeVoiceSeconds ?? 60} seconds on a free post. ${tail}`;
  const cost = allow.costs.extraVoice30Kobo * 10;
  if (allow.balanceMilli >= cost) return `You have ${unitsText(allow.balanceMilli)}. A voice message of up to ${allow.costs.voiceTier1Seconds ?? 30} seconds is ${unitsText(cost)}, up to ${seconds} seconds is ${unitsText(allow.costs.extraVoice60Kobo * 10)}. ${tail}`;
  return `Out of free posts. Get tokens to post. ${tail}`;
}

export function QuestionScreen({ id }: { id: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [toast, push] = useToast();
  const [shareNode, share] = useShareSheet();
  const q = useLoad<Question>(() => api.getQuestion(id), [id, signedIn], questionStart);
  const [allow, setAllow] = useState<Allowances | null>(null);
  useEffect(() => {
    if (signedIn) api.getAllowance().then(setAllow, () => setAllow(null));
  }, [signedIn]);
  const [cfgSeconds, setCfgSeconds] = useState<number | null>(null);
  useEffect(() => { getPublicConfig().then((c) => setCfgSeconds(c.voiceFreeSeconds), () => undefined); }, []);
  const seconds = allow?.maxVoiceSeconds ?? cfgSeconds;
  const [sortOpen, setSortOpen] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  useEffect(() => { if (q.state === "ready") setSaved(q.data.iSaved); }, [q]);

  const [sort, setSort] = useState<AnswerSort>("TOP");
  const [mood, setMood] = useState<Mood | null>(null);
  const [items, setItems] = useState<Answer[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "more">("loading");
  const [err, setErr] = useState<unknown>(null);
  const loadPage = useCallback(async (cursor?: string) => {
    setState(cursor ? "more" : "loading");
    try {
      const p = await api.listAnswers(id, sort, cursor, mood ?? undefined);
      const got = p.items.filter((x) => x.type === "answer" && x.answer).map((x) => x.answer as Answer);
      setItems((cur) => (cursor ? [...cur, ...got] : got));
      setNext(p.nextCursor);
      setState("ready");
    } catch (e) {
      setErr(e);
      setState("error");
    }
  }, [id, sort, mood]);
  // The question turning from SCHEDULED to open reloads the voices too.
  const status = q.state === "ready" ? q.data.status : null;
  useEffect(() => { void loadPage(); }, [loadPage, signedIn, status]);
  const [removedN, setRemovedN] = useState(0);
  useEffect(() => { setRemovedN(0); }, [q]);

  if (q.state === "loading" || signedIn === null) return <><AppBar title="Question" back="/" /><div className="mt-4 grid gap-4" aria-busy="true"><Skeleton variant="tile" /><Skeleton variant="answer" /></div></>;
  if (q.state === "error") {
    const gone = "status" in q.error && (q.error as { status: number }).status === 404;
    return (
      <>
        
        <AppBar title="Question" back="/" />
        <div className="mt-4">
          {gone ? <NotFoundState /> : <Problem error={q.error} onRetry={q.retry} />}
        </div>
      </>
    );
  }
  const dropped = removedN;
  const dec = (n: number | null | undefined) => (typeof n === "number" ? Math.max(0, n - dropped) : n);
  // Deleting my own answer takes it out of every count on this page without a reload.
  const question = dropped ? { ...q.data, voicesCount: dec(q.data.voicesCount) ?? undefined, answerCount: dec(q.data.answerCount) as number, voiceCount: dec(q.data.voiceCount) as number } : q.data;
  const open = question.status === "LIVE";
  const left = allow?.freePostsRemaining;
  const close = closesIn(question.endsAt);
  const daily = question.kind === "DAILY";

  // V-PRELAUNCH: scheduled and not yet open. The question and its hint, when it opens, and nothing to do yet: no counts, no
  // voices, no buttons (the Hub answers 404 to a share of it until it opens, so there is no share either).
  const opens = comingUp(question);
  if (opens) return <ComingUpQuestion question={question} opens={opens} />;

  async function toggleSave() {
    if (!signedIn) return push("Sign in to save a question.", "info");
    const was = !!saved;
    setSaved(!was);
    try { await (was ? api.unsaveQuestion(id) : api.saveQuestion(id)); push(was ? "Removed from saved." : "Saved.", "success"); } catch (e) { setSaved(was); push(failText(e), "danger"); }
  }

  // LCH-02: on a mood question the word is picked first, before Record or Write.
  const moody = isMoodQuestion(question);
  const writeHref = moody ? pickHref(id) : `/q/${id}/write`;
  const speakHref = moody ? pickHref(id) : "/speak";
  return (
    <>
      
      <div className="hidden items-center justify-between dt:flex">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-label text-[var(--ink)] no-underline"><Icon name="arrow-left" size={18} />Back to Home</Link>
        <BarButton icon="share-2" label="Share this question" onClick={() => share("QUESTION", id)} />
      </div>
      <AppBar phoneOnly title={daily ? "Today’s question" : "Question"} back="/">
        <BarButton icon="bookmark" label="Save this question" pressed={!!saved} onClick={toggleSave} />
        <BarButton icon="share-2" label="Share this question" onClick={() => share("QUESTION", id)} />
      </AppBar>
      <StageNav questionId={id} active="discuss" visited={["speak"]} counts={{ speak: short(voicesOf(question)), discuss: short(voicesOf(question)), next: short(question.proposalCount) }} />
      <div className="mt-3 empty:hidden"><LiveResultsLink /></div>

      <section aria-label="The question" className="flex flex-col gap-3 pb-2 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          {daily ? <span className="hidden text-eyebrow uppercase text-[var(--green-text)] dt:inline">Today’s question</span> : null}
          {question.category ? <span className="text-eyebrow uppercase text-[var(--green-text)]">{question.category.name}</span> : null}
          {question.topicTitle ? <span className="text-caption text-[var(--ink-2)]">{question.topicTitle}</span> : null}
        </div>
        <h1 className="m-0 font-display text-display-l [text-wrap:balance] dt:text-display-2xl">{question.text}</h1>
        {question.hint ? <p className="m-0 text-body-l text-[var(--ink-2)]">{question.hint}</p> : null}
        <div className="hidden items-center gap-4 text-caption text-[var(--ink-2)] dt:flex">
          <span className="inline-flex items-center gap-1"><Icon name="mic" size={14} />{`${voicesOf(question).toLocaleString("en-NG")} ${voicesOf(question) === 1 ? "voice" : "voices"} so far`}</span>
          {close && open ? <span className="inline-flex items-center gap-1"><Icon name="clock" size={14} />{`Closes in ${close}`}</span> : null}
        </div>
        <div className="flex items-center gap-[10px] dt:hidden">
          {uniqueVoices(question.recentVoices).length ? (
            <span className="flex items-center" aria-hidden="true">
              {uniqueVoices(question.recentVoices).slice(0, 3).map((v, i) => (
                <span key={v.id} className={`inline-flex rounded-full shadow-[0_0_0_2px_var(--bg)] ${i ? "-ml-[10px]" : ""}`}><Avatar name={v.handle} src={v.avatarUrl ?? undefined} size="s" /></span>
              ))}
            </span>
          ) : null}
          <span className="text-caption text-[var(--ink-2)]"><b className="text-[var(--ink)]">{short(voicesOf(question))} {voicesOf(question) === 1 ? "voice" : "voices"}</b>{close && open ? ` · closes in ${close}` : ""}</span>
        </div>
        {open ? (
          <>
            <div className="grid grid-cols-[1fr_1fr] gap-3 dt:hidden">
              <Button size="l" icon="mic" block href={speakHref}>Speak</Button>
              <Button size="l" variant="secondary" block href={writeHref}>Write instead</Button>
            </div>
            {seconds ? <p className="m-0 text-caption dt:hidden text-[var(--ink-2)]">{postingLine(seconds, allow)}</p> : null}
          </>
        ) : (
          <Banner tone="info" title="This question has closed.">You can still read and listen to every voice.</Banner>
        )}
      </section>

      {open && seconds && allow ? (
        <section aria-label="Add your voice" className="mt-4 hidden rounded-[var(--radius-l)] bg-[var(--surface)] p-5 shadow-[inset_0_0_0_1px_var(--line)] dt:block">
          <h2 className="m-0 text-title">Add your voice</h2>
          <p className="m-0 mt-2 text-caption text-[var(--ink-2)]">{`Speak for up to ${seconds} seconds, or write up to ${allow.costs.textMaxChars} characters.`}</p>
          <div className="mt-4 flex items-center gap-3">
            <Button size="l" icon="mic" href={speakHref}>Speak</Button>
            <Button size="l" variant="secondary" href={writeHref}>Write instead</Button>
            <span className="ml-auto"><FreePosts left={allow.freePostsRemaining} /></span>
          </div>
        </section>
      ) : null}
      {moody ? (
        <div className="mt-4 grid gap-3">
          <MoodSplit qid={id} />
          <MoodFilter value={mood} onChange={setMood} />
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between border-b border-[var(--line)] pt-2 dt:border-0">
        <h2 className="m-0 font-display text-display-m dt:hidden">Voices</h2>
        <span className="text-caption text-[var(--ink-2)] dt:hidden">{voicesOf(question).toLocaleString("en-NG")}</span>
      </div>
      <div className="my-3 flex items-center justify-between gap-3">
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--mint)] px-4 text-label text-[var(--green-text)] dt:hidden" aria-label={`Sort voices: ${SORTS.find((x) => x.id === sort)!.label}. Change`} onClick={() => setSortOpen(true)}>
          <Icon name="trending-up" size={18} />{SORTS.find((x) => x.id === sort)!.label}<Icon name="chevron-down" size={18} />
        </button>
        <div className="hidden dt:block"><Tabs label="Sort voices" items={SORTS} value={sort} onChange={(s) => setSort(s as AnswerSort)} /></div>
        <span className="hidden text-caption text-[var(--ink-2)] dt:block">{`${voicesOf(question).toLocaleString("en-NG")} ${voicesOf(question) === 1 ? "voice" : "voices"}`}</span>
      </div>
      {sortOpen ? (
        <Sheet title="Sort voices" onClose={() => setSortOpen(false)}>
          <div className="grid gap-2 pb-2">
            {SORTS.map((o) => <Button key={o.id} variant={o.id === sort ? "primary" : "secondary"} size="l" block onClick={() => { setSort(o.id as AnswerSort); setSortOpen(false); }}>{o.label}</Button>)}
          </div>
        </Sheet>
      ) : null}

      {state === "loading" ? <div className="grid gap-3" aria-busy="true"><Skeleton variant="answer" /><Skeleton variant="answer" /></div> : null}
      {state === "error" && !items.length ? <Problem error={err} onRetry={() => void loadPage()} /> : null}
      {state !== "loading" && !(state === "error" && !items.length) && !items.length ? (
        <EmptyState icon="mic" title="No voices yet" body="Be the first to answer this question." action={open ? "Write instead" : undefined} onAction={open ? () => router.push(writeHref) : undefined} />
      ) : null}
      <div className="grid gap-3">
        {items.map((a) => (
          <div key={a.id} className="grid gap-1">
            <TalkCard answer={a} signedIn={!!signedIn} freeReactions={allow?.freeReactionsLeftToday} onAllowance={(p) => setAllow((c) => (c ? { ...c, ...p } : c))} push={push} onDeleted={(aid) => { setItems((cur) => cur.filter((x) => x.id !== aid)); setRemovedN((n) => n + 1); }} />
            {a.replyCount > 0 ? (
              <div className="flex items-center gap-2 px-2">
                <Link href={`/q/${id}/a/${a.id}`} className="link-more text-label">{`View ${a.replyCount} ${a.replyCount === 1 ? "reply" : "replies"}`}</Link>
                {a.agreeCount + a.disagreeCount > 0 ? <span className="text-caption text-[var(--ink-2)]">{`${a.agreeCount} agree · ${a.disagreeCount} disagree`}</span> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {state === "error" && items.length ? <div className="mt-3"><Problem error={err} onRetry={() => void loadPage(next ?? undefined)} /></div> : null}
      {next ? <div className="mt-3"><Button variant="secondary" size="l" block loading={state === "more"} onClick={() => void loadPage(next)}>Load more voices</Button></div> : null}
      {open ? <p className="mx-auto mb-32 mt-6 text-center dt:hidden"><Link href={writeHref} className="link-more text-label">Add your voice in words</Link></p> : null}

      {open ? (
        <div className="tk-dock fixed inset-x-0 bottom-[calc(var(--bottombar-h)+env(safe-area-inset-bottom,0px))] z-[var(--z-sticky)] border-t border-[var(--line)] bg-[var(--surface)] px-3 py-[10px] dt:hidden">
          <div className="flex items-center gap-[10px]">
            <Link href={writeHref} className="flex min-h-12 min-w-0 flex-1 items-center rounded-full bg-[var(--surface)] px-[18px] text-body text-[var(--ink-2)] no-underline shadow-[inset_0_0_0_1px_var(--line-strong)]">Add your voice in words</Link>
            {left !== undefined ? <FreePosts left={left} pill /> : null}
          </div>
        </div>
      ) : null}
      <TalkRail questionId={id} freeLeft={signedIn ? left : undefined} question={question} signedIn={!!signedIn} />
      {toast}
      {shareNode}
    </>
  );
}
