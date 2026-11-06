"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnswerCard, Banner, Button, EmptyState, Skeleton, TopicOfWeek, TopicTile } from "@/components/vx";
import { categoryLook } from "@/lib/categories";
import type { Answer, Question, Topic } from "@/lib/api/feed";
import { answerCardProps, voicesLabel, weekMeta } from "@/lib/feed-format";
import type { Load } from "./useLoad";

export function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton variant="tile" />
      <Skeleton variant="answer" />
      <Skeleton variant="answer" />
    </div>
  );
}

export function Failed({ load }: { load: Extract<Load<unknown>, { state: "error" }> }) {
  const offline = "kind" in load.error;
  return (
    <Banner tone={offline ? "offline" : "danger"} title={offline ? "You are offline" : "This did not load"} action="Try again" onAction={load.retry}>
      {offline ? "Check your connection and try again." : "Something went wrong on our side. Try again in a moment."}
    </Banner>
  );
}

export function Answers({ items, unfolded }: { items: Answer[]; unfolded?: boolean }) {
  return (
    <div className="grid gap-3">
      {items.map((a) => (
        <Link key={a.id} href={`/q/${a.questionId}`} className="block no-underline">
          <AnswerCard {...answerCardProps(a)} unfolded={unfolded && a.kind === "VOICE" ? true : undefined} />
        </Link>
      ))}
    </div>
  );
}

/** Two tiles side by side in the colour of their category, as the boards draw them. */
export function Tiles({ items }: { items: Question[] }) {
  return (
    <div className="vx-tiles">
      {items.map((q) => {
        const look = q.category ? categoryLook(q.category) : null;
        return <TopicTile key={q.id} question={q.text} category={look?.label} voices={q.voiceCount} tone={look?.tone ?? "mint"} href={`/q/${q.id}`} />;
      })}
    </div>
  );
}

/** Topic of the week. It opens the conversation of today's question (the topic page is not built), so without one it is not shown. */
export function WeekCard({ topic, questionId, variant }: { topic: Topic; questionId?: string | null; variant?: "banner" | "rail" }) {
  const router = useRouter();
  if (!questionId) return null;
  const href = `/q/${questionId}`;
  const meta = weekMeta(topic, !!topic.weeklyPollId);
  return variant === "rail" ? (
    <TopicOfWeek title={topic.title} meta={meta} variant="rail" onClick={() => router.push(href)} />
  ) : (
    <div className="contents [&_a:focus-visible]:[box-shadow:var(--shadow-focus)]">
      <TopicOfWeek title={topic.title} meta={meta} href={href} />
    </div>
  );
}

/** A section: an eyebrow heading (and a link on the right), then its content. `className` places it (order, visibility). */
export function Section({ title, aside, className = "", children }: { title: React.ReactNode; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`mt-2 flex flex-col gap-[10px] ${className}`}>
      <div className={`flex items-center justify-between gap-2 ${aside ? "min-h-[44px]" : ""}`}>
        <h2 className="vx-eyebrow m-0 flex items-center gap-2 text-[var(--ink-2)]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="link-more text-label">{children}</Link>;
}

export function NothingYet({ title, body }: { title: string; body: string }) {
  return <EmptyState icon="message-square" title={title} body={body} />;
}

/** One search box that goes to /search?q=. A real form, so Enter works on every keyboard. */
export function SearchBox({ defaultValue, placeholder = "Search questions, voices and handles" }: { defaultValue?: string; placeholder?: string }) {
  const router = useRouter();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <label className="vx-search">
        <span className="vx-sr">Search VOICES</span>
        <input className="vx-search__input" type="search" name="q" minLength={2} placeholder={placeholder} defaultValue={defaultValue} enterKeyHint="search" />
      </label>
    </form>
  );
}

export function SpeakCta({ label = "Add your voice" }: { label?: string }) {
  return (
    <Button variant="dark" size="l" icon="mic" href="/speak">{label}</Button>
  );
}

export { voicesLabel };
