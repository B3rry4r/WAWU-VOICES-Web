"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Icon, Logo, QuestionHero, Skeleton, type IconName } from "@/components/vx";
import { Answers } from "@/components/feed/parts";
import { useLoad } from "@/components/feed/useLoad";
import { getPublicConfig, getTodaysQuestion, getTrending } from "@/lib/api/feed";
import { closesIn } from "@/lib/feed-format";
import { BottomBar, EntryFrame, EntryScroll, ErrorBanner, useSkipIfSignedIn } from "./ui";
import { fromPrice } from "./format";

const STEPS: { icon: IconName; title: string; phone: string; desk: string }[] = [
  { icon: "mic", title: "Speak", phone: "Record up to 10 seconds or write up to 500 characters.", desk: "Record up to 10 seconds or write up to 500 characters. Hear it back before you post." },
  { icon: "messages-square", title: "Discuss", phone: "Reply, and say if you agree, disagree or have lived it too.", desk: "Reply by voice or text. Say if you agree, disagree or have lived it too." },
  { icon: "vote", title: "Vote", phone: "One vote per account. Nobody can buy extra votes.", desk: "One vote per account in open polls. Nobody can buy extra votes." },
  { icon: "lightbulb", title: "What Next?", phone: "Suggest what should change. Every idea is labelled Proposed.", desk: "Suggest what should change. Every idea is labelled Proposed until it is proven." },
];

const TRUST: { icon: IconName; text: string }[] = [
  { icon: "headphones", text: "Reading, listening, liking and sharing are always free" },
  { icon: "megaphone", text: "Every ad and sponsored post is labelled" },
  { icon: "lock", text: "Your raw audio is never downloadable" },
];

