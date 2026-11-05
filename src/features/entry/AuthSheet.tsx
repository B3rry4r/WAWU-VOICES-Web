"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChartNoAxesColumn, Compass, House, Mic, Search, User } from "lucide-react";
import { IconButton, QuestionHero, Sheet, StageBar, TrendingList } from "@/components/vx";
import { getTodaysQuestion, getTrendingQuestions } from "@/lib/api/feed";
import { trendItems } from "@/components/feed/trend";
import { closesIn } from "@/lib/feed-format";
import { useLoad } from "@/components/feed/useLoad";
import { EntryFrame } from "./ui";

/** True from 1024 px: the boards draw a centred dialog there and a bottom sheet on a phone. */
export function useDesktop(): boolean {
  const [d, setD] = useState(false);
  useEffect(() => {
    try {
      const m = window.matchMedia("(min-width: 1024px)");
      const set = () => setD(m.matches);
      set();
      m.addEventListener("change", set);
      return () => m.removeEventListener("change", set);
    } catch {
      return undefined;
    }
  }, []);
  return d;
}

/** From 1024 px the boards draw the dialog over Home with the shell: left nav, search row with Sign in, today's question and the Trending rail. Drawn from the real data, dimmed by the sheet's scrim, never focusable. */
function DeskBackdrop() {
  const load = useLoad(getTodaysQuestion, []);
  const trend = useLoad(() => getTrendingQuestions(3).then((r) => trendItems(r.items)), []);
  const q = load.state === "ready" ? load.data : null;
  return (
    <div aria-hidden="true" className="sh-root !min-h-0 min-h-0 flex-1 overflow-hidden" ref={(el) => el?.setAttribute("inert", "")} data-testid="desk-backdrop">
      <nav className="sh-desk sh-sidenav">
        <span className="sh-sidenav__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark-green.png" alt="" />
        </span>
        <span className="sh-tab" aria-current="page"><span className="sh-tab__ic"><House size={22} strokeWidth={2.4} /></span>Home</span>
        <span className="sh-tab"><span className="sh-tab__ic"><Compass size={22} /></span>Discover</span>
        <span className="sh-tab"><span className="sh-tab__ic"><ChartNoAxesColumn size={22} /></span>Weekly report</span>
        <span className="sh-tab"><span className="sh-tab__ic"><User size={22} /></span>Profile</span>
        <span className="sh-sidenav__speak"><Mic size={22} />Speak</span>
      </nav>
      <div className="sh-centre">
        <div className="sh-desk sh-deskbar">
          <div className="sh-search"><Search size={20} /><span>Search questions, voices and handles</span></div>
          <span className="sh-signin">Sign in</span>
        </div>
        <main className="sh-main">
          {q ? <QuestionHero question={q.text} voices={q.voiceCount} closesIn={closesIn(q.endsAt)} avatars={q.recentVoices.map((v) => v.handle)} speakLabel="Add your voice" /> : null}
        </main>
      </div>
      <aside className="sh-desk sh-rail">{trend.state === "ready" && trend.data.length ? <TrendingList items={trend.data} /> : null}</aside>
    </div>
  );
}

/** The page behind the sign-in and code sheets: today's question, dimmed, as the SignIn and Verify boards draw it. Never focusable. */
function Backdrop() {
  const load = useLoad(getTodaysQuestion, []);
  return (
    <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col dt:hidden" ref={(el) => el?.setAttribute("inert", "")}>
      <header className="flex flex-none items-center gap-2 px-4 h-[107px] pt-[47px]">
        <IconButton icon="arrow-left" label="Back" variant="ghost" size="s" />
        <span className="flex-1 text-[16px] font-semibold leading-5">Today&apos;s question</span>
        <IconButton icon="share-2" label="Share" variant="ghost" size="s" />
      </header>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-4">
        <StageBar current="speak" />
        {load.state === "ready" ? <p className="m-0 font-display text-[26px] font-normal leading-[30px]">{load.data.text}</p> : null}
      </div>
    </div>
  );
}

/** A sheet (phone) or dialog (desktop) over the dimmed question page. Closing goes back, or Home when there is no back. */
export function AuthSheet({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  const desktop = useDesktop();
  const close = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/welcome");
  };
  return (
    <EntryFrame>
      <Backdrop />
      {desktop ? <DeskBackdrop /> : null}
      <Sheet title={title} subtitle={subtitle} variant={desktop ? "dialog" : "sheet"} onClose={close}>
        {children}
      </Sheet>
    </EntryFrame>
  );
}
