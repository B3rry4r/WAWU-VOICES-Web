"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnswerCard, Banner, Button, EmptyState, Skeleton, TopicOfWeek, TopicTile } from "@/components/vx";
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

export function Answers({ items }: { items: Answer[] }) {
  return (
    <div className="grid gap-3">
      {items.map((a) => (
        <Link key={a.id} href={`/q/${a.questionId}`} className="block no-underline">
          <AnswerCard {...answerCardProps(a)} />
        </Link>
      ))}
    </div>
  );
}

export function Tiles({ items }: { items: Question[] }) {
  return (
    <div className="grid gap-3">
      {items.map((q, i) => (
        <TopicTile key={q.id} question={q.text} category={q.category?.name} voices={q.voiceCount} tone={i % 2 ? "sun" : "forest"} href={`/q/${q.id}`} />
      ))}
    </div>
  );
}

export function WeekCard({ topic, variant }: { topic: Topic; variant?: "banner" | "rail" }) {
  return <TopicOfWeek title={topic.title} meta={weekMeta(topic, !!topic.weeklyPollId)} variant={variant} href={`/topics/${topic.id}`} />;
}

export function Section({ title, seeAll, children }: { title: string; seeAll?: { href: string; label?: string }; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-0 font-display text-[20px] font-normal">{title}</h2>
        {seeAll ? <Link href={seeAll.href} className="text-[14px] font-semibold">{seeAll.label ?? "See all"}</Link> : null}
      </div>
      {children}
    </section>
  );
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
