"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Banner, Poll } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { castVote, getPoll, getVoteAllowance, type Allowances, type Poll as PollData } from "@/lib/api/polls";
import { closesIn, unitsLabel } from "@/lib/feed-format";

/** The API's own words for a refusal; our own only when it said nothing (offline, or no explanation). */
function message(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "You are offline. Check your connection and try again.";
    if (e.explained) return e.message;
  }
  return "That vote did not go through. Try again.";
}

/**
 * One flash poll. Signed in and not yet voted: the vote flow (choose, check the cost, confirm), and the vote is sent to the API
 * when the person confirms. Voted, or a guest: the results. The design-system Poll holds its own steps; the confirm tap is
 * caught here so the vote is a real POST and the figures that come back are the real ones.
 */
export function FlashPoll({ poll, signedIn }: { poll: PollData; signedIn: boolean }) {
  const [live, setLive] = useState(poll);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allow, setAllow] = useState<Allowances | null>(null);
  const key = useRef<string | null>(null);
  useEffect(() => setLive(poll), [poll]);

  const voted = !!live.myVote?.length;
  const showVote = signedIn && !voted && live.status === "OPEN";

  useEffect(() => {
    if (!showVote) return;
    let on = true;
    getVoteAllowance().then((a) => on && setAllow(a), () => undefined);
    return () => {
      on = false;
    };
  }, [showVote]);

  const options = live.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes ?? 0 }));
  const left = allow?.freeVotesLeftToday ?? null;
  const perDay = allow?.costs.freeVotesPerDay ?? null;
  const priceMilli = allow?.costs.voteAfterFreeMilli ?? live.costToVoteMilli;
  const free = live.publicInterest || (left !== null ? left > 0 : live.costToVoteMilli === 0);
  const costNote = live.publicInterest
    ? "One vote per account. Voting is free on this poll."
    : left === null
      ? free
        ? "One vote per account. This vote is free for you."
        : `One vote per account. This vote costs ${unitsLabel(priceMilli)}.`
      : free
        ? `One vote per account. Voting is free today: ${left} of ${perDay} votes left.`
        : `One vote per account. This vote costs ${unitsLabel(priceMilli)}.`;
  const cost = live.publicInterest
    ? "Free: this poll is always free."
    : left === null
      ? free
        ? "Free for you."
        : `This vote costs ${unitsLabel(priceMilli)}.`
      : free
        ? `Free: ${left - 1} of ${perDay} free votes left today.`
        : `This vote costs ${unitsLabel(priceMilli)}.`;

  async function confirm(e: MouseEvent<HTMLDivElement>) {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn || btn.textContent?.trim() !== "Confirm vote") return;
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    const label = e.currentTarget.querySelector(".vx-poll__choice")?.textContent?.trim();
    const opt = live.options.find((o) => o.label === label);
    if (!opt) return;
    setBusy(true);
    setError(null);
    key.current ??= crypto.randomUUID();
    try {
      const r = await castVote(live.id, opt.id, key.current);
      key.current = null;
      setLive({ ...live, totalVotes: r.results.totalVotes, options: r.results.options, myVote: r.vote.optionIds, status: r.results.status });
      setVersion((v) => v + 1);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALREADY_VOTED") {
        key.current = null;
        const mine = await getPoll(live.id).catch(() => null);
        if (mine) {
          setLive(mine);
          setVersion((v) => v + 1);
        } else {
          setError(message(err));
        }
      } else {
        setError(message(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const close = closesIn(live.endsAt);
  return (
    <div onClickCapture={showVote ? confirm : undefined} aria-busy={busy} className={busy ? "pointer-events-none opacity-70" : undefined}>
      {error ? (
        <div className="mb-3"><Banner tone="danger" title="Your vote was not counted" onClose={() => setError(null)}>{error}</Banner></div>
      ) : null}
      <Poll
        key={`${live.id}-${version}-${showVote ? "v" : "r"}`}
        question={live.title}
        options={options}
        total={live.totalVotes}
        closesIn={close}
        state={showVote ? "vote" : "results"}
        selected={live.myVote?.[0]}
        costNote={costNote}
        cost={cost}
        onExplain={false}
      />
    </div>
  );
}
