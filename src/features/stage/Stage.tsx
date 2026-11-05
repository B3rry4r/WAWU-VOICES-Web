"use client";
import { useRouter } from "next/navigation";
import { StageBar } from "@/components/vx";

/** The Speak / Discuss / Vote / What Next? bar for a question (V-5). Vote and What Next? stay out of sight until their screens exist
 *  (flip BUILT when /q/[id]/vote and /q/[id]/next land); nothing here is a dead tab. */
export const BUILT = { vote: false, next: false };

export type StageId = "speak" | "discuss" | "vote" | "next";


export function Stage({ questionId, active, counts }: { questionId: string; active: StageId; counts?: Partial<Record<StageId, string>> }) {
  const router = useRouter();
  const hideAll = !BUILT.vote && !BUILT.next;
  return (
    <div className="vx-stage-wrap -mx-4 border-b border-[var(--line)] px-4 py-3 dt:mx-0 dt:border-0">
      {hideAll ? <style>{`.vx-stage-wrap .vx-stage__step:nth-child(n+3){display:none}.vx-stage-wrap .vx-stage::before{left:25%;right:25%}`}</style> : null}
      <style>{`@media (max-width:1023px){.vx-stage-wrap .vx-stage__n{display:none}}`}</style>
      <StageBar
        current={active}
        counts={counts && Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, ` ${v}`]))}
        onChange={(s) => {
          if (s === "speak") router.push("/speak");
          else if (s === "discuss") router.push(`/q/${questionId}`);
          else if (s === "vote" && BUILT.vote) router.push(`/q/${questionId}/vote`);
          else if (s === "next" && BUILT.next) router.push(`/q/${questionId}/next`);
        }}
      />
    </div>
  );
}
