"use client";
import { useRouter } from "next/navigation";
import { StageBar } from "@/components/vx";

export type StageId = "speak" | "discuss" | "vote" | "next";

/** Where each stage of a question lives (V-5). Speak is the recorder, Discuss the conversation, Vote the poll, What Next? the proposals. */
export function stageHref(questionId: string, id: StageId): string {
  if (id === "speak") return "/speak";
  if (id === "discuss") return `/q/${questionId}`;
  if (id === "vote") return `/q/${questionId}/vote`;
  return `/q/${questionId}/next`;
}

/** The Speak / Discuss / Vote / What Next? bar for a question. All four stages have a screen once W5 lands.
 *  Counts show from 1024 px up, as the 1440 boards draw them; the phone boards draw none. */
export function StageNav({ questionId, active, counts, visited }: { questionId: string; active: StageId; counts?: Partial<Record<StageId, string>>; visited?: StageId[] }) {
  const router = useRouter();
  return (
    <div className="-mx-4 border-b border-[var(--line)] px-4 py-3 dt:mx-0 dt:border-0">
      <StageBar className="vx-stage--counts-wide" current={active} counts={counts} visited={visited} onChange={(s) => router.push(stageHref(questionId, s))} />
    </div>
  );
}