/** Guest welcome page (/welcome): the Landing board at 390 and 1440. */
export function Landing() {
  const router = useRouter();
  const skipping = useSkipIfSignedIn();
  const load = useLoad(() => Promise.all([getTodaysQuestion(), getTrending(1), getPublicConfig()]), []);
  if (skipping) return null;
  const header = (
    <>
      <header className="flex h-[107px] flex-none items-center gap-2 px-4 pt-[47px] dt:hidden">
        <Link href="/" className="mr-auto flex" aria-label="VOICES home"><Logo height={34} alt="VOICES home" /></Link>
      </header>
      <header className="mx-auto hidden w-full max-w-[1176px] items-center gap-8 px-8 py-5 dt:flex">
        <Link href="/" className="mr-6 flex" aria-label="VOICES home"><Logo height={40} alt="VOICES home" /></Link>
        <a href="#how" className="text-[15px] font-semibold text-ink no-underline">How it works</a>
        <Link href="/weekly" className="text-[15px] font-semibold text-ink no-underline">Weekly report</Link>
        <Link href="/settings/legal/rules" className="text-[15px] font-semibold text-ink no-underline">Rules</Link>
        <span className="ml-auto flex gap-3">
          <Button variant="secondary" href="/sign-in">Sign in</Button>
          <Button icon="mic" href="/">Add your voice</Button>
        </span>
      </header>
    </>
  );
  let body;
  if (load.state === "loading") body = <div className="grid gap-4 p-4" aria-busy="true"><Skeleton variant="tile" /><Skeleton variant="answer" /></div>;
  else if (load.state === "error") body = <div className="p-4"><ErrorBanner error={load.error} onRetry={load.retry} fallback="Something went wrong on our side. Try again in a moment." title="This did not load" /></div>;
  else {
    const [q, trending, cfg] = load.data;
    const from = fromPrice(cfg);
    const voice = trending.items[0]?.answer;
    const hero = (
      <section className="flex flex-col gap-[14px] pt-1">
        <span className="vx-eyebrow text-green-text">Nigeria&apos;s national conversation</span>
        <h1 className="m-0 font-display text-[40px] font-normal leading-[44px] tracking-[-0.01em] dt:text-[64px] dt:leading-[68px]">Nigeria is talking. Add your voice.</h1>
        <p className="m-0 text-[17px] leading-[25px] text-ink-2 dt:max-w-[420px] dt:text-[20px] dt:leading-[30px]">
          Every day our editors ask one question. Answer with a 10 second voice or a few lines of text, hear what others said, and vote in open polls.
        </p>
        <div className="flex flex-col gap-[14px] dt:flex-row">
          <span className="hidden dt:block"><Button size="l" icon="mic" href="/">Add your voice</Button></span>
          <Button size="l" variant="secondary" icon="headphones" href="/" className="max-dt:w-full">Listen as a guest</Button>
        </div>
        <p className="m-0 flex items-center gap-2 text-[14px] font-medium leading-5 text-ink-2"><Icon name="lock" size={16} />Free to read, listen, like and share. Adults only (18+).</p>
      </section>
    );
    const today = (
      <section aria-label="Today's question" className="mt-2 flex flex-col gap-3 dt:mt-0">
        <QuestionHero
          question={q.text}
          voices={q.voiceCount}
          closesIn={closesIn(q.endsAt)}
          speakLabel="Add your voice"
          onSpeak={() => router.push("/")}
          onListen={() => router.push(`/q/${q.id}`)}
          onDiscuss={() => router.push(`/q/${q.id}`)}
          onVote={() => router.push(`/q/${q.id}`)}
        />
        {voice ? <Answers items={[voice]} /> : null}
      </section>
    );
    body = (
      <>
        <div className="mx-auto flex w-full max-w-[1176px] flex-col gap-4 px-4 pb-6 pt-1 dt:grid dt:grid-cols-2 dt:items-center dt:gap-12 dt:px-8 dt:py-16">
          {hero}
          {today}
        </div>
        <section id="how" aria-labelledby="h-how" className="dt:border-y dt:border-line dt:bg-surface">
          <div className="mx-auto flex max-w-[1176px] flex-col gap-3 px-4 pb-6 dt:gap-8 dt:px-8 dt:py-16">
            <h2 id="h-how" className="m-0 font-display text-[24px] font-normal leading-7 dt:text-[40px] dt:leading-[48px]">Every topic, four steps. Join at any one.</h2>
            <ol className="m-0 grid list-none gap-0 p-0 dt:grid-cols-4 dt:gap-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex items-start gap-3 px-4 py-[14px] dt:flex-col dt:gap-4 dt:rounded-l dt:border dt:border-line dt:bg-bg dt:p-6">
                  <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-[14px] dt:h-[52px] dt:w-[52px] ${i === 0 ? "bg-green text-green-on" : "bg-mint text-green-text"}`}><Icon name={s.icon} size={22} /></span>
                  <span className="flex flex-col gap-[2px]">
                    <b className="font-display text-[20px] font-normal leading-6">{s.title}</b>
                    <span className="text-[15px] leading-[22px] text-ink-2 dt:hidden">{s.phone}</span>
                    <span className="hidden text-[15px] leading-[22px] text-ink-2 dt:block">{s.desk}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <div className="mx-auto w-full max-w-[1176px] px-4 pb-6 dt:px-8 dt:py-16">
          <section aria-labelledby="h-free" className="relative flex flex-col gap-[14px] overflow-hidden rounded-[28px] bg-forest px-6 py-7 text-forest-on dt:grid dt:grid-cols-2 dt:items-center dt:gap-12 dt:px-12 dt:py-12">
            <div className="relative flex flex-col gap-[14px]">
              <span className="vx-eyebrow text-sun">Fair from the first tap</span>
              <h2 id="h-free" className="m-0 font-display text-[30px] font-normal leading-[34px] dt:text-[44px] dt:leading-[48px]">{`Your first ${cfg.freePosts} posts are free.`}</h2>
              <p className="m-0 text-[16px] leading-6 text-[var(--on-forest-2)] dt:hidden">{`After that, posting uses Voice Units from ₦${from}. Every price shows before you tap. Ads are always labelled, and your raw audio is never downloadable.`}</p>
              <p className="m-0 hidden text-[16px] leading-6 text-[var(--on-forest-2)] dt:block">{`After that, posting uses Voice Units from ₦${from}. Every price shows before you tap.`}</p>
            </div>
            <ul className="relative m-0 hidden list-none flex-col gap-3 p-0 dt:flex">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-center gap-4 rounded-m bg-[var(--forest-2)] px-5 py-4 text-[16px] font-semibold"><Icon name={t.icon} size={22} />{t.text}</li>
              ))}
            </ul>
          </section>
        </div>
        <footer className="hidden border-t border-line dt:block">
          <div className="mx-auto flex max-w-[1176px] items-center gap-4 px-8 py-6">
            <Logo height={28} alt="VOICES" />
            <span className="text-[14px] text-ink-2">VOICES by WAWU · © 2026</span>
            <span className="ml-auto flex gap-5">
              <Link href="/settings/legal/rules" className="text-[14px] text-ink-2 underline">Community rules</Link>
              <Link href="/settings/legal/terms" className="text-[14px] text-ink-2 underline">Terms</Link>
              <Link href="/settings/legal/privacy" className="text-[14px] text-ink-2 underline">Privacy</Link>
              <Link href="/settings/legal/refunds" className="text-[14px] text-ink-2 underline">Refunds</Link>
            </span>
          </div>
        </footer>
      </>
    );
  }
  return (
    <EntryFrame>
      {header}
      <EntryScroll>{body}</EntryScroll>
      <div className="dt:hidden">
        <BottomBar>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-[10px]">
            <Button size="l" variant="secondary" block href="/sign-in">Sign in</Button>
            <Button size="l" icon="mic" block href="/join">Join VOICES</Button>
          </div>
          <p className="m-0 text-center text-[12px] font-medium leading-4 text-ink-2">When you join you accept the <Link href="/settings/legal/rules" className="text-green-text">Community rules</Link>, <Link href="/settings/legal/terms" className="text-green-text">Terms</Link> and <Link href="/settings/legal/privacy" className="text-green-text">Privacy</Link>.</p>
        </BottomBar>
      </div>
    </EntryFrame>
  );
}
