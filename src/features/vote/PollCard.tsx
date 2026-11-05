"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Banner, Poll } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { castVote, getPoll, newKey } from "@/lib/api/vote";
import type { Allowances, Poll as PollT, PublicConfig, VoteReceipt } from "@/lib/api/vote";
import { closesIn } from "@/lib/feed-format";
import { BUY_UNITS_HREF, SIGN_IN_HREF } from "./links";
import { unitsText } from "./chrome";

type Note = { tone: "danger" | "info" | "warning" | "success"; title: string; text: string; buy?: boolean };

/** The line under a vote: what this vote costs, from the poll and the person's allowance (never typed into the page). */
export function costLines(poll: PollT, allowance: Allowances | null, config: PublicConfig | null): { confirm: string; note: string } {
  const perDay = allowance?.costs.freeVotesPerDay ?? config?.costs.freeVotesPerDay;
  const after = allowance?.costs.voteAfterFreeMilli ?? config?.costs.voteAfterFreeMilli;
  if (poll.publicInterest) return { confirm: "Free: this poll is always free to vote in.", note: "One vote per account. This poll is always free." };
  if (allowance) {
    const left = allowance.freeVotesLeftToday;
    if (left > 0) {
      return {
        confirm: `Free: you have ${left} free ${left === 1 ? "vote" : "votes"} left today. After that a vote uses ${unitsText(after ?? poll.costToVoteMilli)}.`,
        note: `One vote per account. Voting is free today: ${left} of ${allowance.costs.freeVotesPerDay} votes left.`,
      };
    }
    return {
      confirm: `This vote uses ${unitsText(poll.costToVoteMilli)}. You have ${unitsText(allowance.balanceMilli)}.`,
      note: `One vote per account. A vote uses ${unitsText(poll.costToVoteMilli)} now.`,
    };
  }
  const free = perDay ? `Free: you get ${perDay} free votes a day.` : "Free votes come with every account.";
  return {
    confirm: `${free}${after ? ` After that a vote uses ${unitsText(after)}.` : ""}`,
    note: perDay ? `One vote per account. You get ${perDay} free votes a day.` : "One vote per account.",
  };
}

/** A poll with its whole vote flow: pick, confirm, cast. A refused vote (402, 409, a network failure) never shows as a success. */
export function PollCard({
  poll,
  signedIn,
  allowance,
  config,
  onVoted,
  onExplain,
  onChanged,
}: {
  poll: PollT;
  signedIn: boolean;
  allowance: Allowances | null;
  config: PublicConfig | null;
  onVoted?: (r: VoteReceipt) => void;
  onExplain?: () => void;
  /** The poll moved on without this tap (already voted, closed): the parent reloads. */
  onChanged?: () => void;
}) {
  const [chosen, setChosen] = useState<string | null>(poll.myVote?.[0] ?? null);
  const busy = useRef(false);
  const key = useRef<string | null>(null);
  const [voted, setVoted] = useState<VoteReceipt | null>(null);
  const [fresh, setFresh] = useState<PollT | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const cur = fresh ?? poll;
  const mine = voted ? voted.vote.optionIds[0] : cur.myVote?.[0];
  const mode = voted || cur.myVote || cur.status === "CLOSED" ? "results" : "vote";
  const options = (voted ? voted.results.options : cur.options).map((o) => ({ id: o.id, label: o.label, votes: o.votes }));
  const total = voted ? voted.results.totalVotes : cur.totalVotes;
  const lines = costLines(cur, allowance, config);

  async function submit(optionId: string) {
    if (busy.current) return;
    if (!signedIn) {
      setNote({ tone: "info", title: "Sign in to vote", text: "You can read and listen without an account. Voting needs one, so every vote is one person." });
      return;
    }
    busy.current = true;
    setNote(null);
    key.current ??= newKey();
    try {
      const receipt = await castVote(cur.id, [optionId], key.current);
      key.current = null;
      setVoted(receipt);
      if (receipt.charge.costMilli > 0) {
        setNote({ tone: "success", title: "Vote counted", text: `It used ${unitsText(receipt.charge.costMilli)}. You have ${unitsText(receipt.charge.balanceMilli)} left.` });
      }
      onVoted?.(receipt);
    } catch (e) {
      // A vote still being sent keeps its key: asking again must find the same vote, not make a second one.
      const inProgress = e instanceof ApiError && e.status === 409 && e.code === "REQUEST_IN_PROGRESS";
      if (e instanceof ApiError && e.status > 0 && !inProgress) key.current = null;
      if (inProgress) {
        setNote({ tone: "info", title: "Your vote is still being sent", text: "Give it a moment, then tap Confirm vote again. It will count once." });
      } else if (e instanceof ApiError && e.status === 402) {
        const d = (e.details ?? {}) as { costMilli?: number };
        const need = d.costMilli ?? cur.costToVoteMilli;
        setNote({
          tone: "danger",
          title: "Your vote did not count",
          text: `${e.explained ? e.message : `You need ${unitsText(need)} to vote.`} Nothing was charged.`,
          buy: true,
        });
      } else if (e instanceof ApiError && e.status === 409 && (e.code === "ALREADY_VOTED" || e.code === "POLL_CLOSED")) {
        try {
          setFresh(await getPoll(cur.id));
        } catch {
          /* the parent reload below covers it */
        }
        setNote(
          e.code === "ALREADY_VOTED"
            ? { tone: "info", title: "You have already voted", text: "One vote per account. You cannot change it." }
            : { tone: "info", title: "This poll has closed", text: "Votes are no longer counted. The final results are below." },
        );
        onChanged?.();
      } else if (e instanceof ApiError && e.status === 429) {
        setNote({ tone: "warning", title: "Slow down a moment", text: "Too many votes in a short time. Try again in a minute. Nothing was charged." });
      } else if (e instanceof ApiError && e.status > 0) {
        setNote({ tone: "danger", title: "Your vote did not count", text: `${e.explained ? e.message : "Something went wrong on our side."} Nothing was charged.` });
      } else {
        setNote({ tone: "warning", title: "We could not confirm your vote", text: "Check your connection and tap Confirm vote again. You will not be charged twice." });
      }
    } finally {
      busy.current = false;
    }
  }

  if (cur.status === "SCHEDULED") {
    return <Banner tone="info" title="This poll has not opened yet">Come back when it opens to vote.</Banner>;
  }

  return (
    <div className="flex flex-col gap-3">
      {note ? (
        <Banner tone={note.tone} title={note.title}>
          {note.text}
          {note.buy && BUY_UNITS_HREF ? (
            <>
              {" "}
              <Link href={BUY_UNITS_HREF}>Buy Voice Units</Link>
            </>
          ) : null}
          {!signedIn && SIGN_IN_HREF ? (
            <>
              {" "}
              <Link href={SIGN_IN_HREF}>Sign in</Link>
            </>
          ) : null}
        </Banner>
      ) : null}
      <div>
        <Poll
          key={`${cur.id}-${mode}`}
          question={cur.title}
          options={options}
          total={total}
          closesIn={cur.status === "OPEN" ? closesIn(cur.endsAt) : undefined}
          state={mode}
          cost={lines.confirm}
          costNote={lines.note}
          live={cur.status === "OPEN"}
          onExplain={mine && onExplain ? onExplain : false}
          voted={mode === "results"}
          closed={cur.status === "CLOSED"}
          selected={mode === "vote" ? chosen ?? undefined : mine ?? undefined}
          onSelect={setChosen}
          onConfirm={submit}
        />
      </div>
    </div>
  );
}
