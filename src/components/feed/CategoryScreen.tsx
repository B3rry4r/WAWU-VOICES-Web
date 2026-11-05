"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Icon, IconButton, Tabs, TopicChip, TopicTile, TrendingList } from "@/components/vx";
import { PhoneBar, Rail } from "@/components/shell/ShellSlots";
import { ApiError } from "@/lib/api/client";
import { getCategory, getCurrentTopic, getMyCategories, getTodaysQuestion, getTrendingQuestions, setMyCategories, type Question } from "@/lib/api/feed";
import { getAdPlacement } from "@/lib/api/polls";
import { isSignedIn } from "@/lib/api/auth";
import { categoryLook } from "@/lib/categories";
import { closesIn, shortCount } from "@/lib/feed-format";
import { AdCard } from "./AdCard";
import { Answers, Failed, Loading, NothingYet, Section, WeekCard } from "./parts";
import { trendItems } from "./trend";
import { useLoad } from "./useLoad";

const COPY = {
  open: ["No open questions", "New questions in this category show up here."],
  closed: ["No closed questions", "Questions that have finished show up here."],
  polls: ["No polls right now", "Questions with an open poll show up here."],
} as const;
type Tab = keyof typeof COPY;
const LIST_LABEL: Record<Tab, string> = { open: "Open questions", closed: "Closed questions", polls: "Questions with a poll" };

const voices = (n: number) => `${shortCount(n)} ${n === 1 ? "voice" : "voices"}`;

/** One row of the phone list: the question, its voices, and what is open about it. */
function Row({ q, today, tab }: { q: Question; today?: boolean; tab: Tab }) {
  const close = tab === "closed" ? undefined : closesIn(q.endsAt);
  const meta = [voices(q.voiceCount), q.hasOpenPoll && tab !== "closed" ? "Poll open" : null, close ? `Closes in ${close}` : null].filter(Boolean).join(" · ");
  return (
    <Link href={`/q/${q.id}`} className="flex items-center gap-3 border-b border-[var(--line)] p-4 text-[var(--ink)] no-underline last:border-b-0">
      <span className="flex flex-1 flex-col gap-[6px]">
        {today ? <span className="flex gap-[6px]"><Badge tone="green" icon="mic">Today&apos;s question</Badge></span> : null}
        <span className="font-display text-[18px] leading-[23px]">{q.text}</span>
        <span className="text-[13px] font-medium leading-[18px] text-[var(--ink-2)]">{meta}</span>
      </span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

/** The chip on the hero: whether this category's alerts are on. Only for someone who follows the category; it flips the switch. */
function AlertsChip({ categoryId }: { categoryId: string }) {
  const [follows, setFollows] = useState<{ categoryId: string; alertsOn: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isSignedIn()) return;
    getMyCategories().then((r) => setFollows(r.categories), () => setFollows(null));
  }, []);
  const mine = follows?.find((f) => f.categoryId === categoryId);
  if (!follows || !mine) return null;
  async function flip() {
    if (busy || !follows) return;
    setBusy(true);
    const next = follows.map((f) => (f.categoryId === categoryId ? { ...f, alertsOn: !f.alertsOn } : f));
    try {
      const r = await setMyCategories(next);
      setFollows(r.categories);
    } catch {
      /* the chip keeps its old state; nothing changed on the server */
    } finally {
      setBusy(false);
    }
  }
  return <TopicChip label={mine.alertsOn ? "Alerts on" : "Alerts off"} icon="bell" selected={mine.alertsOn} onClick={flip} />;
}

