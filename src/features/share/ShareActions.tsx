"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/vx";
import { recordShareEvent } from "@/lib/api/reach";

/** Counts one open of the link (once per browser tab). Renders nothing. */
export function LinkOpened({ code }: { code: string }) {
  useEffect(() => {
    const key = "voices-share-open-" + code;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: count it anyway */
    }
    void recordShareEvent(code, "link_open");
  }, [code]);
  return null;
}

/** The one call to action. Counts the tap, then opens the recorder; the person signs in only when they publish. */
export function AddVoice({ code, label, block }: { code: string; label: string; block?: boolean }) {
  return (
    <Link
      href={`/speak?from=${encodeURIComponent(code)}`}
      onClick={() => void recordShareEvent(code, "add_voice_tap")}
      className={"vx-btn vx-btn--primary vx-btn--l no-underline" + (block ? " vx-btn--block" : "")}
    >
      <Icon name="mic" size={22} />
      <span className="vx-btn__label">{label}</span>
    </Link>
  );
}
