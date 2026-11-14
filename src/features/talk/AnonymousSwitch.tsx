"use client";
import { Switch } from "@/components/vx";

/** The one line under the switch. Admins do see the author in the moderation view (api/src/admin/trust/moderation.service.ts detail()). */
export const ANON_NOTE = "Your name and photo stay hidden. Admins can still see who posted, to keep Voices safe.";
export const ANON_LABEL = "Post without my name";

/** "Post without my name" on a new answer: off until the person turns it on. `onForest` is for the dark recorder panel. */
export function AnonymousSwitch({ on, onChange, disabled, onForest }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; onForest?: boolean }) {
  const box = onForest
    ? "text-[var(--on-forest)] shadow-[inset_0_0_0_1px_var(--on-forest-2)]"
    : "bg-[var(--surface)] shadow-[inset_0_0_0_1px_var(--line)]";
  const note = onForest ? "text-[var(--on-forest-2)]" : "text-[var(--ink-2)]";
  return (
    <label data-testid="anon-switch" className={`flex cursor-pointer items-center gap-[14px] rounded-[var(--radius-l)] px-4 py-[14px] ${box}`}>
      <span className="flex flex-1 flex-col gap-[2px] text-left">
        <span className="text-[15px] font-bold leading-5">{ANON_LABEL}</span>
        <span className={`text-[13px] font-medium leading-[18px] ${note}`}>{ANON_NOTE}</span>
      </span>
      <Switch checked={on} disabled={disabled} onChange={onChange} label={ANON_LABEL} />
    </label>
  );
}
