"use client";
import { useEffect, useRef } from "react";
import { AdSlot } from "@/components/vx";
import { LivePlayer } from "@/features/profile/ClipPlayer";
import { safeLink } from "./OverrideMessage";
import { getPlayUrl } from "@/lib/api/profile";
import { isSignedIn } from "@/lib/api/auth";
import { recordAdEvent, type AdPlacement } from "@/lib/api/polls";

/**
 * The short audio advert (addendum 3B). Always labelled Ad by the slot. The sound plays only when tapped, through a short-lived
 * link like any voice; a view is counted once when it is on screen, a tap on its button, and a listen once when play starts (the
 * server keeps one listen per person per advert per day). An advert whose recording is not ready is not drawn.
 */
export function AudioAdCard({ ad }: { ad: AdPlacement | null | undefined }) {
  const seen = useRef(false);
  const control = useRef<{ pause: () => void } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ad || !ad.audioClipId || seen.current) return;
    const el = box.current;
    const mark = () => { if (seen.current) return; seen.current = true; recordAdEvent(ad.id, "IMPRESSION").catch(() => undefined); };
    if (!el || typeof IntersectionObserver === "undefined") { mark(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { mark(); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ad]);
  if (!ad || !ad.audioClipId) return null;
  const clipId = ad.audioClipId;
  const link = safeLink(ad.linkUrl); // only an http or https address becomes a button
  return (
    <div ref={box} data-testid="audio-ad">
      <AdSlot
        variant="audio"
        brand={ad.brand}
        headline={ad.headline}
        body={ad.body ?? undefined}
        cta={link ? (ad.ctaLabel ?? "Learn more") : false}
        href={link ?? undefined}
        newTab
        onWhy={false}
        onOpen={() => { control.current?.pause(); recordAdEvent(ad.id, "TAP").catch(() => undefined); }}
        player={
          <LivePlayer
            clipId={clipId}
            durationMs={ad.audioDurationMs ?? null}
            peaks={null}
            getUrl={async (id) => (await getPlayUrl(id, isSignedIn())).url}
            failMessage="Could not play this advert. Try again."
            tone="surface"
            controlRef={control}
            onFirstPlay={() => { recordAdEvent(ad.id, "LISTEN").catch(() => undefined); }}
          />
        }
      />
    </div>
  );
}
