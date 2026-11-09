"use client";
import type { Mood } from "@/lib/api/mood";
import { TONE } from "./mood";

/** The word beside an answer (MoodAnswers board): a pill in the word's colour pair. */
export function MoodChip({ mood, className }: { mood: Mood; className?: string }) {
  return (
    <span
      data-testid="mood-chip"
      className={`inline-flex h-[26px] items-center self-start rounded-full px-[10px] text-[12px] font-extrabold leading-4 tracking-[0.06em] ${TONE[mood].chip} ${className ?? ""}`}
    >
      {mood}
    </span>
  );
}

/** "Your word: HOPEFUL. Change" under the question on the Record and Write screens. */
export function MoodWordNote({ mood, changeHref }: { mood: Mood; changeHref: string }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-caption" data-testid="mood-word-note">
      <span>Your word</span>
      <MoodChip mood={mood} />
      <a href={changeHref} className="min-h-6 text-label underline underline-offset-2">Change</a>
    </p>
  );
}

/** One word to pick, as MoodPick draws them but smaller: for a form that posts an answer and is not the pick screen. */
export function MoodWordPicker({ words, value, onChange }: { words: readonly Mood[]; value: Mood | null; onChange: (m: Mood) => void }) {
  return (
    <div role="group" aria-label="Pick one word" className="flex flex-wrap gap-2" data-testid="mood-word-picker">
      {words.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={m === value}
          onClick={() => onChange(m)}
          className={`min-h-11 cursor-pointer rounded-full border-0 px-4 text-[14px] font-extrabold tracking-[0.06em] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none ${TONE[m].chip} ${m === value ? TONE[m].pressed : ""}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
