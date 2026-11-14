"use client";
import Link from "next/link";
import { Icon } from "@/components/vx";
import type { Question } from "@/lib/api/talk";
import { AppBar, BarButton } from "./lib";
import { useShareSheet, useToast } from "./TalkCard";

/**
 * A question that has not opened: its text and hint, the day it opens, and the Share control. No counts, no voices, nothing
 * that records or posts. Every address that would act on the question (Speak, write, mood, propose, vote, results, posted)
 * and the question page itself draw this until the API says the question is open.
 */
export function ComingUpQuestion({ question, opens }: { question: Pick<Question, "id" | "text" | "hint">; opens: string }) {
  const [toast] = useToast();
  const [shareNode, share] = useShareSheet();
  const onShare = () => share("QUESTION", question.id, { notOpen: true });
  return (
    <>
      <div className="hidden items-center justify-between dt:flex">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-label text-[var(--ink)] no-underline"><Icon name="arrow-left" size={18} />Back to Home</Link>
        <BarButton icon="share-2" label="Share this question" onClick={onShare} />
      </div>
      <AppBar phoneOnly title="Coming up" back="/">
        <BarButton icon="share-2" label="Share this question" onClick={onShare} />
      </AppBar>
      <section aria-label="The question" data-testid="q-coming-up" className="flex flex-col gap-3 pb-2 pt-5">
        <span className="text-eyebrow uppercase text-[var(--green-text)]">Coming up</span>
        <h1 className="m-0 font-display text-display-l [text-wrap:balance] dt:text-display-2xl">{question.text}</h1>
        {question.hint ? <p className="m-0 text-body-l text-[var(--ink-2)]">{question.hint}</p> : null}
        <p className="m-0 text-body-strong text-[var(--ink-2)]">{opens}</p>
      </section>
      {toast}
      {shareNode}
    </>
  );
}
