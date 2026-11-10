"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Banner, Button, Composer, EmptyState, Poll } from "@/components/vx";
import { ShareSheet } from "@/features/share";
import { StageNav } from "@/features/stage/StageNav";
import { ApiError } from "@/lib/api/client";
import { explainMyVote, getPollResults, getQuestion, loadQuestionPolls, newKey } from "@/lib/api/vote";
import type { Poll as PollT, PollResults, Question } from "@/lib/api/vote";
import { closesIn, voicesOf } from "@/lib/feed-format";
import { AdBanner } from "./AdBanner";
import { AppBar, nextOpening, useOpensAt, DeskBack, LoadFailed, Loading, PageHead, ShareButton, shortCount, useLoadWhen, useSignedIn, weekPollLine } from "./chrome";
import { DeskRail } from "./DeskRail";
import { leaderFirst } from "@/lib/format/plural";
import type { Mood } from "@/lib/api/mood";
import { MoodWordPicker } from "@/features/mood/MoodChip";
import { readPick } from "@/features/mood/mood";
import { listMyAnswers } from "@/lib/api/profile";
import { pickPoll } from "./poll-pick";
import { useRouter } from "next/navigation";

/** How often live results are read again: the API caches them for 2 to 5 seconds (CONVENTIONS, Ranking and caching). */
export const RESULTS_POLL_MS = 5000;

interface Data {
  question: Question;
  poll: PollT | null;
  results: PollResults | null;
  hidden: boolean;
}

async function loadAll(questionId: string): Promise<Data> {
  const question = await getQuestion(questionId);
  const poll = pickPoll(await loadQuestionPolls(question)) ?? null;
  if (!poll) return { question, poll: null, results: null, hidden: false };
  try {
    return { question, poll, results: await getPollResults(poll.id), hidden: false };
  } catch (e) {
    // The API keeps counts back until the person has voted or the poll has closed.
    if (e instanceof ApiError && e.status === 403) return { question, poll, results: null, hidden: true };
    throw e;
  }
}

/** /q/[id]/results: the bars, live while the poll is open, and Explain my vote. */
export function ResultsPage({ questionId }: { questionId: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const load = useLoadWhen<Data>(() => loadAll(questionId), [questionId, signedIn], signedIn !== null);
  const [live, setLive] = useState<PollResults | null>(null);
  const [share, setShare] = useState(false);
  const pollId = load.state === "ready" ? load.data.poll?.id : undefined;
  const status = live?.status ?? (load.state === "ready" ? load.data.poll?.status : undefined);
  const open = load.state === "ready" && status === "OPEN" && !load.data.hidden;

  // Live results: read again every few seconds while the poll is open and the tab is visible. Never faked.
  useEffect(() => {
    if (!open || !pollId) return undefined;
    let stop = false;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      getPollResults(pollId).then(
        (r) => !stop && setLive(r), // every answer carries the poll's status: a close shows at once and stops the polling
        () => undefined,
      );
    };
    const id = setInterval(tick, RESULTS_POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [open, pollId]);

  useOpensAt(load.state === "ready" ? nextOpening([load.data.poll]) : null, () => (load.state === "ready" ? load.reload() : undefined));

  const q = load.state === "ready" ? load.data.question : null;
  const poll = load.state === "ready" ? load.data.poll : null;
  const results = live ?? (load.state === "ready" ? load.data.results : null);
  const shareBtn = poll && results ? <ShareButton label="Share the result" onClick={() => setShare(true)} /> : null;
  const voted = !!(results?.myVote && results.myVote.length) || !!poll?.myVote;
  const mineId = results?.myVote?.[0] ?? poll?.myVote?.[0];
  const mineLabel = poll?.options.find((o) => o.id === mineId)?.label;

  return (
    <div className="vt-page">
      <AppBar href={`/q/${questionId}/vote`} backLabel="Back" title="Results so far" sub={weekPollLine(q)} right={shareBtn} />
      <DeskBack href={`/q/${questionId}`} label="Back to the conversation" right={shareBtn} />
      <StageNav
        questionId={questionId}
        active="vote"
        visited={["speak", "discuss"]}
        counts={q ? { speak: shortCount(voicesOf(q)), discuss: shortCount(voicesOf(q)), vote: poll ? shortCount(results?.totalVotes ?? poll.totalVotes) : "0", next: shortCount(q.proposalCount) } : undefined}
      />
      <DeskRail kind="results" questionId={questionId} />
      {load.state === "loading" || signedIn === null ? <Loading /> : null}
      {load.state === "error" ? <LoadFailed error={load.error} retry={load.retry} what="this poll" /> : null}
      {load.state === "ready" && !poll ? <EmptyState icon="vote" title="No poll on this question yet" body="Polls open with the question or during the week." /> : null}
      {load.state === "ready" && poll && load.data.hidden && status !== "SCHEDULED" ? (
        <EmptyState
          icon="vote"
          title="Vote to see the results"
          body="The bars show once you have voted, or when the poll closes. Votes stay one per account."
          action="Vote"
          actionIcon="check"
          onAction={() => router.push(`/q/${questionId}/vote`)}
        />
      ) : null}
      {load.state === "ready" && poll && status === "SCHEDULED" ? (
        <Banner tone="info" title="This poll has not opened yet">Come back when it opens to see the results.</Banner>
      ) : null}
      {load.state === "ready" && poll && results && status !== "SCHEDULED" ? (
        <>
          <PageHead eyebrow={weekPollLine(load.data.question).toUpperCase()} title="Results so far" lead={voted && status === "OPEN" ? "Thanks for voting. The bars move as votes come in until the poll closes." : undefined} />
          {status === "CLOSED" ? <Banner tone="info" title="This poll has closed">These are the final results. One vote per account was counted.</Banner> : null}
          <Poll
            key={poll.id + (results.myVote?.length ? "m" : "")}
            question={poll.title}
            options={leaderFirst(results.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes })))}
            total={results.totalVotes}
            closesIn={status === "OPEN" ? closesIn(poll.endsAt) : undefined}
            state="results"
            selected={mineId}
            live={status === "OPEN"}
            closed={status === "CLOSED"}
            onExplain={false}
          />
          {voted && mineLabel ? <Explain pollId={poll.id} label={mineLabel} questionId={questionId} signedIn={!!signedIn} moodOptions={load.data.question.moodOptions} /> : null}
          <div className="vt-btnrow">
            <Button variant="secondary" icon="message-circle" href={`/q/${questionId}`}>Back to the discussion</Button>
            <Button variant="ghost" icon="share-2" onClick={() => setShare(true)}><span className="dt:hidden">Share</span><span className="hidden dt:inline">Share the result</span></Button>
          </div>
          <AdBanner questionId={questionId} />
        </>
      ) : null}
      {share && poll ? <ShareSheet objectType="POLL_RESULT" objectId={poll.id} onClose={() => setShare(false)} /> : null}
    </div>
  );
}

