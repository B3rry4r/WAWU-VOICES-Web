"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Icon, TopicChip } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { listCountries } from "@/lib/api/me";
import { readDraft, saveDraft } from "@/lib/auth/entry-draft";
import { BottomBar, DeskCard, DeskHeader, EntryFrame, EntryScroll, ErrorBanner, sendSignedIn } from "./ui";
import { isSignedIn } from "@/lib/api/auth";

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pcm", label: "Pidgin" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
];

const SYMBOL: Record<string, string> = { NGN: "₦" };

/** /join/country: where you speak from (Nigeria live, others coming) and which languages you speak. */
export function Country() {
  const router = useRouter();
  const load = useLoad(listCountries, []);
  const [code, setCode] = useState("NG");
  const [langs, setLangs] = useState<string[]>(["en", "pcm"]);
  useEffect(() => {
    // Signed in without a profile: straight on to finish it. With one: Home.
    if (isSignedIn()) {
      void sendSignedIn((p) => router.replace(p));
      return;
    }
    const d = readDraft();
    setCode(d.countryCode);
    setLangs(d.languages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = () => {
    saveDraft({ countryCode: code, languages: langs });
    router.push("/sign-in?mode=join");
  };
  const toggle = (c: string, on: boolean) => setLangs((l) => (on ? [...l, c] : l.filter((x) => x !== c)));

  let rows;
  if (load.state === "loading") rows = <div className="h-[60px] animate-pulse rounded-l bg-surface-2" aria-busy="true" />;
  else if (load.state === "error") rows = <ErrorBanner error={load.error} onRetry={load.retry} fallback="Something went wrong on our side. Try again in a moment." title="This did not load" />;
  else {
    rows = (
      <div role="radiogroup" aria-label="Country" className="flex flex-col gap-2">
        {load.data.items.map((c) => {
          const live = c.status === "live";
          const on = live && c.code === code;
          return (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={!live}
              onClick={() => live && setCode(c.code)}
              className={`flex min-h-[60px] w-full items-center gap-3 rounded-l px-4 text-left text-[17px] ${on ? "bg-mint shadow-[inset_0_0_0_2px_var(--green-text)]" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--line-strong)]"} ${live ? "cursor-pointer" : "cursor-default opacity-70"}`}
            >
              <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${on ? "bg-green text-ink" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]"}`}>{on ? <Icon name="check" size={16} strokeWidth={3} /> : null}</span>
              <span className="flex-1 font-semibold">{c.name}</span>
              {live ? <span className="text-[14px] text-ink-2">{`${c.currency === "NGN" ? "Naira" : c.currency} (${SYMBOL[c.currency] ?? c.currency})`}</span> : <Badge tone="neutral">Coming soon</Badge>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <EntryFrame>
      <header className="flex h-[107px] flex-none items-center gap-3 px-4 pt-[47px] dt:hidden">
        <div className="flex items-center gap-2">
          <Link href="/join" className="vx-iconbtn vx-iconbtn--s vx-iconbtn--ghost -ml-2 text-ink" aria-label="Back"><Icon name="arrow-left" size={24} /></Link>
          <span className="text-[16px] font-semibold leading-5 text-ink-2">Set up</span>
        </div>
      </header>
      <DeskHeader />
      <EntryScroll className="flex flex-col">
        <DeskCard>
          <span className="vx-eyebrow hidden text-green-text dt:block">Set up</span>
          <h1 className="m-0 font-display text-[28px] font-normal leading-8">Where are you speaking from?</h1>
          {rows}
          <p className="m-0 flex items-start gap-2 text-[15px] leading-[22px] text-ink-2"><Icon name="globe" size={18} className="mt-[2px] flex-none" />VOICES starts in Nigeria. Your country sets your questions, prices and polls.</p>
          <h2 className="m-0 mt-2 font-display text-[22px] font-normal leading-7">Which languages do you speak?</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Languages">
            {LANGUAGES.map((l) => <TopicChip key={l.code} label={l.label} selected={langs.includes(l.code)} onClick={(on) => toggle(l.code, on)} />)}
          </div>
          <p className="m-0 text-[15px] leading-[22px] text-ink-2">The app is in English. We use your languages to transcribe your voice and to find voices you understand.</p>
          <div className="hidden items-center gap-4 dt:flex">
            <Button size="l" disabled={load.state !== "ready" || langs.length === 0} onClick={go}>Continue</Button>
            <p className="m-0 text-[13px] font-medium leading-[18px] text-ink-2">You can change both later in Settings.</p>
          </div>
        </DeskCard>
      </EntryScroll>
      <div className="dt:hidden">
        <BottomBar>
          <Button size="l" block disabled={load.state !== "ready" || langs.length === 0} onClick={go}>Continue</Button>
          <p className="m-0 text-center text-[13px] font-medium leading-[18px] text-ink-2">You can change both later in Settings.</p>
        </BottomBar>
      </div>
    </EntryFrame>
  );
}
