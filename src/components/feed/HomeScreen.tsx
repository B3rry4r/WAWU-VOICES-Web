"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Banner, QuestionHero, TrendingList } from "@/components/vx";
import { Rail } from "@/components/shell/ShellSlots";
import { getHome, getMe, getTrendingQuestions, type Home } from "@/lib/api/feed";
import { getAdPlacement, getFlashPolls, type AdPlacement, type Poll } from "@/lib/api/polls";
import { isSignedIn } from "@/lib/api/auth";
import { closesIn, shortCount } from "@/lib/feed-format";
import { AdCard } from "./AdCard";
import { FlashPoll } from "./FlashPoll";
import { Answers, Failed, Loading, NothingYet, Section, TextLink, Tiles, WeekCard } from "./parts";
import { useFinishProfile } from "@/features/entry/ui";
import { trendItems } from "./trend";
import { useLoad } from "./useLoad";

interface Data {
  home: Home;
  flash: Poll | null;
  trending: ReturnType<typeof trendItems>;
  ad: AdPlacement | null;
  firstName: string | null;
}

/** Home: signed in greets by name and shows the flash poll; a guest reads the same feed with the "Listening is free" line (HomeGuest board). */
export function HomeScreen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => setSignedIn(isSignedIn()), []);
  useFinishProfile();
  const load = useLoad<Data>(async () => {
    const [home, flash, trending, ad, firstName] = await Promise.all([
      getHome(),
      signedIn ? getFlashPolls().then((r) => r.items[0] ?? null, () => null) : Promise.resolve(null),
      getTrendingQuestions(3).then((r) => trendItems(r.items), () => []),
      getAdPlacement().catch(() => null),
      signedIn ? getMe().then((m) => m.profile?.displayName?.trim().split(/\s+/)[0] ?? null, () => null) : Promise.resolve(null),
    ]);
    return { home, flash, trending, ad, firstName };
  }, [signedIn]);
  if (signedIn === null || load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const { home: h, flash, trending, ad, firstName } = load.data;
  const q = h.dailyQuestion;
  const go = (path: string) => () => router.push(path);
  const talk = q ? go(`/q/${q.id}`) : undefined;

  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="order-1 m-0 mt-1 font-display text-display-l dt:text-display-xl">
          {!signedIn ? "What is Nigeria saying today?" : (firstName ?? h.greetingName) ? `Hi ${firstName ?? h.greetingName}, what is your take today?` : "What is your take today?"}
        </h1>
        {q ? (
          <div className="order-2">
            <QuestionHero
              question={q.text}
              voices={q.voiceCount}
              closesIn={closesIn(q.endsAt)}
              avatars={q.recentVoices.map((v) => v.handle)}
              speakLabel={signedIn ? undefined : "Add your voice"}
              onSpeak={go("/speak")}
              onListen={talk}
              onDiscuss={talk}
              onVote={talk}
            />
          </div>
        ) : (
          <div className="order-2"><NothingYet title="No question yet" body="Today's question shows up here as soon as it opens." /></div>
        )}
        {signedIn ? null : (
          <div className="order-3">
            <Banner tone="info" icon="headphones" title="Listening is free.">
              Read, listen, like and share without an account. We only ask for your number when you post, react or vote.
            </Banner>
          </div>
        )}
        <div className="order-4 dt:hidden"><WeekCard topic={h.topicOfWeek} questionId={q?.id} /></div>

        {flash ? (
          <Section className="order-5 dt:order-5" title={<>Flash poll <Badge tone="live" /></>}>
            <FlashPoll poll={flash} signedIn={!!signedIn} />
          </Section>
        ) : null}

        <Section
          className="order-6 dt:order-6"
          title={<><span className="dt:hidden">Trending answers</span><span className="hidden dt:inline">Top voices on today&apos;s question</span></>}
          aside={
            q ? (
              <TextLink href={`/q/${q.id}`}>
                <span className="dt:hidden">See all</span>
                <span className="hidden dt:inline">{`See all ${shortCount(q.voiceCount)}`}</span>
              </TextLink>
            ) : undefined
          }
        >
          {h.trending.length ? <Answers items={h.trending.slice(0, 2)} /> : <NothingYet title="No voices yet" body="Be the first to answer today's question." />}
        </Section>

        <Section className="order-7 dt:order-4 dt:[&>div:first-child]:hidden" title="New conversations">
          {h.newConversations.length ? <Tiles items={h.newConversations.slice(0, 2)} /> : <NothingYet title="Nothing new yet" body="New conversations show up here as they open." />}
        </Section>

        {signedIn ? <div className="order-8 dt:hidden"><AdCard ad={ad} /></div> : null}
      </div>

      <Rail>
        <WeekCard topic={h.topicOfWeek} questionId={q?.id} variant="rail" />
        {trending.length ? <TrendingList items={trending} /> : null}
        <AdCard ad={ad} inRail />
      </Rail>
    </>
  );
}
