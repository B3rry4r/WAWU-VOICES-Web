import "@/features/reach/reach.css";
import { countText, leaderFirst } from "@/lib/format/plural";
import { Avatar, Badge, Button, Logo, NewsTag, Poll } from "@/components/vx";
import { fmt } from "@/components/vx/helpers";
import type { SharePage } from "@/lib/api/reach";
import { AddVoice, GuestOnly, LinkOpened, SignInOrOpen } from "./ShareActions";
import { MoodChip } from "@/features/mood/MoodChip";
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
/** What the page needs beyond GET /share/{code} (lead ruling WF-6, 6 Nov, RX5): the poll's own title on a question page, and the person's voicesCount on a profile page. null when it could not be read. */
export interface ShareExtras {
  pollTitle?: string | null;
  profileVoices?: number | null;
}

/** "updated just now" / "updated 5 min ago": the time reads as one phrase (WF-6, B-N1). */
export function updatedAgo(iso: string, now = Date.now()): string {
  const a = agoShort(iso, now);
  return a === "now" ? "updated just now" : `updated ${a} ago`;
}

export function SharePageView({ page, now, extras }: { page: SharePage; now: number; extras?: ShareExtras }) {
  const isPoll = page.objectType === "POLL_RESULT";
  const isProfile = page.objectType === "PROFILE";
  // A poll's voters are votes, not voices (RX5): the poll page counts votes only; a question page counts its voicesCount; a profile page its person's voicesCount.
  const voicesN = page.question?.voicesCount ?? page.basedOnVoices;
  const maxArg = Math.max(1, ...page.arguments.map((a) => a.voices));
  const voice = page.featuredVoice;
  const transcript = voice?.clip?.transcript?.status === "READY" ? voice.clip.transcript.text : null;
  const bar = (i: number) => ({ width: `${Math.max(4, Math.round((page.arguments[i].voices * 100) / maxArg))}%` });
  const stats = (isPoll
    ? [page.poll ? `${countText(page.poll.totalVotes, "vote")} so far` : null]
    : isProfile
      ? [extras?.profileVoices != null ? countText(extras.profileVoices, "voice") : null]
      : [countText(voicesN, "voice"), page.poll ? `${countText(page.poll.totalVotes, "vote")} so far` : null]
  ).filter(Boolean).join(" · ");
  // A poll page lists its options once, in the poll card below (WF-7b, A-F2): the heading block keeps only the summary line.
  const shownArgs = isPoll ? [] : page.arguments;
  // A tie has no leader (WF-7b, A-F5): a summary line that names one is swapped for "Tied so far."
  const tops = page.poll ? [...page.poll.options].map((o) => o.votes ?? 0).sort((a, b) => b - a) : [];
  const tied = tops.length > 1 && tops[0] > 0 && tops[0] === tops[1];
  const leanLine = isPoll && tied ? "Tied so far." : page.leanLine;
  const hasLean = !!leanLine || shownArgs.length > 0;

  const cta = (
    <>
      <AddVoice code={page.code} label={page.ctaLabel} block />
      <GuestOnly><p className="m-0 mx-auto text-center text-caption text-ink-2">Record here in your browser. Sign in only when you publish.</p></GuestOnly>
    </>
  );

  return (
    <div className="min-h-dvh bg-bg text-ink" data-testid="share-page">
      <LinkOpened code={page.code} />
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-3 dt:px-8 dt:py-5">
        <Logo height={36} />
        <span className="flex items-center gap-2">
          <span className="hidden dt:block"><Button variant="ghost" href="/welcome">What is VOICES?</Button></span>
          <SignInOrOpen code={page.code} />
        </span>
      </header>
      <div className="mx-auto grid max-w-[1100px] gap-6 px-4 pb-40 dt:grid-cols-[1fr_340px] dt:px-8 dt:pb-16">
        <main className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="vx-eyebrow text-green-text">{page.countryAndTheme}</span>
            {page.news ? <div><NewsTag kind={NEWS_KIND[page.news.tag]} /></div> : null}
            <h1 className="m-0 font-display text-display-l dt:text-display-2xl">{page.topicLine}</h1>
            {stats ? <p className="m-0 text-body text-ink-2">{stats}</p> : null}
          </div>

          {hasLean ? (
            <section className="flex flex-col gap-3 rounded-l border border-line bg-surface p-4 shadow-1" aria-label="Where it is heading">
              <Eyebrow>Where it is heading</Eyebrow>
              {leanLine ? <p className="m-0 text-title">{leanLine}</p> : null}
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {shownArgs.map((a, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-body"><span>{a.text}</span><span className="text-body-strong text-ink-2">{fmt(a.voices)}</span></div>
                    <span className="block h-2 overflow-hidden rounded-pill bg-surface-3" aria-hidden="true"><i className={"block h-full rounded-pill " + (i === 0 ? "bg-green" : "bg-mint")} style={bar(i)} /></span>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-caption text-ink-2">{`Based on ${isPoll ? countText(page.basedOnVoices, "vote") : countText(page.basedOnVoices, "voice")} · ${updatedAgo(page.summaryUpdatedAt, now)} · ${page.summaryLabel}`}</p>
            </section>
          ) : null}

          {voice ? (
            <section className="flex flex-col gap-2" aria-label="Featured voice">
              <Eyebrow>Featured voice</Eyebrow>
              <article className="vx-answer" aria-label={"Voice from " + (voice.author ? "@" + voice.author.handle : "an anonymous poster")}>
                <div className="vx-answer__head">
                  <Avatar name={voice.author ? voice.author.displayName ?? voice.author.handle : "Anonymous"} src={voice.author?.avatarUrl ?? undefined} />
                  <div className="vx-answer__who">
                    <span className="vx-answer__name">{voice.author ? "@" + voice.author.handle : "Anonymous"}</span>
                    <span className="vx-answer__time">{agoShort(voice.createdAt, now) + (voice.author?.state ? " · " + voice.author.state : "")}</span>
                  </div>
                </div>
                {voice.labels?.length || voice.mood ? <div className="vx-answer__labels">{voice.mood ? <MoodChip mood={voice.mood} /> : null}{voice.labels?.length ? <Badge tone="green">{LABEL_TEXT[voice.labels[0]] ?? voice.labels[0]}</Badge> : null}</div> : null}
                {voice.clip ? <ClipPlayer answerId={voice.id} clipId={voice.clip.id} durationMs={voice.clip.durationMs} peaks={voice.clip.peaks} /> : null}
                {voice.body ? <p className="vx-answer__text">{voice.body}</p> : null}
                {transcript ? <p className="vx-answer__transcript"><b>Transcript</b>{transcript}</p> : null}
              </article>
            </section>
          ) : null}

          {page.poll ? (
            <section className="flex flex-col gap-2" aria-label="The poll so far">
              <Eyebrow>The poll so far</Eyebrow>
              <Poll question={isPoll ? page.topicLine : extras?.pollTitle || "Poll results"} options={leaderFirst(page.poll.options.map((o) => ({ id: o.id, label: o.label, votes: o.votes ?? 0 })))} total={page.poll.totalVotes} state="results" live={false} onExplain={false} hideQuestion={isPoll} />
            </section>
          ) : null}

          {page.topProposal && page.proposalCount ? (
            <section className="flex flex-col gap-2" aria-label="What Next?">
              <Eyebrow>{`What Next? · ${page.proposalCount} ${page.proposalCount === 1 ? "proposal" : "proposals"}`}</Eyebrow>
              <article className="flex flex-col gap-2 rounded-l border border-line bg-surface p-4 shadow-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-strong">{"@" + page.topProposal.author.handle}<span className="ml-2 text-caption text-ink-2">{agoShort(page.topProposal.createdAt, now)}</span></span>
                  <Badge tone="proposed" />
                </div>
                {page.topProposal.body ? <p className="m-0 text-title">{page.topProposal.body}</p> : null}
                <p className="m-0 text-caption text-ink-2">{`${fmt(page.topProposal.supportCount)} support · ${fmt(page.topProposal.challengeCount)} challenge`}</p>
              </article>
            </section>
          ) : null}
        </main>

        <aside className="hidden dt:block" aria-label="Add your voice">
          <div className="sticky top-6 flex flex-col gap-3 rounded-l bg-forest p-5 text-forest-on shadow-1">
            <h2 className="m-0 font-display text-display-m">What do you think?</h2>
            <p className="m-0 text-body text-[color:var(--on-forest-2)]">Say it in up to a minute, right here in your browser.<GuestOnly> You only sign in when you publish.</GuestOnly></p>
            <AddVoice code={page.code} label={page.ctaLabel} block />
          </div>
        </aside>
      </div>
      <div className="rx-public__bar dt:hidden"><div className="mx-auto flex max-w-[560px] flex-col gap-2">{cta}</div></div>
    </div>
  );
}
