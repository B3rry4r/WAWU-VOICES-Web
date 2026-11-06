"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, Icon, Tabs, TrendingList } from "@/components/vx";
import { PhoneBar, Rail } from "@/components/shell/ShellSlots";
import { getCurrentTopic, getTodaysQuestion, getTrendingQuestions, search, type Question } from "@/lib/api/feed";
import { isOpen, voicesShort } from "@/lib/feed-format";
import { Answers, Failed, Loading, NothingYet, SearchBox, Section, WeekCard } from "./parts";
import { trendItems } from "./trend";
import { useLoad } from "./useLoad";

type Tab = "all" | "questions" | "voices" | "people";

/** "Roads and travel · 3,100 voices · Open" or "What Next? · 840 voices · 22 proposals". */
function questionMeta(x: Question): string {
  const whatNext = x.proposalCount > 0 && !x.category;
  const tail = whatNext ? `${x.proposalCount} ${x.proposalCount === 1 ? "proposal" : "proposals"}` : isOpen(x) ? "Open" : x.status === "CLOSED" || (x.endsAt && Date.parse(x.endsAt) <= Date.now()) ? "Closed" : "Opens soon";
  return [whatNext ? "What Next?" : x.category?.name, voicesShort(x.voiceCount), tail].filter(Boolean).join(" · ");
}

export function SearchScreen() {
  const q = (useSearchParams().get("q") ?? "").trim();
  const [tab, setTab] = useState<Tab>("all");
  const load = useLoad(async () => {
    const [res, topic, today, trending] = await Promise.all([
      q.length >= 2 ? search(q) : Promise.resolve(null),
      getCurrentTopic().catch(() => null),
      getTodaysQuestion().catch(() => null),
      getTrendingQuestions(3).then((r) => trendItems(r.items), () => []),
    ]);
    return { res, topic, today, trending };
  }, [q]);

  const rail =
    load.state === "ready" ? (
      <Rail>
        {load.data.topic ? <WeekCard topic={load.data.topic} questionId={load.data.today?.id} variant="rail" /> : null}
        {load.data.trending.length ? <TrendingList items={load.data.trending} /> : null}
      </Rail>
    ) : null;

  return (
    <>
      <PhoneBar>
        <Link href="/discover" className="vx-iconbtn vx-iconbtn--s vx-iconbtn--ghost -ml-1 text-[var(--ink)]" aria-label="Back to Discover"><Icon name="arrow-left" size={24} /></Link>
        <div className="min-w-0 flex-1"><SearchBox key={q} defaultValue={q} placeholder="Search questions, voices and handles" /></div>
      </PhoneBar>
      {q.length < 2 ? (
        <div className="mt-6"><NothingYet title="Search VOICES" body="Type at least 2 letters to find questions, voices and people." /></div>
      ) : load.state === "loading" ? (
        <div className="mt-6"><Loading /></div>
      ) : load.state === "error" ? (
        <div className="mt-6"><Failed load={load} /></div>
      ) : (
        <Results q={q} tab={tab} setTab={setTab} r={load.data.res!} />
      )}
      {rail}
    </>
  );
}

function Results({ q, tab, setTab, r }: { q: string; tab: Tab; setTab: (t: Tab) => void; r: NonNullable<Awaited<ReturnType<typeof search>>> }) {
  const t = r.totals;
  const total = t.questions + t.voices + t.people;
  const show = (x: Tab) => tab === "all" || tab === x;
  if (total === 0) return <div className="mt-6"><NothingYet title={`Nothing found for "${q}"`} body="Check the spelling or try a shorter word." /></div>;
  return (
    <div className="flex flex-col gap-[18px]">
      <h1 className="m-0 hidden font-display text-display-xl dt:block">{`Results for "${q}"`}</h1>
      <Tabs
        label="Search results"
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: "all", label: "All", count: total },
          { id: "questions", label: "Questions", count: t.questions },
          { id: "voices", label: "Voices", count: t.voices },
          { id: "people", label: "People", count: t.people },
        ]}
      />
      {show("questions") && r.questions.length ? (
        <Section title="Questions">
          <div className="vx-notes">
            {r.questions.map((x) => (
              <Link key={x.id} href={`/q/${x.id}`} className="vx-note vx-focus flex-col gap-[6px] dt:px-5 dt:py-4">
                <span className="font-display text-display-s">{x.text}</span>
                <span className="text-caption text-[var(--ink-2)]">{questionMeta(x)}</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
      {show("voices") && r.answers.length ? (
        <Section title="Voices · text and transcripts">
          <Answers items={r.answers} unfolded />
        </Section>
      ) : null}
      {show("people") && r.people.length ? (
        <Section title="People">
          <div className="vx-notes">
            {r.people.map((p) => {
              const inner = (
                <>
                  <Avatar name={p.displayName ?? p.handle} />
                  <span className="flex flex-1 flex-col">
                    <b className="text-title">{`@${p.handle}`}</b>
                    <span className="text-caption text-[var(--ink-2)]">{[p.state, voicesShort(p.voiceCount)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Icon name="chevron-right" size={20} />
                </>
              );
              return <Link key={p.id} href={`/p/${p.handle}`} className="vx-note vx-focus items-center">{inner}</Link>;
            })}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
