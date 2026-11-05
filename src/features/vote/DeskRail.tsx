"use client";

import { useEffect, useState } from "react";
import { Badge, Poll, TrendingList } from "@/components/vx";
import { AdCard } from "@/components/feed/AdCard";
import { trendItems } from "@/components/feed/trend";
import { Rail } from "@/components/shell/ShellSlots";
import { getTrendingQuestions } from "@/lib/api/feed";
import { getAdPlacement } from "@/lib/api/polls";
import type { AdPlacement } from "@/lib/api/polls";
import { getPollResults, loadQuestionPolls } from "@/lib/api/vote";
import type { Poll as PollT, PollResults, Question } from "@/lib/api/vote";
import { closesIn } from "@/lib/feed-format";
import { pickPoll } from "./poll-pick";

export type RailKind = "vote" | "results" | "next" | "propose";

/** What the 1440 boards draw in the right rail of each screen. Each piece shows only when the API gave something: an empty rail stays empty. */
export function DeskRail({ kind, questionId, question }: { kind: RailKind; questionId: string; question?: Question | null }) {
  const [trend, setTrend] = useState<ReturnType<typeof trendItems>>([]);
  const [ad, setAd] = useState<AdPlacement | null>(null);
  const [poll, setPoll] = useState<{ poll: PollT; results: PollResults } | null>(null);

  useEffect(() => {
    let live = true;
    getTrendingQuestions(4).then(
      (r) => live && setTrend(trendItems(r.items.filter((q) => q.id !== questionId)).slice(0, 3)),
      () => undefined,
    );
    if (kind === "vote") getAdPlacement().then((a) => live && setAd(a), () => undefined);
    return () => {
      live = false;
    };
  }, [kind, questionId]);

  useEffect(() => {
    if (kind !== "next" || !question) return undefined;
    let live = true;
    loadQuestionPolls(question)
      .then(async (polls) => {
        const p = pickPoll(polls);
        if (!p) return;
        const results = await getPollResults(p.id);
        if (live) setPoll({ poll: p, results });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [kind, question]);

  return (
    <Rail>
      {kind === "propose" ? (
        <aside className="vt-rail" aria-label="How proposals work">
          <span className="vx-eyebrow">How proposals work</span>
          <Badge tone="proposed" icon="lightbulb" />
          <p className="vt-lead m-0">Every proposal is labelled Proposed and shows how many people support or challenge it. Anyone can improve one. Similar proposals are grouped once a moderator confirms. Nothing here is a decision.</p>
        </aside>
      ) : null}
      {kind === "next" && poll ? (
        <Poll
          question={poll.poll.title}
          options={poll.results.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes }))}
          total={poll.results.totalVotes}
          closesIn={poll.poll.status === "OPEN" ? closesIn(poll.poll.endsAt) : undefined}
          state="results"
          selected={poll.results.myVote?.[0]}
          live={poll.poll.status === "OPEN"}
          onExplain={false}
        />
      ) : null}
      {trend.length ? <TrendingList items={trend} /> : null}
      {kind === "vote" ? <AdCard ad={ad} inRail /> : null}
    </Rail>
  );
}
