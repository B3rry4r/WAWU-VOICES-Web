"use client";
import { useRouter } from "next/navigation";
import { Banner, QuestionHero } from "@/components/vx";
import { getHome, type Home } from "@/lib/api/feed";
import { isSignedIn } from "@/lib/api/auth";
import { closesIn } from "@/lib/feed-format";
import { useEffect, useState } from "react";
import { Answers, Failed, Loading, NothingYet, Section, Tiles, WeekCard } from "./parts";
import { useLoad } from "./useLoad";

/** Home: signed in greets by name; a guest reads the same feed with the "Listening is free" line (HomeGuest board). */
export function HomeScreen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => setSignedIn(isSignedIn()), []);
  const load = useLoad<Home>(getHome, [signedIn]);
  if (signedIn === null || load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const h = load.data;
  const q = h.dailyQuestion;
  return (
    <>
      <h1 className="m-0 mt-1 font-display text-[28px] font-normal leading-8 dt:text-[32px] dt:leading-9">
        {signedIn && h.greetingName ? `Hi ${h.greetingName}, what is your take today?` : "What is Nigeria saying today?"}
      </h1>
      <div className="mt-4 grid gap-4">
        {q ? (
          <QuestionHero
            question={q.text}
            voices={q.voiceCount}
            closesIn={closesIn(q.endsAt)}
            avatars={q.recentVoices.map((v) => v.handle)}
            speakLabel="Add your voice"
            onSpeak={() => router.push("/speak")}
            onListen={() => router.push(`/q/${q.id}`)}
            onDiscuss={() => router.push(`/q/${q.id}`)}
            onVote={() => router.push(`/q/${q.id}`)}
          />
        ) : null}
        {signedIn ? null : (
          <Banner tone="info" title="Listening is free.">
            Read, listen, like and share without an account. We only ask for your number when you post, react or vote.
          </Banner>
        )}
        <WeekCard topic={h.topicOfWeek} />
      </div>
      <Section title="Trending answers" seeAll={{ href: "/discover" }}>
        {h.trending.length ? <Answers items={h.trending} /> : <NothingYet title="No voices yet" body="Be the first to answer today's question." />}
      </Section>
      <Section title="New conversations">
        {h.newConversations.length ? <Tiles items={h.newConversations.slice(0, 2)} /> : <NothingYet title="Nothing new yet" body="New conversations show up here as they open." />}
      </Section>
    </>
  );
}