export function CategoryScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const load = useLoad(async () => {
    const d = await getCategory(slug, tab);
    const [topic, today, trending, ad] = await Promise.all([
      getCurrentTopic().catch(() => null),
      getTodaysQuestion().catch(() => null),
      getTrendingQuestions(3, d.category.id).then((r) => trendItems(r.items), () => []),
      getAdPlacement("FEED_CARD", d.category.id).catch(() => null),
    ]);
    return { d, topic, today, trending, ad };
  }, [slug, tab]);
  if (load.state === "loading") return <Loading />;
  if (load.state === "error") {
    if (load.error instanceof ApiError && load.error.status === 404)
      return <NothingYet title="We could not find that category" body="Go back to Discover and pick another." />;
    return <Failed load={load} />;
  }
  const { d, topic, today: todayQ, trending, ad } = load.data;
  const look = categoryLook(d.category);
  const today = tab === "open" ? d.todaysQuestion : null;
  const rest = d.questions.filter((q) => q.id !== today?.id);
  const list = today ? [today, ...rest] : rest;
  const tone = look.tone === "sun" ? "var(--tile-sun)" : `var(--tile-${look.tone})`;
  const fg = look.tone === "sun" ? "var(--on-tile-sun)" : "var(--on-tile)";
  const label = d.category.name;

  return (
    <>
      <PhoneBar>
        <IconButton icon="arrow-left" label="Back to Discover" onClick={() => router.push("/discover")} />
        <span className="flex-1 text-[16px] font-bold leading-5 text-[var(--ink-2)]">Discover</span>
      </PhoneBar>
      <Link href="/discover" className="hidden min-h-[44px] items-center gap-[6px] self-start text-[15px] font-semibold text-[var(--ink-2)] no-underline dt:inline-flex" aria-label="Back to Discover">
        <Icon name="arrow-left" size={18} />Discover
      </Link>
      <div className="mt-1 flex flex-col gap-5 dt:gap-6">
        <section className="flex flex-col gap-3 rounded-[var(--radius-xl)] p-5 dt:flex-row dt:flex-wrap dt:items-start dt:gap-5 dt:p-7" style={{ background: tone, color: fg }}>
          <div className="flex items-center justify-between gap-3 dt:order-3 dt:ml-auto">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--forest)] text-[var(--sun)] dt:hidden"><Icon name={look.icon} /></span>
            <AlertsChip categoryId={d.category.id} />
          </div>
          <span className="hidden h-16 w-16 flex-none items-center justify-center rounded-full bg-[var(--forest)] text-[var(--sun)] dt:order-1 dt:flex"><Icon name={look.icon} size={28} /></span>
          <div className="flex flex-col gap-2 dt:order-2 dt:flex-1 dt:basis-[280px]">
            <h1 className="m-0 font-display text-[28px] font-normal leading-8 dt:text-[36px] dt:leading-10 dt:tracking-[-0.01em]">{label}</h1>
            {d.category.blurb ? <p className="m-0 text-[16px] font-medium leading-6">{d.category.blurb}</p> : null}
            <p className="m-0 text-[13px] font-bold leading-[18px]">{`${d.category.questionCount} ${d.category.questionCount === 1 ? "question" : "questions"} · ${voices(d.category.voicesThisWeek)} this week`}</p>
          </div>
        </section>

        <Tabs
          label={`Questions in ${label}`}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
          items={[
            { id: "open", label: "Open", count: d.counts.open },
            { id: "closed", label: "Closed", count: d.counts.closed },
            { id: "polls", label: "Polls", count: d.counts.polls },
          ]}
        />

        {list.length ? (
          <>
            <section aria-label={`${LIST_LABEL[tab]} in ${label}`} className="flex flex-col overflow-hidden rounded-[var(--radius-l)] bg-[var(--surface)] shadow-[inset_0_0_0_1px_var(--line)] dt:hidden">
              {list.map((q) => <Row key={q.id} q={q} today={q.id === today?.id} tab={tab} />)}
            </section>
            <div className="hidden gap-3 dt:grid dt:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))]">
              {list.map((q) => {
                const close = tab === "closed" ? undefined : closesIn(q.endsAt);
                const eyebrow = q.id === today?.id ? "Today's question" : q.hasOpenPoll && tab !== "closed" ? "Poll open" : close ? `Closes in ${close}` : undefined;
                return <TopicTile key={q.id} question={q.text} category={eyebrow} voices={q.voiceCount} tone={q.id === today?.id ? "forest" : "sun"} href={`/q/${q.id}`} />;
              })}
            </div>
          </>
        ) : (
          <NothingYet title={COPY[tab][0]} body={COPY[tab][1]} />
        )}

        {d.topVoices.length ? (
          <Section title={<><span className="dt:hidden">{`Top voice in ${label} this week`}</span><span className="hidden dt:inline">{`Top voices in ${label} this week`}</span></>}>
            <div className="dt:hidden"><Answers items={d.topVoices.slice(0, 1)} /></div>
            <div className="hidden dt:block"><Answers items={d.topVoices.slice(0, 2)} /></div>
          </Section>
        ) : null}
      </div>

      <Rail>
        {topic ? <WeekCard topic={topic} questionId={todayQ?.id} variant="rail" /> : null}
        {trending.length ? <TrendingList title={`Trending in ${label}`} items={trending} /> : null}
        <AdCard ad={ad} inRail />
      </Rail>
    </>
  );
}
