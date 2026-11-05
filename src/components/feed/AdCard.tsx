"use client";
import { useEffect, useRef } from "react";
import { Badge, Button } from "@/components/vx";
import { initials } from "@/components/vx/helpers";
import { recordAdEvent, type AdPlacement } from "@/lib/api/polls";

/**
 * The approved ad, labelled. An impression is counted once, only on the copy the person can see (the phone copy and the rail copy
 * both exist; `inRail` says which this is). A tap on the button is counted too. "Why this ad?" has no screen yet, so it is not drawn:
 * this is the design system's ad card without that button (same classes), and with no link it has no button.
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
    <aside className="vx-ad" aria-label={`Ad from ${ad.brand}`} onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) recordAdEvent(ad.id, "TAP").catch(() => undefined); }}>
      <div className="vx-ad__top">
        <span className="vx-ad__brand"><span className="vx-ad__logo" aria-hidden="true">{initials(ad.brand)}</span>{ad.brand}</span>
        <Badge tone="ad" />
      </div>
      <p className="vx-ad__head">{ad.headline}</p>
      {ad.body ? <p className="vx-ad__body">{ad.body}</p> : null}
      {ad.linkUrl ? (
        <div className="vx-ad__top">
          <Button variant="secondary" size="s" iconEnd="chevron-right" href={ad.linkUrl}>{ad.ctaLabel ?? "Learn more"}</Button>
        </div>
      ) : null}
    </aside>
  );
}
