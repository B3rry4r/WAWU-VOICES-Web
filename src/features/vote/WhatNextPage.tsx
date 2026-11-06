"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, EmptyState, ProposalCard, Tabs } from "@/components/vx";
import { ShareSheet } from "@/features/share";
import { StageNav } from "@/features/stage/StageNav";
import { ApiError } from "@/lib/api/client";
import { getWhatNext, listProposals, removeStance, setStance } from "@/lib/api/vote";
import type { EditorialSummary, Proposal, ProposalGroup, ProposalSort, WhatNext } from "@/lib/api/vote";
import { ago } from "@/lib/feed-format";
import { DeskRail } from "./DeskRail";
import { useWhatNextPrompt } from "./prompt";
import { AppBar, DeskBack, LoadFailed, Loading, ShareButton, shortCount, useLoadWhen, useSignedIn } from "./chrome";

const fmt = (n: number) => n.toLocaleString("en-NG");

/** "2 hours ago", "just now": the footnote's update time. */
export function updatedAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

function Summary({ s, proposals, groups }: { s: EditorialSummary; proposals: number; groups: number }) {
  return (
    <section className="vt-summary" aria-label="Editorial summary">
      <div className="vt-summary__top">
        <span className="vx-eyebrow">Editorial summary</span>
        {s.reviewedByEditor ? <span className="vt-summary__rev">Reviewed by an editor</span> : null}
      </div>
      <h2>Where the conversation stands so far</h2>
      <div className="vt-summary__blk">
        <p className="vx-eyebrow">Main arguments</p>
        <div className="vt-summary__row">
          <p>{`Most voices so far lean towards: ${s.mainView}`}</p>
          <span className="vt-summary__n">{`${fmt(s.mainViewVoices)} ${s.mainViewVoices === 1 ? "voice" : "voices"}`}</span>
        </div>
        <div className="vt-summary__row">
          <p>{`The main opposing view: ${s.opposingView}`}</p>
          <span className="vt-summary__n">{`${fmt(s.opposingViewVoices)} ${s.opposingViewVoices === 1 ? "voice" : "voices"}`}</span>
        </div>
      </div>
      <div className="vt-summary__blk">
        <p className="vx-eyebrow">The poll so far</p>
        <p>{s.pollLine}</p>
      </div>
      <div className="vt-summary__blk">
        <p className="vx-eyebrow">Proposed next steps</p>
        <p>{`${fmt(proposals)} ${proposals === 1 ? "proposal" : "proposals"} in ${fmt(groups)} ${groups === 1 ? "group" : "groups"}. ${s.nextStepsLine}`}</p>
      </div>
      <div className="vt-summary__foot">
        <p>{`Based on ${fmt(s.basedOnVoices)} ${s.basedOnVoices === 1 ? "voice" : "voices"} and ${fmt(s.basedOnVotes)} ${s.basedOnVotes === 1 ? "vote" : "votes"}. Updated ${updatedAgo(s.updatedAt)}. These are proposals, not decisions.`}</p>
      </div>
    </section>
  );
}

/** One proposal with Support, Challenge and Improve it wired to the API. The card is controlled: it shows what the server last said. */
export function ProposalItem({ p, groups, signedIn, questionId, onNeedSignIn, onSupported }: { p: Proposal; groups: Map<string, ProposalGroup>; signedIn: boolean; questionId: string; onNeedSignIn: () => void; onSupported?: () => void }) {
  const router = useRouter();
  const [cur, setCur] = useState(p);
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);
  useEffect(() => setCur(p), [p]);

  const g = cur.groupId ? groups.get(cur.groupId) : undefined;
  const grouped = g && g.confirmed && g.topProposal?.id === cur.id && g.proposalCount > 1 ? g.proposalCount - 1 : 0;

  async function tap(kind: "SUPPORT" | "CHALLENGE") {
    if (busy.current) return;
    if (!signedIn) {
      onNeedSignIn();
      return;
    }
    busy.current = true;
    setErr(null);
    try {
      const next = cur.myStance === kind ? await removeStance(cur.id) : await setStance(cur.id, kind);
      setCur(next);
      if (next.myStance === "SUPPORT") onSupported?.();
    } catch (e) {
      setCur({ ...cur });
      setErr(e instanceof ApiError && e.status > 0 && e.explained ? e.message : "That did not go through. Try again.");
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ProposalCard
        author={cur.author.displayName ?? cur.author.handle}
        time={ago(cur.createdAt)}
        text={cur.body ?? ""}
        supports={cur.supportCount}
        challenges={cur.challengeCount}
        grouped={grouped || undefined}
        stance={cur.myStance === "SUPPORT" ? "support" : cur.myStance === "CHALLENGE" ? "challenge" : null}
        onSupport={() => void tap("SUPPORT")}
        onChallenge={() => void tap("CHALLENGE")}
        onImprove={() => router.push(`/q/${questionId}/propose?improves=${cur.id}`)}
      />
      {err ? <Banner tone="danger">{err}</Banner> : null}
    </div>
  );
}

