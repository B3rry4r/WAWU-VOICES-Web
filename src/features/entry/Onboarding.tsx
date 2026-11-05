"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ASSETS, Button, FreePosts, Icon, Logo, VoicePlayer } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { getPublicConfig, getTodaysQuestion } from "@/lib/api/feed";
import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { closesIn, voicesLabel } from "@/lib/feed-format";
import { BottomBar, EntryFrame, EntryScroll, ErrorBanner, useSkipIfSignedIn } from "./ui";
import { fromPrice, textPostNaira } from "./format";

type Poll = components["schemas"]["Poll"];

/** The poll on slide 2: the open weekly poll if there is one. Without one the bar is not drawn. */
const getCurrentPoll = () => apiFetch<Poll | null>("/polls/current").catch(() => null);

const REACTS = ["💯 Exactly", "❤️ Relatable", "🤔 Thought-provoking"];

/** The player here is a picture of how a voice looks, not a recording: it is out of the tab order and ignores taps. */
function Still({ children }: { children: ReactNode }) {
  return <div aria-hidden="true" className="pointer-events-none relative" ref={(el) => el?.setAttribute("inert", "")}>{children}</div>;
}

/** /join: three welcome slides (390) or one page (1440). Skip and Start go on to the country step. */
export function Onboarding() {
  const skipping = useSkipIfSignedIn();
  const [i, setI] = useState(0);
  const load = useLoad(() => Promise.all([getTodaysQuestion(), getPublicConfig(), getCurrentPoll()]), []);
  if (skipping) return null;
  const logo = <Link href="/welcome" className="flex" aria-label="VOICES"><Logo height={34} alt="VOICES" /></Link>;
  const skip = <Link href="/join/country" className="-mr-2 inline-flex min-h-[44px] items-center px-2 text-[15px] font-semibold leading-5 text-green-text no-underline">Skip</Link>;
  if (load.state !== "ready") {
    return (
      <EntryFrame>
        <header className="flex items-center justify-between px-4 h-[107px] pt-[47px]">{logo}{skip}</header>
        <EntryScroll>
          <div className="p-4" aria-busy={load.state === "loading"}>
            {load.state === "error" ? <ErrorBanner error={load.error} onRetry={load.retry} fallback="Something went wrong on our side. Try again in a moment." title="This did not load" /> : <div className="h-[400px] animate-pulse rounded-[28px] bg-surface-2" />}
          </div>
        </EntryScroll>
      </EntryFrame>
    );
  }
  const [q, cfg, poll] = load.data;
  const from = fromPrice(cfg);
  const text = textPostNaira(cfg);
  const pctOf = (o: { votes?: number; percent?: number }) => o.percent ?? (poll && poll.totalVotes > 0 ? Math.round(((o.votes ?? 0) / poll.totalVotes) * 100) : 0);
  const lead = poll?.options?.length ? [...poll.options].sort((x, y) => pctOf(y) - pctOf(x))[0] : null;
  const leadPct = lead && poll && poll.totalVotes > 0 ? pctOf(lead) : null;

  const slides = [
    {
      title: "Nigeria is talking",
      body: "One question from our editors every day. Speak for 10 seconds or write a few lines.",
      art: (
        <>
          <span className="inline-flex h-[30px] -rotate-2 items-center self-start rounded-[10px] bg-green px-3 text-[12px] font-bold uppercase leading-4 tracking-[0.1em] text-green-on">Today&apos;s question</span>
          <p className="relative m-0 font-display text-[30px] font-normal leading-[34px]">{q.text}</p>
          <Still><VoicePlayer duration={9} seed={4} tone="forest" progress={0.35} /></Still>
        </>
      ),
    },
    {
      title: "Hear the country",
      body: "Listen to real voices, react, and see where people lean in open polls. Listening is always free.",
      art: (
        <>
          <Still><VoicePlayer duration={9} seed={7} tone="forest" progress={0.6} playing /></Still>
          <div className="relative flex flex-wrap gap-2">
            {REACTS.map((r) => <span key={r} className="inline-flex h-10 items-center gap-[6px] rounded-full bg-[var(--forest-2)] px-[14px] text-[14px] font-semibold leading-[18px]">{r}</span>)}
          </div>
          {lead && leadPct !== null && poll ? (
            <div className="relative flex flex-col gap-2 rounded-[20px] bg-[var(--forest-2)] p-4">
              <span className="flex justify-between text-[14px] font-semibold leading-[18px]"><span>{lead.label}</span><span>{leadPct}%</span></span>
              <span className="block h-[10px] rounded-full bg-forest"><i className="block h-[10px] rounded-full bg-green" style={{ width: `${leadPct}%` }} /></span>
              <span className="text-[13px] font-medium leading-[18px] text-[var(--on-forest-2)]">{`Open poll · ${poll.totalVotes.toLocaleString("en-NG")} votes so far`}</span>
            </div>
          ) : null}
        </>
      ),
    },
    {
      title: `Your first ${cfg.freePosts} posts are free`,
      body: "Every price shows before you tap. No surprise charges. VOICES is for adults (18+).",
      art: (
        <>
          <div className="relative flex flex-col gap-[14px] rounded-[20px] bg-surface p-5 text-ink">
            <FreePosts left={cfg.freePosts} total={cfg.freePosts} />
            <p className="m-0 text-[14px] font-medium leading-5 text-ink-2">Text and voice both count. Deleting a post does not give one back.</p>
          </div>
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sun text-[var(--on-sun)]"><Icon name="coins" size={20} /></span>
            <span className="text-[15px] font-semibold leading-[21px]">{`Then Voice Units from ₦${from}. A text post uses ${text.units} unit (₦${text.naira}).`}</span>
          </div>
        </>
      ),
    },
  ];
  const s = slides[i];
  const last = i === slides.length - 1;
  const dots = (
    <div className="flex justify-center gap-2" role="img" aria-label={`Step ${i + 1} of 3`}>
      {slides.map((_, n) => <span key={n} className={`h-2 rounded-full ${n === i ? "w-6 bg-green" : "w-2 bg-line-strong"}`} />)}
    </div>
  );
  return (
    <EntryFrame>
      {/* phone: carousel */}
      <div className="flex min-h-0 flex-1 flex-col dt:hidden">
        <header className="flex flex-none items-center gap-2 px-4 h-[107px] pt-[47px]">{logo}<span className="flex-1" />{skip}</header>
        <EntryScroll>
          <section aria-roledescription="carousel" aria-label="Welcome to VOICES" className="flex flex-col gap-5 px-4 pt-2">
            <div className="relative flex h-[400px] flex-col justify-center gap-[18px] overflow-hidden rounded-[28px] bg-forest px-6 py-7 text-forest-on">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.markWhite} alt="" aria-hidden="true" className="pointer-events-none absolute -right-[70px] -top-[60px] w-[260px] opacity-[0.08]" />
              {s.art}
            </div>
            <div className="flex flex-col gap-[10px]" aria-live="polite">
              <h1 className="m-0 font-display text-[32px] font-normal leading-9">{s.title}</h1>
              <p className="m-0 text-[17px] leading-[25px] text-ink-2">{s.body}</p>
            </div>
          </section>
        </EntryScroll>
        <div className="flex flex-none flex-col gap-4 bg-bg px-4 pb-6 pt-3">
          {dots}
          {last ? <Button size="l" icon="mic" block href="/join/country">Start</Button> : <Button size="l" block iconEnd="chevron-right" onClick={() => setI(i + 1)}>Next</Button>}
        </div>
      </div>
      {/* desktop: one centred card */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-y-auto dt:flex">
        <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-0 py-6">{logo}{skip}</header>
        <div className="mx-auto my-auto grid w-full max-w-[1120px] grid-cols-2 overflow-hidden rounded-[32px] border border-line bg-surface">
          <div className="relative flex flex-col justify-end gap-5 overflow-hidden bg-forest p-10 text-forest-on">
            <span className="inline-flex h-[30px] -rotate-2 items-center self-start rounded-[10px] bg-green px-3 text-[12px] font-bold uppercase leading-4 tracking-[0.1em] text-green-on">Today&apos;s question</span>
            <p className="relative m-0 font-display text-[38px] font-normal leading-[44px]">{q.text}</p>
            <Still><VoicePlayer duration={9} seed={4} tone="forest" progress={0.35} /></Still>
            <span className="relative text-[14px] font-medium leading-5 text-[var(--on-forest-2)]">{`${voicesLabel(q.voiceCount)} so far · Closes in ${closesIn(q.endsAt)}`}</span>
          </div>
          <div className="flex flex-col justify-center gap-5 p-10">
            <span className="vx-eyebrow text-green-text">Welcome</span>
            <h1 className="m-0 font-display text-[44px] font-normal leading-[50px]">Nigeria&apos;s national conversation</h1>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {[
                ["mic", "One question a day", "Speak for 10 seconds or write a few lines."],
                ["headphones", "Hear the country", "Listen, react and vote in open polls. Listening is always free."],
                ["coins", `${cfg.freePosts} free posts to start`, `Then Voice Units from ₦${from}. Every price shows before you tap.`],
              ].map(([ic, t, b]) => (
                <li key={t} className="flex items-start gap-4">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-mint text-green-text"><Icon name={ic as "mic"} size={22} /></span>
                  <span className="flex flex-col gap-[2px]"><b className="text-[18px] font-semibold leading-6">{t}</b><span className="text-[16px] leading-6 text-ink-2">{b}</span></span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button size="l" icon="mic" href="/join/country">Get started</Button>
              <Button size="l" variant="secondary" href="/sign-in">I have an account</Button>
            </div>
            <p className="m-0 text-[14px] leading-5 text-ink-2">VOICES is for adults (18+). By continuing you accept the <Link href="/settings/legal/rules" className="text-green-text">Community rules</Link>.</p>
          </div>
        </div>
        <div className="h-8 flex-none" />
      </div>
    </EntryFrame>
  );
}
