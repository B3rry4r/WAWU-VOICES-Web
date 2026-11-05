"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { IconButton, Sheet, StageBar } from "@/components/vx";
import { getTodaysQuestion } from "@/lib/api/feed";
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

/** The page behind the sign-in and code sheets: today's question, dimmed, as the SignIn and Verify boards draw it. Never focusable. */
function Backdrop() {
  const load = useLoad(getTodaysQuestion, []);
  return (
    <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col" ref={(el) => el?.setAttribute("inert", "")}>
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
      <Sheet title={title} subtitle={subtitle} variant={desktop ? "dialog" : "sheet"} onClose={close}>
        {children}
      </Sheet>
    </EntryFrame>
  );
}