/** Explain my vote (free, V-15). By voice waits for the recorder (W4); In words writes the reason into the discussion. */
function Explain({ pollId, label, questionId, signedIn, moodOptions }: { pollId: string; label: string; questionId: string; signedIn: boolean; moodOptions?: readonly Mood[] }) {
  // LCH-02: on a mood question the reason is an answer, so it carries one word, picked here as on the pick screen.
  const [word, setWord] = useState<Mood | null>(null);
  const needsWord = !!moodOptions?.length;
  // G9: the person already gave a word on this question; ask for it again only if it cannot be found. First the one kept in
  // this browser, else their own answer to the question.
  useEffect(() => {
    if (!needsWord || !signedIn) return;
    const kept = readPick(questionId);
    if (kept && moodOptions!.includes(kept)) { setWord(kept); return; }
    let live = true;
    listMyAnswers()
      .then((page) => {
        const mine = page.items.find((x) => x.answer?.questionId === questionId && x.answer.mood && moodOptions!.includes(x.answer.mood));
        if (live && mine?.answer?.mood) setWord((w) => w ?? mine.answer!.mood!);
      })
      .catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsWord, signedIn, questionId]);
  const [writing, setWriting] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | { error: string }>("idle");
  const busy = useRef(false);
  const key = useRef<string | null>(null);

  async function send(typed: string) {
    const text = typed.trim();
    if (!text || busy.current) return;
    if (needsWord && !word) { setState({ error: "Pick one word first." }); return; }
    busy.current = true;
    setState("sending");
    key.current ??= newKey();
    try {
      await explainMyVote(pollId, text, key.current, needsWord ? word : null, questionId);
      key.current = null;
      setState("done");
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) key.current = null;
      setState({ error: e instanceof ApiError && e.status > 0 && e.explained ? e.message : "We could not post that. Check your connection and try again." });
    } finally {
      busy.current = false;
    }
  }

  return (
    <section className="vt-explaincard" aria-label="Explain my vote">
      <h2 className="vt-explaincard__title">Explain my vote</h2>
      <p className="vt-lead">{`Say why you picked “${label}”. It joins the discussion under the question.`}</p>
      {state === "done" ? (
        <Banner tone="success" title="Posted">
          Your reason is in the discussion. <Link href={`/q/${questionId}`} className="link">Open the discussion</Link>
        </Banner>
      ) : writing ? (
        <div className="vt-explain">
          {typeof state === "object" ? <Banner tone="danger" title="Not posted">{state.error}</Banner> : null}
          {needsWord ? (
            <>
              <p className="m-0 text-caption text-ink-2">{word ? "Your word goes with your reason. Tap another to change it." : "Pick one word to go with your reason."}</p>
              <MoodWordPicker words={moodOptions!} value={word} onChange={setWord} />
            </>
          ) : null}
          <Composer label="Your reason" placeholder="Say why you voted this way" meter={false} value={reason} onChange={setReason} busy={state === "sending"} onSubmit={(t) => void send(t)} onVoice={false} />
        </div>
      ) : (
        <div className="vt-btnrow">
          <Button variant="secondary" icon="message-square" onClick={() => setWriting(true)}>In words</Button>
        </div>
      )}
      {!signedIn ? <Banner tone="info">Sign in to explain your vote.</Banner> : null}
    </section>
  );
}
