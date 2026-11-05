"use client";
import { Button, QuestionHero } from "@/components/vx";
import { useRouter } from "next/navigation";
import { getPublicConfig, getTodaysQuestion, getTrending } from "@/lib/api/feed";
import { closesIn } from "@/lib/feed-format";
import { Answers, Failed, Loading, Section } from "./parts";
import { useLoad } from "./useLoad";

const STEPS = [
  ["Speak", "Record up to 10 seconds or write up to 500 characters."],
  ["Discuss", "Reply, and say if you agree, disagree or have lived it too."],
  ["Vote", "One vote per account. Nobody can buy extra votes."],
  ["What Next?", "Suggest what should change. Every idea is labelled Proposed."],
] as const;

export function LandingScreen() {
  const router = useRouter();
  const load = useLoad(() => Promise.all([getTodaysQuestion(), getTrending(1), getPublicConfig()]), []);
  if (load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const [q, trending, cfg] = load.data;
  const from = (cfg.costs.minPackKobo / 100).toLocaleString("en-NG");
  return (
    <>
      <p className="m-0 mt-1 text-[14px] font-semibold text-[var(--green-text)]">Nigeria&apos;s national conversation</p>
      <h1 className="m-0 mt-1 font-display text-[32px] font-normal leading-9">Nigeria is talking. Add your voice.</h1>
      <p className="mt-3 text-[16px] text-[var(--ink-2)]">
        Every day our editors ask one question. Answer with a 10 second voice or a few lines of text, hear what others said, and vote in open polls.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="primary" size="l" icon="mic" href="/join">Add your voice</Button>
        <Button size="l" href="/">Listen as a guest</Button>
      </div>
      <p className="mt-2 text-[13px] text-[var(--ink-2)]">Free to read, listen, like and share. Adults only (18+).</p>
      <div className="mt-5">
        <QuestionHero
          question={q.text}
          voices={q.voiceCount}
          closesIn={closesIn(q.endsAt)}
          speakLabel="Add your voice"
          onSpeak={() => router.push("/join")}
          onListen={() => router.push(`/q/${q.id}`)}
          onDiscuss={() => router.push(`/q/${q.id}`)}
          onVote={() => router.push(`/q/${q.id}`)}
        />
      </div>
      {trending.items[0] ? <div className="mt-4"><Answers items={[trending.items[0].answer!]} /></div> : null}
      <Section title="Every topic, four steps. Join at any one.">
        <ol className="m-0 grid list-none gap-3 p-0">
          {STEPS.map(([t, b]) => (
            <li key={t} className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4">
              <strong>{t}</strong>
              <div className="text-[14px] text-[var(--ink-2)]">{b}</div>
            </li>
          ))}
        </ol>
      </Section>
      <section className="mt-6 rounded-[16px] bg-[var(--forest)] p-4 text-[var(--on-forest)]">
        <h2 className="m-0 font-display text-[20px] font-normal">Fair from the first tap</h2>
        <p className="mt-2">{`Your first ${cfg.freePosts} posts are free.`}</p>
        <p className="mt-1 text-[14px]">{`After that, posting uses Voice Units from ₦${from}. Every price shows before you tap. Ads are always labelled, and your raw audio is never downloadable.`}</p>
      </section>
      <p className="mt-4 text-[13px] text-[var(--ink-2)]">When you join you accept the Community rules and Terms.</p>
    </>
  );
}
