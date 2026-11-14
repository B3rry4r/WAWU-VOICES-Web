"use client";
import { useEffect, useState } from "react";
import { TrendingList } from "@/components/vx";
import { trendItems } from "@/components/feed/trend";
import { Rail } from "@/components/shell/ShellSlots";
import { getTrendingQuestions } from "@/lib/api/feed";

/** The right-hand column the other 1440 pages have: Trending, from the API. Nothing shows until the API answers. */
export function DmRail() {
  const [trend, setTrend] = useState<ReturnType<typeof trendItems>>([]);
  useEffect(() => {
    let live = true;
    getTrendingQuestions(3).then((r) => live && setTrend(trendItems(r.items ?? []).slice(0, 3)), () => undefined);
    return () => { live = false; };
  }, []);
  return <Rail>{trend.length ? <TrendingList items={trend} /> : null}</Rail>;
}
