"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/vx";
import { ShareSheet } from "@/features/share";
import { StageNav } from "@/features/stage/StageNav";
import { getPublicConfig, getQuestion, getVoteAllowance, loadQuestionPolls } from "@/lib/api/vote";
import type { Allowances, Poll, PublicConfig, Question } from "@/lib/api/vote";
import { AppBar, nextOpening, useOpensAt, DeskBack, LoadFailed, Loading, PageHead, ShareButton, shortCount, useLoadWhen, useSignedIn, weekPollLine } from "./chrome";
import { DeskRail } from "./DeskRail";
import { PollCard } from "./PollCard";
import { pickPoll } from "./poll-pick";

interface Data {
  question: Question;
  main: Poll | null;
  others: Poll[];
  allowance: Allowances | null;
  config: PublicConfig | null;
}

/** /q/[id]/vote: the question's poll, the vote and its cost, and the other polls on the conversation. */
export function VotePage({ questionId }: { questionId: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [share, setShare] = useState<string | null>(null);
  const load = useLoadWhen<Data>(
    async () => {
      const question = await getQuestion(questionId);
      const [polls, allowance, config] = await Promise.all([
        loadQuestionPolls(question),
        signedIn ? getVoteAllowance().catch(() => null) : Promise.resolve(null),
        signedIn ? Promise.resolve(null) : getPublicConfig().catch(() => null),
      ]);
      const main = pickPoll(polls) ?? null;
      const others = polls.filter((p) => p.id !== main?.id);
      return { question, main, others, allowance, config };
    },
    [questionId, signedIn],
    signedIn !== null,
  );

  // A person who has voted, or a closed poll, belongs on the results (the drawn voted state).
  const redirect = load.state === "ready" && load.data.main && (load.data.main.myVote || load.data.main.status === "CLOSED");
  useEffect(() => {
    if (redirect) router.replace(`/q/${questionId}/results`);
  }, [redirect, router, questionId]);

  // A poll that opens by its dates while the page is open flips to open without a reload.
  useOpensAt(load.state === "ready" ? nextOpening([load.data.main, ...load.data.others]) : null, () => (load.state === "ready" ? load.reload() : undefined));

  const q = load.state === "ready" ? load.data.question : null;
  const main = load.state === "ready" ? load.data.main : null;
  const shareBtn = main ? <ShareButton label="Share this poll" onClick={() => setShare(main.id)} /> : null;

  return (
    <div className="vt-page">
      <AppBar href={`/q/${questionId}`} backLabel="Back" title="Vote" sub={weekPollLine(q)} right={shareBtn} />
      <DeskBack href={`/q/${questionId}`} label="Back to the conversation" right={shareBtn} />
      <StageNav
        questionId={questionId}
        active="vote"
        visited={["speak", "discuss"]}
        counts={q ? { speak: shortCount(q.voiceCount), discuss: shortCount(q.answerCount), vote: main ? shortCount(main.totalVotes) : "0", next: shortCount(q.proposalCount) } : undefined}
      />
      <DeskRail kind="vote" questionId={questionId} />
      {load.state === "loading" || signedIn === null ? <Loading /> : null}
      {load.state === "error" ? <LoadFailed error={load.error} retry={load.retry} what="this question" /> : null}
      {load.state === "ready" && !load.data.main ? (
        <EmptyState icon="vote" title="No poll on this question yet" body="Polls open with the question or during the week. You can still speak, listen and read the discussion." />
      ) : null}
      {load.state === "ready" && load.data.main && !redirect ? (
        <>
          <PageHead eyebrow={weekPollLine(load.data.question).toUpperCase()} title="Vote" lead={load.data.question.topicTitle ? `${load.data.question.topicTitle}. Pick one, then confirm. You can explain your vote after.` : "Pick one, then confirm. You can explain your vote after."} />
          <PollCard
            poll={load.data.main}
            signedIn={!!signedIn}
            allowance={load.data.allowance}
            config={load.data.config}
            onVoted={() => router.push(`/q/${questionId}/results`)}
            onChanged={() => router.replace(`/q/${questionId}/results`)}
          />
          {load.data.others.length ? (
            <section className="mt-2 flex flex-col gap-3" aria-label="More polls on this topic">
              <h2 className="vt-section-title">More polls on this topic</h2>
              {load.data.others.map((p) => (
                <PollCard key={p.id} poll={p} signedIn={!!signedIn} allowance={load.data.allowance} config={load.data.config} onChanged={load.reload} />
              ))}
            </section>
          ) : null}
        </>
      ) : null}
      {share ? <ShareSheet objectType="POLL_RESULT" objectId={share} onClose={() => setShare(null)} /> : null}
    </div>
  );
}
