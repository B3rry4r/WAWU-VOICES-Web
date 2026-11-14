"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, EmptyState, Skeleton, TopicOfWeek, TopicTile } from "@/components/vx";
import { BUSY_TEXT, BUSY_TITLE, isBusy } from "@/lib/api/busy";
import { categoryLook } from "@/lib/categories";
import type { Answer, Question, Topic } from "@/lib/api/feed";
import { startsLabel, topicNotStarted, voicesLabel, weekMeta, voicesOf } from "@/lib/feed-format";
import { TalkCard, useToast } from "@/features/talk/TalkCard";
import { useSignedIn } from "@/features/talk/lib";
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
  const busy = isBusy(load.error);
  return (
    <Banner tone={offline ? "offline" : "danger"} title={offline ? "You are offline" : busy ? BUSY_TITLE : "This did not load"} action="Try again" onAction={load.retry}>
      {offline ? "Check your connection and try again." : busy ? BUSY_TEXT : "Something went wrong on our side. Try again in a moment."}
    </Banner>
  );
}

/** The frame of a card in a list: a tap on the card itself opens the conversation, a tap on a control (or inside a sheet the card drew) never does.
 *  Keyboard and screen readers get a real link, hidden until focused, so nothing is nested and nothing looks different. */
function OpenOnTap({ questionId, questionText, children }: { questionId: string; questionText?: string | null; children: React.ReactNode }) {
  const router = useRouter();
  const href = `/q/${questionId}`;
  return (
    <div
      className="relative cursor-pointer"
      onClick={(e) => {
        // React events bubble through portals: only a click whose target is inside this element, and not on a control, counts.
        const t = e.target as Element | null;
        if (!t || !e.currentTarget.contains(t)) return;
        if (t.closest("button, a, input, textarea, select, [role=button], [role=dialog], [role=menu]")) return;
        // A click that ends a text selection (a drag over the answer) is not a tap: leave the selection alone.
        if (typeof window !== "undefined" && (window.getSelection()?.toString() ?? "") !== "") return;
        router.push(href);
      }}
    >
      <Link href={href} aria-label={questionText ? `Open the conversation: ${questionText}` : undefined} className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-2 focus-visible:top-2 focus-visible:z-10 focus-visible:rounded-[var(--radius-m)] focus-visible:bg-[var(--surface)] focus-visible:px-2 focus-visible:py-1 focus-visible:text-[var(--ink)]">
        Open the conversation
      </Link>
      {children}
    </div>
  );
}

/** A list of voice cards (Home, a category, search). Each is the conversation page's own card, so every control works in place. */
export function Answers({ items, unfolded, signedIn }: { items: Answer[]; unfolded?: boolean; signedIn?: boolean | null }) {
  const [toast, push] = useToast();
  const own = useSignedIn();
  const known = signedIn ?? own;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {items.map((a) => (
        <TalkCard
          key={a.id}
          answer={a}
          signedIn={!!known}
          push={push}
          unfolded={unfolded && a.kind === "VOICE" ? true : undefined}
          frame={(card) => <OpenOnTap questionId={a.questionId} questionText={a.questionText}>{card}</OpenOnTap>}
        />
      ))}
      {toast}
    </div>
  );
}

/** Two tiles side by side in the colour of their category, as the boards draw them. */
export function Tiles({ items }: { items: Question[] }) {
  return (
    <div className="vx-tiles">
      {items.map((q) => {
        const look = q.category ? categoryLook(q.category) : null;
        return <TopicTile key={q.id} question={q.text} category={look?.label} voices={voicesOf(q)} tone={look?.tone ?? "mint"} href={`/q/${q.id}`} />;
      })}
    </div>
  );
}

/** Topic of the week. It opens the conversation of today's question (the topic page is not built), so without one it is not shown. */
export function WeekCard({ topic, questionId, variant }: { topic: Topic; questionId?: string | null; variant?: "banner" | "rail" }) {
  const router = useRouter();
  if (!questionId) return null;
  const href = `/q/${questionId}`;
  // V-PRELAUNCH: a week that has not begun says when it starts, not "Poll open", and offers nothing to join.
  const upcoming = topicNotStarted(topic);
  const meta = upcoming ? startsLabel(topic) : weekMeta(topic, !!topic.weeklyPollId);
  return variant === "rail" ? (
    <TopicOfWeek title={topic.title} meta={meta} variant="rail" upcoming={upcoming} onClick={() => router.push(href)} />
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