/** /q/[id]/next: the editor-reviewed summary and the proposals people support, challenge or improve. */
export function WhatNextPage({ questionId }: { questionId: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const [sort, setSort] = useState<ProposalSort>("SUPPORT");
  const [more, setMore] = useState<{ items: Proposal[]; cursor: string | null } | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [share, setShare] = useState(false);
  const [signNote, setSignNote] = useState(false);
  const load = useLoadWhen<WhatNext>(() => getWhatNext(questionId, sort), [questionId, sort, signedIn], signedIn !== null);
  useEffect(() => setMore(null), [sort, questionId]);

  const d = load.state === "ready" ? load.data : null;
  const q = d?.question ?? null;
  const prompt = useWhatNextPrompt(q?.topicId);
  const groups = new Map((d?.groups ?? []).map((g) => [g.id, g]));
  const items = d ? [...d.proposals, ...(more?.items ?? [])] : [];
  const cursor = more ? more.cursor : d?.nextCursor ?? null;

  async function loadMore() {
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    try {
      const page = await listProposals(questionId, sort, cursor);
      setMore({ items: [...(more?.items ?? []), ...page.items], cursor: page.nextCursor });
    } catch {
      /* the button stays; a second tap tries again */
    } finally {
      setMoreBusy(false);
    }
  }

  const shareBtn = d?.summary ? <ShareButton label="Share this summary" onClick={() => setShare(true)} /> : null;
  const proposeBtn = (
    <Button size="l" block icon="lightbulb" href={`/q/${questionId}/propose`}>Propose a next step</Button>
  );

  return (
    <div className="vt-page">
      <AppBar href={`/q/${questionId}`} backLabel="Back to the conversation" title="What Next?" sub={q?.topicTitle ? (q.weekNumber ? `Week ${q.weekNumber} · ${q.topicTitle}` : q.topicTitle) : undefined} right={shareBtn} />
      <DeskBack href={`/q/${questionId}`} label="Back to the conversation" right={shareBtn} />
      <StageNav
        questionId={questionId}
        active="next"
        visited={["speak", "discuss", "vote"]}
        counts={q ? { speak: shortCount(q.voiceCount), discuss: shortCount(q.answerCount), next: shortCount(d?.proposalTotal ?? q.proposalCount) } : undefined}
      />
      <DeskRail kind="next" questionId={questionId} question={q} />
      {load.state === "loading" || signedIn === null ? <Loading /> : null}
      {load.state === "error" ? <LoadFailed error={load.error} retry={load.retry} what="this question" /> : null}
      {d ? (
        <>
          {q?.topicTitle ? <p className="vx-eyebrow m-0 hidden text-green-text dt:block">{"What Next? "}<span className="font-medium normal-case tracking-normal text-ink-2">{q.weekNumber ? `Week ${q.weekNumber} · ${q.topicTitle}` : q.topicTitle}</span></p> : null}
          <h1 className="vt-hero-q">{prompt === undefined ? "" : prompt ?? d.question.text}</h1>
          {d.summary ? <Summary s={d.summary} proposals={d.proposalTotal} groups={d.groupTotal} /> : null}
          <div className="hidden dt:block">{proposeBtn}</div>
          <div>
            <h2 className="vt-section-title mb-3 mt-2">Proposals</h2>
            <Tabs
              label="Sort proposals"
              value={sort}
              onChange={(id) => setSort(id as ProposalSort)}
              items={[
                { id: "SUPPORT", label: "Most supported" },
                { id: "NEW", label: "Newest" },
              ]}
            />
            <p className="vt-note mt-3">Similar proposals are grouped. Groups are suggested automatically and a moderator confirms each one.</p>
          </div>
          {signNote ? <Banner tone="info" title="Sign in to support or challenge" onClose={() => setSignNote(false)}>Reading is open to everyone. Supporting, challenging and proposing need an account.</Banner> : null}
          {items.length === 0 ? (
            <EmptyState icon="lightbulb" title="No proposals yet" body="Be the first to say who should do what, and by when." action="Propose a next step" actionIcon="lightbulb" onAction={() => router.push(`/q/${questionId}/propose`)} />
          ) : (
            items.map((p) => <ProposalItem key={p.id} p={p} groups={groups} signedIn={!!signedIn} questionId={questionId} onNeedSignIn={() => setSignNote(true)} />)
          )}
          {cursor ? (
            <Button variant="secondary" block loading={moreBusy} onClick={() => void loadMore()}>Show more proposals</Button>
          ) : null}
          {items.length ? <div className="vt-actionbar dt:hidden">{proposeBtn}</div> : null}
        </>
      ) : null}
      {share && d?.summary ? <ShareSheet objectType="WHAT_NEXT_SUMMARY" objectId={questionId} onClose={() => setShare(false)} /> : null}
    </div>
  );
}

