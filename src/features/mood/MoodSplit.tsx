"use client";
import { TopicChip } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { getQuestionMoods, type Mood } from "@/lib/api/mood";
import { MOODS, TONE, wordCase } from "./mood";

/** "How Nigeria feels so far": one bar and a legend, from the stored counts. Nothing until someone has answered. */
export function MoodSplit({ qid }: { qid: string }) {
  const c = useLoad(() => getQuestionMoods(qid), [qid]);
  if (c.state !== "ready" || c.data.total === 0) return null;
  const { items, total } = c.data;
  const by = (m: Mood) => items.find((i) => i.mood === m);
  const label = MOODS.map((m) => `${wordCase(m)} ${by(m)?.percent ?? 0} percent`).join(", ");
  return (
    <section aria-labelledby="split-h" className="flex flex-col gap-[10px] rounded-[var(--radius-l)] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line)]" data-testid="mood-split">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="split-h" className="m-0 font-display text-[20px] leading-6">How Nigeria feels so far</h2>
        <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">{`${total.toLocaleString("en-NG")} ${total === 1 ? "voice" : "voices"}`}</span>
      </div>
      <div role="img" aria-label={label} className="flex h-[14px] gap-[2px] overflow-hidden rounded-full">
        {MOODS.map((m) => {
          const n = by(m)?.count ?? 0;
          return n > 0 ? <span key={m} className={TONE[m].fill} style={{ width: `${(n * 100) / total}%` }} /> : null;
        })}
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-[6px] p-0 text-[14px] font-semibold leading-5">
        {MOODS.map((m) => (
          <li key={m} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-[10px] w-[10px] rounded-[3px] ${TONE[m].fill}`} />
            {`${wordCase(m)} ${by(m)?.percent ?? 0}%`}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** All, Angry, Tired, Proud, Hopeful: the answers under a question by word. */
export function MoodFilter({ value, onChange }: { value: Mood | null; onChange: (m: Mood | null) => void }) {
  return (
    <div role="group" aria-label="Show answers by word" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
      <TopicChip label="All" selected={value === null} onClick={() => onChange(null)} />
      {MOODS.map((m) => <TopicChip key={m} label={wordCase(m)} selected={value === m} onClick={() => onChange(value === m ? null : m)} />)}
    </div>
  );
}
