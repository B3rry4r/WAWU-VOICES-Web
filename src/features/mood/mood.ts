"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Mood } from "@/lib/api/mood";

/** The words, in the order the boards draw them, with the design-system pairs (light and dark come from the tokens). */
export const MOODS: readonly Mood[] = ["ANGRY", "TIRED", "PROUD", "HOPEFUL"];

interface Tone {
  /** The chip beside an answer and the word button on the pick screen. */
  chip: string;
  /** The pressed word button: the same pair with a 3px ring in the text colour. */
  pressed: string;
  /** The bar segment and the legend swatch. */
  fill: string;
  /** Text only, for a word in a sentence. */
  text: string;
}
export const TONE: Record<Mood, Tone> = {
  ANGRY: { chip: "bg-[var(--danger-bg)] text-[var(--danger)]", pressed: "shadow-[inset_0_0_0_3px_var(--danger)]", fill: "bg-[var(--danger)]", text: "text-[var(--danger)]" },
  TIRED: { chip: "bg-[var(--warning-bg)] text-[var(--warning)]", pressed: "shadow-[inset_0_0_0_3px_var(--warning)]", fill: "bg-[var(--warning)]", text: "text-[var(--warning)]" },
  PROUD: { chip: "bg-[var(--success-bg)] text-[var(--success)]", pressed: "shadow-[inset_0_0_0_3px_var(--success)]", fill: "bg-[var(--success)]", text: "text-[var(--success)]" },
  HOPEFUL: { chip: "bg-[var(--verified-bg)] text-[var(--verified)]", pressed: "shadow-[inset_0_0_0_3px_var(--verified)]", fill: "bg-[var(--verified)]", text: "text-[var(--verified)]" },
};

/** "Hopeful": for a chip in a legend or a filter. */
export const wordCase = (m: Mood): string => m.charAt(0) + m.slice(1).toLowerCase();

export const isMood = (v: unknown): v is Mood => typeof v === "string" && (MOODS as readonly string[]).includes(v);

/** The word the person has picked for a question, kept in this browser until they post (they may change it any time before). */
const PICK = "voices-mood-pick";
export function readPick(qid: string): Mood | null {
  try {
    const v = (JSON.parse(window.localStorage.getItem(PICK) ?? "{}") as Record<string, string>)[qid];
    return isMood(v) ? v : null;
  } catch { return null; }
}
export function writePick(qid: string, word: Mood | null): void {
  try {
    const all = JSON.parse(window.localStorage.getItem(PICK) ?? "{}") as Record<string, string>;
    if (word) all[qid] = word; else delete all[qid];
    window.localStorage.setItem(PICK, JSON.stringify(all));
  } catch { /* the word then travels in the address only */ }
}

export const pickHref = (qid: string) => `/q/${qid}/mood`;
export const isMoodQuestion = (q: { moodOptions?: readonly Mood[] } | null | undefined): boolean => !!q?.moodOptions?.length;

/**
 * A mood question needs one word before Record or Write. Reads it from ?mood=, else from what was picked in this
 * browser; with none, sends the person to the pick screen. An ordinary question needs nothing.
 */
export function useMoodWord(question: { id: string; moodOptions?: readonly Mood[] } | null | undefined) {
  const router = useRouter();
  const params = useSearchParams();
  const asked = params?.get("mood") ?? null;
  const [word, setWord] = useState<Mood | null>(null);
  const [ready, setReady] = useState(false);
  const qid = question?.id;
  const options = question?.moodOptions;
  const needs = !!options?.length;
  useEffect(() => {
    if (!qid) return;
    if (!needs) { setReady(true); return; }
    const w = isMood(asked) && options!.includes(asked) ? asked : readPick(qid);
    if (w && options!.includes(w)) { writePick(qid, w); setWord(w); setReady(true); return; }
    router.replace(pickHref(qid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid, needs, asked]);
  return { needs, word, ready: !qid ? false : ready };
}
