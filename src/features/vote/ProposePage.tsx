"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { Badge, Banner, Composer, Icon } from "@/components/vx";
import { StageNav } from "@/features/stage/StageNav";
import { ApiError } from "@/lib/api/client";
import { createProposal, getPublicConfig, getQuestion, newKey, similarProposals } from "@/lib/api/vote";
import type { Proposal, Question } from "@/lib/api/vote";
import { AppBar, DeskBack, LoadFailed, Loading, shortCount, useLoadWhen, useSignedIn } from "./chrome";
import { ProposalItem } from "./WhatNextPage";

/** How long to wait after the last keystroke before looking for similar proposals. */
const CHECK_DELAY_MS = 600;
const MIN_CHARS = 5;

/** /q/[id]/propose: write a next step; before it is posted, up to 3 similar proposals are offered to support instead. Free (V-15). */
export function ProposePage({ questionId }: { questionId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const improves = params?.get("improves") ?? undefined;
  const signedIn = useSignedIn();
  const load = useLoadWhen(
    async () => {
      const [question, config] = await Promise.all([getQuestion(questionId), getPublicConfig().catch(() => null)]);
      return { question, max: config?.costs.textMaxChars };
    },
    [questionId],
    signedIn !== null,
  );
  const [similar, setSimilar] = useState<Proposal[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [signNote, setSignNote] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const key = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onInput = (e: FormEvent<HTMLDivElement>) => {
    const text = (e.target as HTMLTextAreaElement).value ?? "";
    if (timer.current) clearTimeout(timer.current);
    const mine = ++seq.current;
    if (text.trim().length < MIN_CHARS) {
      setSimilar([]);
      return;
    }
    timer.current = setTimeout(() => {
      similarProposals(questionId, text.trim()).then(
        (r) => mine === seq.current && setSimilar(r.items.slice(0, 3)),
        () => mine === seq.current && setSimilar([]),
      );
    }, CHECK_DELAY_MS);
  };

  async function post() {
    const text = box.current?.querySelector("textarea")?.value.trim() ?? "";
    if (!text || busy.current) return;
    if (!signedIn) {
      setSignNote(true);
      return;
    }
    busy.current = true;
    setSending(true);
    setError(null);
    key.current ??= newKey();
    try {
      await createProposal(questionId, text, key.current, improves);
      key.current = null;
      router.push(`/q/${questionId}/next`);
    } catch (e) {
      if (e instanceof ApiError && e.status > 0) key.current = null;
      if (e instanceof ApiError && e.status === 429) setError({ title: "Slow down a moment", text: "You have posted a lot in a short time. Try again in a few minutes." });
      else if (e instanceof ApiError && e.status === 403) setError({ title: "You cannot post right now", text: e.explained ? e.message : "Finish your profile first, then try again." });
      else if (e instanceof ApiError && e.status === 409) setError({ title: "This question is closed", text: "New proposals are not taken any more." });
      else if (e instanceof ApiError && e.status > 0) setError({ title: "Not posted", text: e.explained ? e.message : "Something went wrong on our side. Try again in a moment." });
      else setError({ title: "We could not post that", text: "Check your connection and tap Post again. It will not post twice." });
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (btn && (btn.textContent ?? "").trim() === "Post") {
      e.stopPropagation();
      e.preventDefault();
      void post();
    }
  };

  const q: Question | null = load.state === "ready" ? load.data.question : null;
  const week = q?.topicTitle ? (q.weekNumber ? `Week ${q.weekNumber} · ${q.topicTitle}` : q.topicTitle) : null;

  return (
    <div className="vt-page vt-propose">
      <AppBar href={`/q/${questionId}/next`} backLabel="Close without posting" title="Propose a next step" sub="What Next?" close />
      <DeskBack href={`/q/${questionId}/next`} label="Back to What Next?" />
      <div className="hidden dt:block">
        <StageNav questionId={questionId} active="next" visited={["speak", "discuss", "vote"]} counts={q ? { speak: shortCount(q.voiceCount), discuss: shortCount(q.answerCount), next: shortCount(q.proposalCount) } : undefined} />
      </div>
      {load.state === "loading" || signedIn === null ? <Loading /> : null}
      {load.state === "error" ? <LoadFailed error={load.error} retry={load.retry} what="this question" /> : null}
      {q ? (
        <>
          {week ? <p className="vx-eyebrow m-0 hidden text-green-text dt:block">{`What Next? `}<span className="font-medium normal-case tracking-normal text-ink-2">{week}</span></p> : null}
          <h1 className="vt-hero-q">{q.text}</h1>
          <p className="vt-lead">Make it practical: who should do what, and by when. It shows as Proposed, and others can support, challenge or improve it.</p>
          {improves ? <Banner tone="info" title="You are improving a proposal">Your version will show as an improvement on it.</Banner> : null}
          {signNote ? <Banner tone="info" title="Sign in to post" onClose={() => setSignNote(false)}>Reading is open to everyone. Posting a proposal needs an account.</Banner> : null}
          {error ? <Banner tone="danger" title={error.title} onClose={() => setError(null)}>{error.text}</Banner> : null}
          <div ref={box} onInput={onInput} onClickCapture={onClickCapture} aria-busy={sending} className={sending ? "pointer-events-none opacity-70" : undefined}>
            <Composer label="Your proposal" placeholder="Who should do what, and by when?" freeLeft={1} maxLength={load.state === "ready" ? load.data.max : undefined} onVoice={false} />
          </div>
          {similar.length ? (
            <section className="vt-similar" aria-label="This looks like a proposal already here">
              <div className="vt-similar__head">
                <Icon name="messages-square" size={20} />
                This looks like a proposal already here
              </div>
              {similar.map((p) => (
                <ProposalItem key={p.id} p={p} groups={new Map()} signedIn={!!signedIn} questionId={questionId} onNeedSignIn={() => setSignNote(true)} onSupported={() => router.push(`/q/${questionId}/next`)} />
              ))}
              <p className="vt-note">Support it instead, or post yours. A moderator decides if they belong in one group.</p>
            </section>
          ) : null}
          <aside className="vt-rail hidden dt:flex" aria-label="How proposals work">
            <span className="vx-eyebrow">How proposals work</span>
            <Badge tone="proposed" icon="lightbulb" />
            <p className="vt-lead m-0">Every proposal is labelled Proposed and shows how many people support or challenge it. Anyone can improve one. Similar proposals are grouped once a moderator confirms. Nothing here is a decision.</p>
          </aside>
        </>
      ) : null}
    </div>
  );
}
