"use client";

import { useEffect, useState } from "react";
import { Icon, NewsTag } from "@/components/vx";
import type { IconName } from "@/components/vx";
import type { NewsKind } from "@/components/vx/helpers";
import type { NewsTag as Tag } from "@/lib/api/news";

export const TAGS: { tag: Tag; kind: NewsKind; label: string; icon: IconName }[] = [
  { tag: "VERIFIED_NEWS", kind: "verified", label: "Verified News", icon: "shield-check" },
  { tag: "UNVERIFIED_NEWS", kind: "unverified", label: "Unverified News", icon: "shield-alert" },
  { tag: "GOSSIP", kind: "gossip", label: "Gossip", icon: "messages-square" },
];

export function kindOf(tag: Tag): NewsKind {
  return TAGS.find((t) => t.tag === tag)?.kind ?? "unverified";
}

export function tagOf(kind: NewsKind): Tag {
  return TAGS.find((t) => t.kind === kind)?.tag ?? "UNVERIFIED_NEWS";
}

/** True from 1024 px (the desktop layout). False on the server and on first paint. */
export function useDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return d;
}

export function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange?: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={`relative h-7 w-12 flex-none rounded-pill border-0 p-0 transition-colors ${on ? "bg-green" : "bg-line-strong"} ${disabled ? "opacity-70" : "cursor-pointer"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-pill bg-surface shadow-1 transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

/** "What the tags mean": the three tags with the board's wording, then the flag hint. */
export function TagMeanings({ withFlagHint }: { withFlagHint?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {TAGS.map((t) => <NewsTag key={t.tag} kind={t.kind} withNote />)}
      {withFlagHint ? (
        <p className="m-0 flex gap-2 border-t border-line pt-3 text-caption text-ink-2">
          <Icon name="flag" size={18} className="mt-0.5 flex-none" />
          Think a tag is wrong? Open the post and flag it as misleading. An editor checks every flag.
        </p>
      ) : null}
    </div>
  );
}
