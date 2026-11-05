"use client";
import Link from "next/link";
import { useState } from "react";
import { Answers, Failed, Loading, NothingYet, Tiles } from "./parts";
import { Badge, Icon, Tabs, TopicTile } from "@/components/vx";
import { getCategory } from "@/lib/api/feed";
import { closesIn, voicesLabel } from "@/lib/feed-format";
import { useLoad } from "./useLoad";
import { ApiError } from "@/lib/api/client";

const COPY = {
  open: ["No open questions", "New questions in this category show up here."],
  closed: ["No closed questions", "Questions that have finished show up here."],
  polls: ["No polls right now", "Questions with an open poll show up here."],
} as const;

export function CategoryScreen({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"open" | "closed" | "polls">("open");
  const load = useLoad(() => getCategory(slug, tab), [slug, tab]);
  if (load.state === "loading") return <Loading />;
  if (load.state === "error") {
    if (load.error instanceof ApiError && load.error.status === 404)
      return <NothingYet title="We could not find that category" body="Go back to Discover and pick another." />;
    return <Failed load={load} />;
  }
  const d = load.data;
  const today = tab === "open" ? d.todaysQuestion : null;
  const rest = d.questions.filter((q) => q.id !== today?.id);
  return (
    <>
      <Link href="/discover" className="inline-flex items-center gap-1 text-[14px] font-semibold no-underline" aria-label="Back to Discover">
        <Icon name="chevron-left" size={20} /> Discover
      </Link>
      <h1 className="m-0 mt-2 font-display text-[28px] font-normal leading-8 dt:text-[32px] dt:leading-9">{d.category.name}</h1>
      {d.category.blurb ? <p className="mt-1 text-[15px] text-[var(--ink-2)]">{d.category.blurb}</p> : null}
      <p className="mt-1 text-[14px] text-[var(--ink-2)]">{`${d.category.questionCount} ${d.category.questionCount === 1 ? "question" : "questions"} · ${voicesLabel(d.category.voicesThisWeek)} this week`}</p>
      <div className="mt-4">
        <Tabs
          label={`Questions in ${d.category.name}`}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          items={[
            { id: "open", label: "Open", count: d.counts.open },
            { id: "closed", label: "Closed", count: d.counts.closed },
            { id: "polls", label: "Polls", count: d.counts.polls },
          ]}
        />
      </div>
      <div className="mt-4 grid gap-3">
        {today ? (
          <div>
            <Badge>Today&apos;s question</Badge>
            <TopicTile question={today.text} voices={today.voiceCount} href={`/q/${today.id}`} tone="forest" category={closesIn(today.endsAt) ? `Closes in ${closesIn(today.endsAt)}` : undefined} />
          </div>
        ) : null}
        {rest.length ? <Tiles items={rest} /> : today ? null : <NothingYet title={COPY[tab][0]} body={COPY[tab][1]} />}
      </div>
      {d.topVoices.length ? (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-[20px] font-normal">{`Top voice in ${d.category.name} this week`}</h2>
          <Answers items={d.topVoices.slice(0, 1)} />
        </section>
      ) : null}
    </>
  );
}
