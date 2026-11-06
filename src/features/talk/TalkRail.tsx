"use client";
import { useEffect, useState } from "react";
import { FreePosts, TrendingList } from "@/components/vx";
import { AdCard } from "@/components/feed/AdCard";
import { trendItems } from "@/components/feed/trend";
import { Rail } from "@/components/shell/ShellSlots";
import { getTrendingQuestions } from "@/lib/api/feed";
import { getAdPlacement } from "@/lib/api/polls";
import type { AdPlacement } from "@/lib/api/polls";
import { getPublicConfig, getVoteAllowance, loadQuestionPolls } from "@/lib/api/vote";
import type { Allowances, Poll as PollT, PublicConfig, Question } from "@/lib/api/vote";
import { PollCard } from "@/features/vote/PollCard";

/** The desktop right rail of the Question and Thread boards: Trending (the API's), the person's free posts, and the ad when there is one. Each shows only when the API gave something. */
export function TalkRail({ questionId, freeLeft, question, signedIn = false }: { questionId: string; freeLeft?: number; question?: Question; signedIn?: boolean }) {
  const [trend, setTrend] = useState<ReturnType<typeof trendItems>>([]);
  const [ad, setAd] = useState<AdPlacement | null>(null);
  const [poll, setPoll] = useState<PollT | null>(null);
  const [allowance, setAllowance] = useState<Allowances | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  // lead ruling WF, 6 Nov (A-M7): the Question board's right rail opens with the poll card (open poll, options, Vote).
  useEffect(() => {
    if (!question) return undefined;
    let live = true;
    loadQuestionPolls(question).then((l) => live && setPoll(l.find((p) => p.status === "OPEN") ?? null), () => undefined);
    if (signedIn) getVoteAllowance().then((a) => live && setAllowance(a), () => undefined);
    else getPublicConfig().then((c) => live && setConfig(c), () => undefined);
    return () => { live = false; };
  }, [question, signedIn]);
  useEffect(() => {
    let live = true;
    getTrendingQuestions(4).then((r) => live && setTrend(trendItems(r.items.filter((q) => q.id !== questionId)).slice(0, 3)), () => undefined);
    getAdPlacement().then((a) => live && setAd(a), () => undefined);
    return () => { live = false; };
  }, [questionId]);
  return (
    <Rail>
      {poll ? (
        <section aria-label="Open poll">
          <PollCard poll={poll} signedIn={signedIn} allowance={allowance} config={config} />
        </section>
      ) : null}
      {freeLeft !== undefined ? (
        <section className="vx-card flex flex-col gap-2 p-4" aria-label="Your free posts">
          <h3 className="vx-eyebrow m-0">Your free posts</h3>
          <FreePosts left={freeLeft} />
        </section>
      ) : null}
      {trend.length ? <TrendingList items={trend} /> : null}
      {ad ? <AdCard ad={ad} inRail /> : null}
    </Rail>
  );
}
