"use client";
import { useEffect, useRef } from "react";
import { AdSlot } from "@/components/vx";
import { recordAdEvent, type AdPlacement } from "@/lib/api/polls";

/**
 * The approved ad, labelled. An impression is counted once, only on the copy the person can see (the phone copy and the rail copy
 * both exist; `inRail` says which this is). A tap on the button is counted too. "Why this ad?" has no screen yet, so it is hidden.
 */
export function AdCard({ ad, inRail }: { ad: AdPlacement | null | undefined; inRail?: boolean }) {
  const sent = useRef(false);
  useEffect(() => {
    if (!ad || sent.current) return;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop !== !!inRail) return;
    sent.current = true;
    recordAdEvent(ad.id, "IMPRESSION").catch(() => undefined);
  }, [ad, inRail]);
  if (!ad) return null;
  return (
    <div className="[&_.vx-ad__why]:hidden" onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) recordAdEvent(ad.id, "TAP").catch(() => undefined); }}>
      <AdSlot brand={ad.brand} headline={ad.headline} body={ad.body ?? undefined} cta={ad.ctaLabel ?? undefined} href={ad.linkUrl ?? undefined} />
    </div>
  );
}
