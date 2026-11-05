import "@/features/reach/reach.css";
import { Badge, Logo, NewsTag, Poll } from "@/components/vx";
import { fmt } from "@/components/vx/helpers";
import type { SharePage } from "@/lib/api/reach";
import { AddVoice, LinkOpened } from "./ShareActions";
import { ClipPlayer } from "./ClipPlayer";

const NEWS_KIND = { VERIFIED_NEWS: "verified", UNVERIFIED_NEWS: "unverified", GOSSIP: "gossip" } as const;
const LABEL_TEXT: Record<string, string> = {
  TRENDING: "Trending",
  MOST_RELATABLE: "Most Relatable",
  MOST_THOUGHT_PROVOKING: "Most Thought-Provoking",
  MOST_DEBATED: "Most Debated",
  MOST_SUPPORTED: "Most Supported",
  MOST_SURPRISING: "Most Surprising",
};

/** "12 min", "5h", "1d": how long ago, in the short form the boards use. */
export function agoShort(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Eyebrow({ children }: { children: string }) {
  return <h2 className="vx-eyebrow m-0 text-ink-2">{children}</h2>;
}

/** The no-account page behind a share link (GET /share/{code}). Server rendered; only the player and the two events are client code. */
export function SharePageView({ page, now }: { page: SharePage; now: number }) {
  const maxArg = Math.max(1, ...page.arguments.map((a) => a.voices));
  const voice = page.featuredVoice;
  const transcript = voice?.clip?.transcript?.status === "READY" ? voice.clip.transcript.text : null;
  const bar = (i: number) => ({ width: `${Math.max(4, Math.round((page.arguments[i].voices * 100) / maxArg))}%` });
  const stats = [`${fmt(page.basedOnVoices)} voices`, page.poll ? `${fmt(page.poll.totalVotes)} votes so far` : null].filter(Boolean).join(" · ");
  const hasLean = !!page.leanLine || page.arguments.length > 0;

  const cta = (
    <>
      <AddVoice code={page.code} label={page.ctaLabel} block />
      <p className="m-0 text-center text-[14px] leading-5 text-ink-2">Record here in your browser. Sign in only when you publish.</p>
    </>
  );

  return (
    <div className="rx-public" data-testid="share-page">
      <LinkOpened code={page.code} />
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-3 dt:px-8 dt:py-5">
        <Logo height={36} />
      </header>
      <div className="mx-auto grid max-w-[1100px] gap-6 px-4 pb-40 dt:grid-cols-[1fr_340px] dt:px-8 dt:pb-16">
        <main className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="vx-eyebrow text-green-text">{page.countryAndTheme}</span>
            {page.news ? <div><NewsTag kind={NEWS_KIND[page.news.tag]} /></div> : null}
            <h1 className="m-0 font-display text-[30px] font-normal leading-9 dt:text-[40px] dt:leading-[46px]">{page.topicLine}</h1>
            <p className="m-0 text-[15px] leading-5 text-ink-2">{stats}</p>
          </div>

          {hasLean ? (
            <section className="flex flex-col gap-3 rounded-l border border-line bg-surface p-4 shadow-1" aria-label="Where it is heading">
              <Eyebrow>Where it is heading</Eyebrow>
              {page.leanLine ? <p className="m-0 text-[18px] font-bold leading-6">{page.leanLine}</p> : null}
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {page.arguments.map((a, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-[16px] leading-5"><span>{a.text}</span><span className="font-bold text-ink-2">{fmt(a.voices)}</span></div>
                    <span className="block h-2 overflow-hidden rounded-pill bg-surface-3" aria-hidden="true"><i className={"block h-full rounded-pill " + (i === 0 ? "bg-green" : "bg-mint")} style={bar(i)} /></span>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-[13px] leading-4 text-ink-2">{`Based on ${fmt(page.basedOnVoices)} voices · updated ${agoShort(page.summaryUpdatedAt, now)} ago · ${page.summaryLabel}`}</p>
            </section>
          ) : null}

          {voice ? (
            <section className="flex flex-col gap-2" aria-label="Featured voice">
              <Eyebrow>Featured voice</Eyebrow>
              <article className="vx-answer" aria-label={"Voice from " + (voice.author ? "@" + voice.author.handle : "an anonymous poster")}>
                <div className="vx-answer__head">
                  <div className="vx-answer__who">
                    <span className="vx-answer__name">{voice.author ? "@" + voice.author.handle : "Anonymous"}</span>
                    <span className="vx-answer__time">{agoShort(voice.createdAt, now) + (voice.author?.state ? " · " + voice.author.state : "")}</span>
                  </div>
                </div>
                {voice.labels?.length ? <div className="vx-answer__labels"><Badge tone="green">{LABEL_TEXT[voice.labels[0]] ?? voice.labels[0]}</Badge></div> : null}
                {voice.clip ? <ClipPlayer clipId={voice.clip.id} durationMs={voice.clip.durationMs} peaks={voice.clip.peaks} /> : null}
                {voice.body ? <p className="vx-answer__text">{voice.body}</p> : null}
                {transcript ? <p className="vx-answer__transcript"><b>Transcript</b>{transcript}</p> : null}
              </article>
            </section>
          ) : null}

          {page.poll ? (
            <section className="flex flex-col gap-2" aria-label="The poll so far">
              <Eyebrow>The poll so far</Eyebrow>
              <Poll question={page.question?.text ?? page.topicLine} options={page.poll.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes ?? 0 }))} total={page.poll.totalVotes} state="results" live={false} onExplain={false} />
            </section>
          ) : null}

          {page.topProposal && page.proposalCount ? (
            <section className="flex flex-col gap-2" aria-label="What Next?">
              <Eyebrow>{`What Next? · ${page.proposalCount} ${page.proposalCount === 1 ? "proposal" : "proposals"}`}</Eyebrow>
              <article className="flex flex-col gap-2 rounded-l border border-line bg-surface p-4 shadow-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-bold leading-5">{"@" + page.topProposal.author.handle}<span className="ml-2 text-[14px] font-normal text-ink-2">{agoShort(page.topProposal.createdAt, now)}</span></span>
                  <Badge tone="proposed" />
                </div>
                {page.topProposal.body ? <p className="m-0 text-[18px] font-bold leading-6">{page.topProposal.body}</p> : null}
                <p className="m-0 text-[14px] leading-5 text-ink-2">{`${fmt(page.topProposal.supportCount)} support · ${fmt(page.topProposal.challengeCount)} challenge`}</p>
              </article>
            </section>
          ) : null}
        </main>

        <aside className="hidden dt:block" aria-label="Add your voice">
          <div className="sticky top-6 flex flex-col gap-3 rounded-l border border-line bg-surface p-5 shadow-1">
            <h2 className="m-0 font-display text-[24px] font-normal leading-8">What do you think?</h2>
            <p className="m-0 text-[16px] leading-6 text-ink-2">Say it in 10 seconds, right here in your browser. You only sign in when you publish.</p>
            <AddVoice code={page.code} label={page.ctaLabel} block />
          </div>
        </aside>
      </div>
      <div className="rx-public__bar dt:hidden"><div className="mx-auto flex max-w-[560px] flex-col gap-2">{cta}</div></div>
    </div>
  );
}
