"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Banner, QuestionHero, TrendingList } from "@/components/vx";
import { Rail } from "@/components/shell/ShellSlots";
import { getHome, getMe, getTrendingQuestions, type Home } from "@/lib/api/feed";
import { listMyAnswers } from "@/lib/api/profile";
import { getAdPlacement, getFlashPolls, type AdPlacement, type Poll } from "@/lib/api/polls";
import { isSignedIn } from "@/lib/api/auth";
import { closesIn, shortCount, uniqueVoices, voicesOf } from "@/lib/feed-format";
import { AdCard } from "./AdCard";
import { AudioAdCard } from "./AudioAdCard";
import { OverrideMessage } from "./OverrideMessage";
import { FlashPoll } from "./FlashPoll";
import { WeeklyReportLink } from "./LinkCards";
import { Answers, Failed, Loading, NothingYet, Section, TextLink, Tiles, WeekCard } from "./parts";
import { useFinishProfile } from "@/features/entry/ui";
import { SuspendedBanner } from "@/features/profile/SuspendedBanner";
import { trendItems } from "./trend";
import { useLoad } from "./useLoad";

interface Data {
  home: Home;
  flash: Poll | null;
  trending: ReturnType<typeof trendItems>;
  ad: AdPlacement | null;
  /** V-FIX-B: the short audio advert, between the posts and the new conversations, for everyone. */
  audioAd: AdPlacement | null;
  firstName: string | null;
  suspended: { status: string; until: string | null } | null;
  /** Signed in and already answered today's question (H6): the card offers listening, not Speak again. */
  answered: boolean;
}

/** Home: signed in greets by name and shows the flash poll; a guest reads the same feed with the "Listening is free" line (HomeGuest board). */
export function HomeScreen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => setSignedIn(isSignedIn()), []);
  useFinishProfile();
  const load = useLoad<Data>(async () => {
    const [home, flash, trending, ad, audioAd, who] = await Promise.all([
      getHome(),
      signedIn ? getFlashPolls().then((r) => r.items[0] ?? null, () => null) : Promise.resolve(null),
      getTrendingQuestions(3).then((r) => trendItems(r.items), () => []),
      getAdPlacement().catch(() => null),
      getAdPlacement("AUDIO_SLOT").catch(() => null),
      signedIn
        ? getMe().then(
            // Me carries no suspendedUntil (checked against 6a): the banner reads the end day from the suspension notice.
            (m) => ({ firstName: m.profile?.displayName?.trim().split(/\s+/)[0] ?? null, suspended: m.status === "SUSPENDED" ? { status: m.status, until: (m as { suspendedUntil?: string | null }).suspendedUntil ?? null } : null }),
            () => ({ firstName: null, suspended: null }),
          )
        : Promise.resolve({ firstName: null, suspended: null }),
    ]);
    const today = home.dailyQuestion?.id;
    const answered = signedIn && today ? await listMyAnswers().then((p) => p.items.some((i) => i.answer?.questionId === today), () => false) : false;
    return { home, flash, trending, ad, audioAd, firstName: who.firstName, suspended: who.suspended, answered };
  }, [signedIn]);
  if (signedIn === null || load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const { home: h, flash, trending, ad, audioAd, firstName, suspended, answered } = load.data;
  const q = h.dailyQuestion;
  const go = (path: string) => () => router.push(path);
  const talk = q ? go(`/q/${q.id}`) : undefined;

  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="order-1 m-0 mt-1 font-display text-display-l dt:text-display-xl">
          {!signedIn ? "What is Nigeria saying today?" : firstName ? `Hi ${firstName}, what is your take today?` : "What is your take today?"}
        </h1>
        {suspended ? <div className="order-1"><SuspendedBanner status={suspended.status} until={suspended.until} /></div> : null}
        {q ? (
          <div className="order-2">
            <QuestionHero
              question={q.text}
              voices={voicesOf(q)}
              closesIn={closesIn(q.endsAt)}
              avatars={uniqueVoices(q.recentVoices).map((v) => v.handle)}
              speakLabel={answered ? "Listen to answers" : signedIn ? undefined : "Add your voice"}
              speakIcon={answered ? "headphones" : undefined}
              answered={answered}
              onSpeak={answered ? talk : go("/speak")}
              onListen={talk}
              onDiscuss={talk}
              onVote={talk}
            />
            {/* lead ruling WF, 6 Nov (C-H5, then the LOW "as drawn"): a live override's message sits right under its headline, the question.
                V-FIX-B (addendum 4): and its picture, voice note and link button after it. */}
            {q.override ? <OverrideMessage o={q.override} /> : null}
          </div>
        ) : (
          <div className="order-2"><NothingYet title="No question yet" body="Today’s question shows up here as soon as it opens." /></div>
        )}
        {signedIn ? null : (
          <div className="order-3">
            <Banner tone="info" icon="headphones" title="Listening is free.">
              Read, listen, like and share without an account. We only ask for your number when you post, react or vote.
            </Banner>
          </div>
        )}
        <div className="order-4 dt:hidden"><WeekCard topic={h.topicOfWeek} questionId={q?.id} /></div>
        <div className="order-4 dt:hidden"><WeeklyReportLink /></div>

        {flash ? (
          <Section className="order-5 dt:order-5" title={<>Flash poll <Badge tone="live" /></>}>
            <FlashPoll poll={flash} signedIn={!!signedIn} />
          </Section>
        ) : null}

        <Section
          className="order-6 dt:order-6"
          title={<><span className="dt:hidden">Trending answers</span><span className="hidden dt:inline">Top voices on today’s question</span></>}
          aside={
            q ? (
              <TextLink href={`/q/${q.id}`}>
                <span className={voicesOf(q) > 0 ? "dt:hidden" : undefined}>See all</span>
                {voicesOf(q) > 0 ? <span className="hidden dt:inline">{`See all ${shortCount(voicesOf(q))}`}</span> : null}
              </TextLink>
            ) : undefined
          }
        >
          {h.trending.length ? <Answers items={h.trending.slice(0, 2)} /> : <NothingYet title="No voices yet" body="Be the first to answer today’s question." />}
        </Section>

        {/* Addendum 3B: between posts, never inside one and never among the first three items. */}
        {audioAd?.audioClipId ? <div className="order-6 dt:order-6"><AudioAdCard ad={audioAd} /></div> : null}

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
