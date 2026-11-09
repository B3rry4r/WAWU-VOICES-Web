"use client";
import { Switch } from "@/components/vx";

export const SHARE_WORD_DETAIL = "The friend whose link brought you here sees your word. Nobody else does.";

/** "Share my word" as the MoodPick board draws it: on by default, one line of what it means. */
export function ShareWordSwitch({ on, busy, onChange }: { on: boolean; busy?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-[14px] rounded-[var(--radius-l)] bg-[var(--surface)] px-4 py-[14px] shadow-[inset_0_0_0_1px_var(--line)]">
      <span className="flex flex-1 flex-col gap-[2px]">
        <span className="text-[15px] font-bold leading-5">Share my word</span>
        <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">{SHARE_WORD_DETAIL}</span>
      </span>
      <Switch checked={on} disabled={busy} onChange={onChange} label="Share my word with the friend who invited me" />
    </label>
  );
}
