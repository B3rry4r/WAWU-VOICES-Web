"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon, TrendingList } from "@/components/vx";
import { getCategories, getCurrentTopic, getTrendingQuestions } from "@/lib/api/feed";
import { voicesLabel } from "@/lib/feed-format";
import { Failed, Loading, NothingYet, Section, SearchBox, WeekCard } from "./parts";
import { useLoad } from "./useLoad";

const ICON: Record<string, "coins" | "lightbulb" | "wallet" | "heart" | "map-pin" | "message-circle" | "user" | "vote" | "message-square"> = {
  money: "coins", "power-and-light": "lightbulb", "work-and-pay": "wallet", love: "heart", "roads-and-travel": "map-pin", faith: "message-circle", family: "user", elections: "vote",
};

export function DiscoverScreen() {
  const [all, setAll] = useState(false);
  const load = useLoad(() => Promise.all([getCategories(), getCurrentTopic(), getTrendingQuestions(5)]), []);
  if (load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const [cats, topic, trending] = load.data;
  const shown = all ? cats.items : cats.items.slice(0, 8);
  return (
    <>
      <h1 className="m-0 mt-1 font-display text-[28px] font-normal leading-8 dt:text-[32px] dt:leading-9">Discover</h1>
      <div className="mt-3"><SearchBox /></div>
      <Section title="Categories">
        {cats.items.length > 8 ? (
          <button type="button" className="mb-3 border-0 bg-transparent p-0 text-[14px] font-semibold text-[var(--green-text)]" onClick={() => setAll(!all)}>
            {all ? "Show fewer" : "See all"}
          </button>
        ) : null}
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
          {shown.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.slug}`} className="flex min-h-[72px] items-center gap-3 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-3 no-underline">
                <Icon name={ICON[c.slug] ?? "message-square"} size={24} />
                <span className="grid">
                  <strong className="text-[15px] text-[var(--ink)]">{c.name}</strong>
                  <span className="text-[13px] text-[var(--ink-2)]">{voicesLabel(c.voicesThisWeek)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <div className="mt-6"><WeekCard topic={topic} /></div>
      <Section title="Trending">
        {trending.items.length ? (
          <TrendingList title="Trending" items={trending.items.map((q) => ({ question: q.text, voices: q.voiceCount, category: q.category?.name, href: `/q/${q.id}` }))} />
        ) : (
          <NothingYet title="Nothing trending yet" body="Questions that people are answering show up here." />
        )}
      </Section>
    </>
  );
}
