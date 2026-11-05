"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Tabs } from "@/components/vx";
import { search } from "@/lib/api/feed";
import { voicesLabel } from "@/lib/feed-format";
import { Answers, Failed, Loading, NothingYet, SearchBox } from "./parts";
import { useLoad } from "./useLoad";

type Tab = "all" | "questions" | "voices" | "people";

export function SearchScreen() {
  const q = (useSearchParams().get("q") ?? "").trim();
  const [tab, setTab] = useState<Tab>("all");
  const load = useLoad(() => (q.length >= 2 ? search(q) : Promise.resolve(null)), [q]);
  return (
    <>
      <div className="mt-1"><SearchBox defaultValue={q} placeholder="Search questions, voices and handles" /></div>
      {q.length < 2 ? (
        <div className="mt-6"><NothingYet title="Search VOICES" body="Type at least 2 letters to find questions, voices and people." /></div>
      ) : load.state === "loading" ? (
        <div className="mt-6"><Loading /></div>
      ) : load.state === "error" ? (
        <div className="mt-6"><Failed load={load} /></div>
      ) : (
        <Results q={q} tab={tab} setTab={setTab} r={load.data!} />
      )}
    </>
  );
}

function Results({ q, tab, setTab, r }: { q: string; tab: Tab; setTab: (t: Tab) => void; r: NonNullable<Awaited<ReturnType<typeof search>>> }) {
  const t = r.totals;
  const total = t.questions + t.voices + t.people;
  const show = (x: Tab) => tab === "all" || tab === x;
  if (total === 0) return <div className="mt-6"><NothingYet title={`Nothing found for "${q}"`} body="Check the spelling or try a shorter word." /></div>;
  return (
    <>
      <h1 className="m-0 mt-4 font-display text-[22px] font-normal dt:text-[28px]">{`Results for "${q}"`}</h1>
      <div className="mt-3">
        <Tabs
          label="Result types"
          value={tab}
          onChange={(id) => setTab(id as Tab)}
          items={[
            { id: "all", label: "All", count: total },
            { id: "questions", label: "Questions", count: t.questions },
            { id: "voices", label: "Voices", count: t.voices },
            { id: "people", label: "People", count: t.people },
          ]}
        />
      </div>
      {show("questions") && r.questions.length ? (
        <section className="mt-5">
          <h2 className="mb-2 font-display text-[18px] font-normal">Questions</h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {r.questions.map((x) => (
              <li key={x.id}>
                <Link href={`/q/${x.id}`} className="grid gap-1 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3 no-underline">
                  <strong className="text-[15px] text-[var(--ink)]">{x.text}</strong>
                  <span className="text-[13px] text-[var(--ink-2)]">
                    {[x.category?.name, voicesLabel(x.voiceCount), x.status === "LIVE" ? "Open" : "Closed"].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {show("voices") && r.answers.length ? (
        <section className="mt-5">
          <h2 className="mb-2 font-display text-[18px] font-normal">Voices</h2>
          <Answers items={r.answers} />
        </section>
      ) : null}
      {show("people") && r.people.length ? (
        <section className="mt-5">
          <h2 className="mb-2 font-display text-[18px] font-normal">People</h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {r.people.map((p) => (
              <li key={p.id} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
                <strong className="text-[15px]">{`@${p.handle}`}</strong>
                <div className="text-[13px] text-[var(--ink-2)]">{[p.state, voicesLabel(p.voiceCount)].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
