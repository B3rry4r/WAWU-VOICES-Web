"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShareSheet } from "@/features/talk/TalkCard";
import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { Avatar, Button, Icon, Logo, QuestionHero, Skeleton } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { getTodaysQuestion } from "@/lib/api/feed";
import { isSignedIn } from "@/lib/api/auth";
import { getInviter } from "@/lib/api/invite";
import { keptInviteCode } from "@/lib/invite";
import { closesIn, comingUp, questionStart, voicesOf } from "@/lib/feed-format";
import { TONE, isMoodQuestion, pickHref, writePick } from "@/features/mood/mood";
import type { Mood } from "@/lib/api/mood";
import { BottomBar, EntryFrame, EntryScroll, ErrorBanner } from "./ui";
import { LANDING_EYEBROW, LANDING_HEADLINE_EN, LANDING_HEADLINE_YO, LANDING_INTRO } from "./landing-words";

/**
 * /go (LCH-08, Go-390 board): the page the broadcast links to. The launch words, today's question with its word buttons
 * (a mood question) or as Home shows it (any other), "Listen as a guest", "Add your voice" and the bottom bar.
 * Everyone may open it, signed in or not. A word tap writes the pick the way the pick screen does and opens that screen,
 * so a guest who signs up from there comes back to the same word.
 * A visitor who arrived by a friend's link (the kept invite cookie) sees "@name asked how you feel." with the inviter's
 * avatar: the server turns the code into the handle and nothing else, and a code it does not know draws no line.
 */
