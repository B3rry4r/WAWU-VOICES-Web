"use client";
import { useState } from "react";
import { Switch } from "@/components/vx";
import type { WhereYouSit } from "@/lib/api/mood";

type Scope = "NIGERIA" | "WORLD";

/** The line for one group, in the words the YoureLive board draws. */
export function sitLineOf(percent: number | null, word: string): string {
  return percent === null ? "You’re one of the first." : `You’re with the ${percent}% who feel ${word}.`;
}

/**
 * "Where you sit" on the Posted screen (YoureLive boards): the sentence, the Nigeria / World switch (only once a group
 * has a percentage), the big number, and "You’re one of the first." with the 50 explanation before that.
 */
export function WhereYouSitCard({ sit }: { sit: WhereYouSit }) {
  const [scope, setScope] = useState<Scope>(sit.defaultScope);
  const group = scope === "NIGERIA" ? sit.nigeria : sit.world;
  const pct = group.percent;
  const seg = (s: Scope) => `h-10 cursor-pointer rounded-full border-0 text-[15px] font-bold leading-5 focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none ${scope === s ? "bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-1)]" : "bg-transparent text-[var(--ink-2)]"}`;
  return (
    <section aria-labelledby="sit-h" data-testid="where-you-sit" className="flex flex-col gap-3 rounded-[var(--radius-l)] bg-[var(--surface)] px-4 py-[18px] shadow-[inset_0_0_0_1px_var(--line)]">
      <h2 id="sit-h" className="m-0 text-[19px] font-extrabold leading-6">{sitLineOf(pct, sit.mood)}</h2>
      {sit.showSwitch ? (
        <div role="group" aria-label="Compare with" className="grid grid-cols-2 gap-1 rounded-full bg-[var(--surface-2)] p-1">
          <button type="button" aria-pressed={scope === "NIGERIA"} className={seg("NIGERIA")} onClick={() => setScope("NIGERIA")}>Nigeria</button>
          <button type="button" aria-pressed={scope === "WORLD"} className={seg("WORLD")} onClick={() => setScope("WORLD")}>World</button>
        </div>
      ) : null}
      {pct !== null ? (
        <>
          <p className="m-0 font-display text-[56px] leading-[60px] text-[var(--verified)]" data-testid="sit-percent">{`${pct}%`}</p>
          <p className="m-0 border-t border-[var(--line)] pt-[10px] text-[14px] font-medium leading-5 text-[var(--ink-2)]">Share your result and ask others how they feel.</p>
        </>
      ) : (
        <p className="m-0 text-[14px] font-medium leading-5 text-[var(--ink-2)]">When 50 people have answered, you will see where you sit, in Nigeria and the world.</p>
      )}
    </section>
  );
}

/** "Show my name on the card": off until the person turns it on. */
export function CardNameSwitch({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-[14px] rounded-[var(--radius-l)] bg-[var(--surface)] px-4 py-[14px] shadow-[inset_0_0_0_1px_var(--line)]">
      <span className="flex flex-1 flex-col gap-[2px]">
        <span className="text-[15px] font-bold leading-5">Show my name on the card</span>
        <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">Off, the card carries only your word. On, it also shows your name and where you are.</span>
      </span>
      <Switch checked={on} disabled={busy} onChange={onChange} label="Show my name on the card" />
    </label>
  );
}

/** The small share card on the Posted screen, as the YoureLive board draws it (the real picture is drawn by the API). */
export function MoodCardPreview({ word, line }: { word: string; line: string }) {
  return (
    <div aria-label="Your share card" data-testid="mood-card-preview" className="block overflow-hidden rounded-[var(--radius-m)] bg-[var(--forest)] px-[18px] pb-4 pt-[18px] text-[var(--on-forest)]">
      <span className="block text-[11px] font-bold leading-[14px] tracking-[0.1em] text-[var(--on-forest-2)]">MY VOICE. MY NIGERIA.</span>
      <span className="mt-2 block font-display text-[26px] leading-[30px]">I feel <span className="text-[var(--sun)]">{word}</span> about Nigeria.</span>
      <span className="mt-1 block text-[15px] font-bold leading-5">What about you?</span>
      <span className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium leading-4 text-[var(--on-forest-2)]">{line}</span>
        <span className="inline-flex h-[30px] flex-none items-center rounded-full bg-[var(--green)] px-3 text-[13px] font-bold leading-4 text-[var(--on-green)]">Add your voice</span>
      </span>
    </div>
  );
}
