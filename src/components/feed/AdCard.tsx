"use client";
import { useEffect, useRef } from "react";
import { AdSlot } from "@/components/vx";
import { recordAdEvent, type AdPlacement } from "@/lib/api/polls";

/**
 * The approved ad, labelled. An impression is counted once, only on the copy the person can see (the phone copy and the rail copy
 * both exist; `inRail` says which this is). A tap on the button is counted too. "Why this ad?" has no screen yet, so it is not drawn:
 * the design system's AdSlot is told onWhy={false}, and with no link it has no button.
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
    <AdSlot
      brand={ad.brand}
      headline={ad.headline}
      body={ad.body ?? undefined}
      cta={ad.linkUrl ? (ad.ctaLabel ?? "Learn more") : false}
      href={ad.linkUrl ?? undefined}
      onWhy={false}
      onOpen={() => { recordAdEvent(ad.id, "TAP").catch(() => undefined); }}
    />
  );
}
