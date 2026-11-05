"use client";
import { useEffect, useState } from "react";
import { FreePosts, TrendingList } from "@/components/vx";
import { AdCard } from "@/components/feed/AdCard";
import { trendItems } from "@/components/feed/trend";
import { Rail } from "@/components/shell/ShellSlots";
import { getTrendingQuestions } from "@/lib/api/feed";
import { getAdPlacement } from "@/lib/api/polls";
import type { AdPlacement } from "@/lib/api/polls";

/** The desktop right rail of the Question and Thread boards: Trending (the API's), the person's free posts, and the ad when there is one. Each shows only when the API gave something. */
export function TalkRail({ questionId, freeLeft }: { questionId: string; freeLeft?: number }) {
  const [trend, setTrend] = useState<ReturnType<typeof trendItems>>([]);
  const [ad, setAd] = useState<AdPlacement | null>(null);
  useEffect(() => {
    let live = true;
    getTrendingQuestions(4).then((r) => live && setTrend(trendItems(r.items.filter((q) => q.id !== questionId)).slice(0, 3)), () => undefined);
    getAdPlacement().then((a) => live && setAd(a), () => undefined);
    return () => { live = false; };
  }, [questionId]);
  return (
    <Rail>
      {freeLeft !== undefined ? (
        <section className="vx-card flex flex-col gap-2 p-4" aria-label="Your free posts">
          <h3 className="vx-eyebrow m-0">Your free posts</h3>
          <FreePosts left={freeLeft} />
        </section>
      ) : null}
      {trend.length ? <TrendingList items={trend} /> : null}
      {ad ? <AdCard ad={ad} inRail /> : null}
    </Rail>
  );
}
