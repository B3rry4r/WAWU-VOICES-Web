"use client";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { getTodaysQuestion } from "@/lib/api/feed";
import { getQuestion } from "@/lib/api/talk";
import { comingUp, questionStart } from "@/lib/feed-format";
import { AppBar } from "./lib";
import { ComingUpQuestion } from "./ComingUp";

/**
 * V-PRELAUNCH round 2: the door to every screen that acts on a question (Speak, write, pick a word, propose, vote, results,
 * posted). While the API says the question has not opened, the person sees the coming-up page, never a form, a recorder,
 * "Your voice is live" or "This question has closed". It turns into the screen by itself when the API says the question is
 * open (see `useLoad`). With no id it is today's question. A question that is open, or one this cannot read (the screen
 * shows its own error), goes straight through.
 */
export function OpenGate({ questionId, children }: { questionId?: string; children: ReactNode }) {
  const load = useLoad(() => (questionId ? getQuestion(questionId) : getTodaysQuestion()), [questionId], questionStart);
  if (load.state === "loading") return <><AppBar title="Coming up" back="/" /><div className="mt-4 grid gap-4" aria-busy="true"><Skeleton variant="tile" /></div></>;
  if (load.state === "ready") {
    const opens = comingUp(load.data);
    if (opens) return <ComingUpQuestion question={load.data} opens={opens} />;
  }
  return <>{children}</>;
}
