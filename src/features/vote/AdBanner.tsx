"use client";

import { useEffect, useRef, useState } from "react";
import { AdSlot } from "@/components/vx";
import { getBannerAd, recordAdEvent } from "@/lib/api/vote";
import type { AdPlacement } from "@/lib/api/vote";

/** The banner ad under the results (the board's "Zobo Fresh"). It shows only when the API returns an approved ad; a view and a tap are recorded. */
export function AdBanner({ questionId }: { questionId: string }) {
  const [ad, setAd] = useState<AdPlacement | null>(null);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    getBannerAd(questionId).then(
      (a) => live && setAd(a),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [questionId]);
  useEffect(() => {
    if (ad && seen.current !== ad.id) {
      seen.current = ad.id;
      recordAdEvent(ad.id, "IMPRESSION").catch(() => undefined);
    }
  }, [ad]);
  if (!ad) return null;
  return (
    <AdSlot variant="banner" brand={ad.brand} headline={ad.headline} cta={ad.ctaLabel ?? "Open"} href={ad.linkUrl ?? undefined} onOpen={() => { recordAdEvent(ad.id, "TAP").catch(() => undefined); }} />
  );
}