export function Go() {
  const router = useRouter();
  const [shareNode, share] = useShareSheet();
  const load = useLoad(() => getTodaysQuestion(), [], questionStart);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(isSignedIn()), []);
  const [inviter, setInviter] = useState<string | null>(null);
  useEffect(() => {
    const code = keptInviteCode();
    if (!code) return;
    let live = true;
    getInviter(code).then((r) => { if (live && r?.handle) setInviter(r.handle); }, () => undefined);
    return () => { live = false; };
  }, []);

  // V-PRELAUNCH round 2: until the question has opened nothing here says to listen or to add a voice; the way to join stays.
  const before = load.state === "ready" && !!comingUp(load.data);
  const addHref = load.state === "ready" && isMoodQuestion(load.data) ? pickHref(load.data.id) : "/speak";
  const header = (
    <>
      <header className="flex h-[107px] flex-none items-center gap-2 px-4 pt-[47px] dt:hidden">
        <Link href="/welcome" className="mr-auto flex" aria-label="VOICES home"><Logo height={34} alt="VOICES home" /></Link>
        {signedIn ? null : (
          <Link href="/join/country" className="sh-country" aria-label="Country: Nigeria. Change country">
            <Globe size={18} aria-hidden="true" />Nigeria<Icon name="chevron-down" size={16} />
          </Link>
        )}
      </header>
      <header className="mx-auto hidden w-full max-w-[1176px] items-center gap-8 px-8 py-5 dt:flex">
        <Link href="/welcome" className="mr-auto flex" aria-label="VOICES home"><Logo height={40} alt="VOICES home" /></Link>
        <span className="flex gap-3">
          {signedIn ? <Button variant="secondary" href="/">Home</Button> : <Button variant="secondary" href="/sign-in">Sign in</Button>}
          {load.state === "loading" ? null : before ? (signedIn ? null : <Button icon="mic" href="/join">Join VOICES</Button>) : <Button icon="mic" href={addHref}>Add your voice</Button>}
        </span>
      </header>
    </>
  );

  let body;
  if (load.state === "loading") body = <div className="grid gap-4 p-4" aria-busy="true"><Skeleton variant="tile" /><Skeleton variant="answer" /></div>;
  else if (load.state === "error") body = <div className="p-4"><ErrorBanner error={load.error} onRetry={load.retry} fallback="Something went wrong on our side. Try again in a moment." title="This did not load" /></div>;
  else {
    const q = load.data;
    const mood = isMoodQuestion(q);
    const opens = comingUp(q);
    const pick = (m: Mood) => { writePick(q.id, m); router.push(`${pickHref(q.id)}?mood=${m}`); };
    body = (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[18px] px-4 pb-6 pt-1 dt:px-8 dt:pb-16 dt:pt-8">
        {inviter ? (
          <p data-testid="go-inviter" className="m-0 flex items-center gap-[10px] rounded-m bg-mint px-3 py-[10px] text-[14px] font-semibold leading-5 text-green-text">
            <Avatar name={inviter.replace(/[._]+/g, " ")} size="s" tone="sun" />{`@${inviter} asked how you feel.`}
          </p>
        ) : null}
        <section className="flex flex-col gap-3">
          <span className="vx-eyebrow text-green-text">{LANDING_EYEBROW}</span>
          <h1 className="m-0 font-display text-[38px] leading-[42px] tracking-[-0.01em] headline-yo">{LANDING_HEADLINE_YO} <br />{LANDING_HEADLINE_EN}</h1>
          <p className="m-0 text-body text-ink-2">{LANDING_INTRO}</p>
        </section>
        {mood ? (
          <section aria-labelledby="lq-h" className="relative flex flex-col gap-[14px] overflow-hidden rounded-xl bg-forest px-[18px] pb-[18px] pt-[22px] text-forest-on">
            <span className="vx-eyebrow text-sun">{opens ? "Coming up" : "Today’s question"}</span>
            <h2 id="lq-h" className="m-0 font-display text-display-l">{q.text}</h2>
            {opens ? <p data-testid="go-opens" className="m-0 text-[17px] font-bold leading-6">{opens}</p> : null}
            {opens ? <Button size="s" icon="share-2" onClick={() => share("QUESTION", q.id, { notOpen: true })}>Share</Button> : null}
            {opens ? null : <div role="group" aria-labelledby="lq-h" className="grid grid-cols-2 gap-2">
              {(q.moodOptions as Mood[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`go-${m}`}
                  onClick={() => pick(m)}
                  className={`go-word flex min-h-[56px] cursor-pointer items-center justify-center rounded-m border-0 text-[17px] font-extrabold leading-[22px] tracking-[0.05em] focus-visible:shadow-focus focus-visible:outline-none ${TONE[m].chip}`}
                >{m}</button>
              ))}
            </div>}
            <p className="m-0 text-[15px] font-semibold leading-5 text-[var(--on-forest-2)]">{q.hint || "With everything going on, say it in your voice."}</p>
          </section>
        ) : (
          <section aria-label="Today’s question">
            <QuestionHero
              question={q.text}
              voices={voicesOf(q)}
              closesIn={closesIn(q.endsAt)}
              opensLabel={comingUp(q)}
              onShare={() => share("QUESTION", q.id, { notOpen: true })}
              speakLabel="Add your voice"
              onSpeak={() => router.push("/speak")}
              onListen={() => router.push(`/q/${q.id}`)}
              onDiscuss={() => router.push(`/q/${q.id}`)}
              onVote={() => router.push(`/q/${q.id}`)}
            />
          </section>
        )}
        {opens ? null : <Button size="l" variant="secondary" icon="headphones" block href={`/q/${q.id}`}>{signedIn ? "Listen to answers" : "Listen as a guest"}</Button>}
        <p className="m-0 flex items-center gap-2 text-[14px] font-medium leading-5 text-ink-2"><Icon name="lock" size={16} />Free to read, listen, like and share. Adults only (18+).</p>
      </div>
    );
  }

  return (
    <EntryFrame>
      {header}
      <EntryScroll>{body}</EntryScroll>
      {shareNode}
      {load.state === "loading" || (before && signedIn) ? null : (
      <div className="dt:hidden">
        <BottomBar>
          <div className={signedIn ? "grid grid-cols-1" : "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-[10px]"}>
            {signedIn ? null : <Button size="l" variant="secondary" block href="/sign-in">Sign in</Button>}
            {before ? <Button size="l" icon="mic" block href="/join">Join VOICES</Button> : <Button size="l" icon="mic" block href={addHref}>Add your voice</Button>}
          </div>
          {signedIn ? null : <p className="m-0 mx-auto text-center text-caption text-ink-2">When you join you accept the <Link href="/settings/legal/rules" className="link">Community rules</Link>, <Link href="/settings/legal/terms" className="link">Terms</Link> and <Link href="/settings/legal/privacy" className="link">Privacy</Link>.</p>}
        </BottomBar>
      </div>
      )}
    </EntryFrame>
  );
}
