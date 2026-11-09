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
