"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Icon, TopicChip, TrendingList } from "@/components/vx";
import { PhoneBar, Rail } from "@/components/shell/ShellSlots";
import { getCategories, getCurrentTopic, getNewsTags, getTodaysQuestion, getTrendingQuestions } from "@/lib/api/feed";
import { getAdPlacement, getFlashPolls } from "@/lib/api/polls";
import { DRAWN, categoryLook } from "@/lib/categories";
import { isSignedIn } from "@/lib/api/auth";
import { shortCount } from "@/lib/feed-format";
import { AdCard } from "./AdCard";
import { FlashPoll } from "./FlashPoll";
import { Failed, Loading, NothingYet, SearchBox, Section, WeekCard } from "./parts";
import { trendItems } from "./trend";
import { useLoad } from "./useLoad";

const TAG_ICON = { VERIFIED_NEWS: "shield-check", UNVERIFIED_NEWS: "shield-alert", GOSSIP: "messages-square" } as const;
const TONE_VAR = { sun: "--tile-sun", mint: "--tile-mint", sky: "--tile-sky", coral: "--tile-coral", forest: "--tile-forest" } as const;

function CategoryTile({ slug, name, voices, wide }: { slug: string; name: string; voices: number; wide?: boolean }) {
  const look = categoryLook({ slug, name });
  const fg = look.tone === "sun" ? "--on-tile-sun" : "--on-tile";
  return (
    <Link
      href={`/c/${slug}`}
      className={`flex flex-col justify-between gap-3 rounded-[var(--radius-l)] p-[14px] no-underline ${wide ? "min-h-[120px] p-4 dt:gap-4" : "h-[112px] w-[132px] flex-none"}`}
      style={{ background: `var(${TONE_VAR[look.tone]})`, color: `var(${fg})` }}
    >
      <Icon name={look.icon} />
      <span className="flex flex-col gap-[2px]">
        <span className="font-display text-[18px] leading-[22px]">{look.label}</span>
        <span className="text-[13px] font-semibold leading-[18px]">{`${shortCount(voices)} ${voices === 1 ? "voice" : "voices"}`}</span>
      </span>
    </Link>
  );
}

export function DiscoverScreen() {
  const router = useRouter();
  const [all, setAll] = useState(false);
  // Browser-only state is read in an effect so the server render and the first client render match (no hydration mismatch).
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(isSignedIn()), []);
  const load = useLoad(async () => {
    const [cats, topic, today, trending, flash, tags, ad] = await Promise.all([
      getCategories(),
      getCurrentTopic(),
      getTodaysQuestion().catch(() => null),
      getTrendingQuestions(4).then((r) => trendItems(r.items), () => []),
      getFlashPolls().then((r) => r.items, () => []),
      getNewsTags().then((r) => r.items, () => []),
      getAdPlacement().catch(() => null),
    ]);
    return { cats: cats.items, topic, today, trending, flash, tags, ad };
  }, []);
  if (load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const { cats, topic, today, trending, flash, tags, ad } = load.data;
  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const drawn = DRAWN.map((d) => bySlug.get(d.slug)).filter((c): c is NonNullable<typeof c> => !!c);
  const rest = cats.filter((c) => !DRAWN.some((d) => d.slug === c.slug));
  const shown = all ? [...drawn, ...rest] : drawn;
  const week = <WeekCard topic={topic} questionId={today?.id} />;

  return (
    <>
      <PhoneBar>
        <h1 className="m-0 mt-1 flex-1 pl-2 font-display text-[30px] font-normal leading-[34px]">Discover</h1>
      </PhoneBar>
      <div className="mt-1 hidden flex-col gap-1 dt:flex">
        <h1 className="m-0 font-display text-[36px] font-normal leading-10 tracking-[-0.01em]">Discover</h1>
        <p className="m-0 text-[16px] leading-6 text-[var(--ink-2)]">Every conversation on VOICES, by topic, by tag and by what is moving now.</p>
      </div>
      <div className="flex flex-col gap-5 dt:gap-6 dt:pt-6">
        <div className="dt:hidden"><SearchBox /></div>

        <Section
          className="order-3 dt:order-6"
          title="Categories"
          aside={
            !all && rest.length ? (
              <button type="button" className="min-h-[32px] border-0 bg-transparent p-0 text-[14px] font-semibold text-[var(--green-text)]" onClick={() => setAll(true)}>See all</button>
            ) : undefined
          }
        >
          {drawn.length || rest.length ? (
            <>
              <div className="-mx-4 flex gap-[10px] overflow-x-auto px-4 [scrollbar-width:none] dt:hidden [&::-webkit-scrollbar]:hidden">
                {shown.map((c) => <CategoryTile key={c.id} slug={c.slug} name={c.name} voices={c.voicesThisWeek} />)}
              </div>
              <div className="hidden gap-3 dt:grid dt:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
                {shown.map((c) => <CategoryTile key={c.id} slug={c.slug} name={c.name} voices={c.voicesThisWeek} wide />)}
              </div>
            </>
          ) : (
            <NothingYet title="No categories yet" body="Categories show up here as soon as they open." />
          )}
        </Section>

        <section aria-labelledby="news-h" className="order-4 flex flex-col gap-3 rounded-[var(--radius-l)] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line)] dt:order-5 dt:flex-row dt:flex-wrap dt:items-center dt:gap-4 dt:p-5">
          <div className="flex items-center gap-3 dt:flex-1 dt:basis-[220px]">
            <div className="flex flex-1 flex-col gap-[2px]">
              <h2 id="news-h" className="m-0 font-display text-[22px] font-normal leading-[27px]">Newsroom</h2>
              <p className="m-0 text-[14px] font-medium leading-5 text-[var(--ink-2)]">
                News posts, sorted by their tag.<span className="hidden dt:inline"> Follow the ones you trust.</span>
              </p>
            </div>
            <Link href="/news" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-[var(--green-text)] no-underline dt:hidden">Open<Icon name="chevron-right" size={18} /></Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link key={t.tag} href={`/news?tag=${t.tag}`} className="vx-chip no-underline"><Icon name={TAG_ICON[t.tag]} size={16} strokeWidth={2.25} />{t.label}<span className="vx-chip__count">{shortCount(t.count)}</span></Link>
            ))}
          </div>
          <Link href="/news" className="hidden min-h-[44px] items-center gap-1 text-[15px] font-semibold text-[var(--green-text)] no-underline dt:inline-flex">Open the Newsroom<Icon name="chevron-right" size={18} /></Link>
        </section>

        <div className="order-5 dt:order-3">{week}</div>

        {flash.length ? (
          <Section className="order-6 dt:order-4" title={<><span className="dt:hidden">Flash poll</span><span className="hidden dt:inline">Flash polls</span> <Badge tone="live" /></>}>
            <div className="grid items-start gap-4 dt:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))]">
              {flash.slice(0, 2).map((p, i) => (
                <div key={p.id} className={i > 0 ? "hidden dt:block" : undefined}>
                  <FlashPoll poll={p} signedIn={signedIn} />
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <div className="order-7 dt:hidden">
          {trending.length ? <TrendingList items={trending.slice(0, 3)} /> : <NothingYet title="Nothing trending yet" body="Questions that people are answering show up here." />}
        </div>
      </div>

      <Rail>
        {trending.length ? <TrendingList items={trending} /> : null}
        <AdCard ad={ad} inRail />
      </Rail>
    </>
  );
}
