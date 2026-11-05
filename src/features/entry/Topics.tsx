"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Icon, TopicChip, type IconName } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { getCategories } from "@/lib/api/feed";
import { readDraft, saveDraft } from "@/lib/auth/entry-draft";
import { BottomBar, EntryFrame, EntryScroll, ErrorBanner, StepHeader, Switch, useNeedSession } from "./ui";

export const MIN_TOPICS = 3;

const ICONS: Record<string, IconName> = { money: "coins", work: "clipboard-list", power: "lightbulb", family: "heart", love: "heart", faith: "sun", roads: "map-pin", politics: "vote", elections: "vote", health: "heart", security: "shield-check" };

/** /join/topics (step 1 of 2): at least 3 topics and an alerts switch for each. They are held here and saved with the profile (PUT /me/categories needs the profile to exist first). */
export function Topics() {
  const router = useRouter();
  const ok = useNeedSession();
  const load = useLoad(getCategories, []);
  const [chosen, setChosen] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const t = readDraft().topics ?? [];
    setChosen(t.map((x) => x.categoryId));
    setAlerts(Object.fromEntries(t.map((x) => [x.categoryId, x.alertsOn])));
  }, []);
  if (!ok) return null;
  const cats = load.state === "ready" ? load.data.items : [];
  const have = chosen.filter((id) => cats.some((c) => c.id === id));
  const enough = have.length >= MIN_TOPICS;
  const toggle = (id: string, on: boolean) => setChosen((c) => (on ? [...c.filter((x) => x !== id), id] : c.filter((x) => x !== id)));
  const next = () => {
    saveDraft({ topics: have.map((categoryId) => ({ categoryId, alertsOn: alerts[categoryId] ?? true })) });
    router.push("/join/profile");
  };
  const label = enough ? `Continue with ${have.length} topics` : `Pick ${MIN_TOPICS - have.length} more`;
  return (
    <EntryFrame>
      <StepHeader step={1} back="/join/verify" />
      <EntryScroll>
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[18px] px-4 pb-6 pt-1">
          <section aria-labelledby="h-topics" className="flex flex-col gap-3">
            <h1 id="h-topics" className="m-0 font-display text-[28px] font-normal leading-8">What do you want to talk about?</h1>
            <p className="m-0 text-[16px] leading-6 text-ink-2">Pick at least 3. We use them to fill your Home. Today&apos;s question shows for everyone.</p>
            {load.state === "error" ? <ErrorBanner error={load.error} onRetry={load.retry} fallback="Something went wrong on our side. Try again in a moment." title="This did not load" /> : null}
            {load.state === "loading" ? <div className="h-[200px] animate-pulse rounded-l bg-surface-2" aria-busy="true" /> : null}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
              {cats.map((c) => <TopicChip key={c.id} label={c.name} selected={chosen.includes(c.id)} onClick={(on) => toggle(c.id, on)} />)}
            </div>
          </section>
          {have.length ? (
            <section aria-labelledby="h-alerts" className="mt-2 flex flex-col gap-[10px]">
              <div className="flex flex-col gap-[2px]">
                <h2 id="h-alerts" className="m-0 font-display text-[22px] font-normal leading-[27px]">Category alerts</h2>
                <p className="m-0 text-[15px] leading-[22px] text-ink-2">Get told when a new question lands in a topic you picked.</p>
              </div>
              <div className="vx-notes">
                {cats.filter((c) => have.includes(c.id)).map((c, n) => (
                  <label key={c.id} className={`flex min-h-[56px] cursor-pointer items-center gap-3 px-4 ${n ? "shadow-[0_-1px_0_var(--line)]" : ""}`}>
                    <Icon name={ICONS[c.slug] ?? "message-square"} size={20} />
                    <span className="flex-1 text-[16px] font-semibold leading-[22px]">{c.name}</span>
                    <Switch checked={alerts[c.id] ?? true} label={`Alerts for ${c.name}`} onChange={(on) => setAlerts({ ...alerts, [c.id]: on })} />
                  </label>
                ))}
              </div>
              <p className="m-0 text-[13px] font-medium leading-[18px] text-ink-2">Change or turn off alerts any time in Settings.</p>
            </section>
          ) : null}
          <div className="hidden dt:block"><Button size="l" disabled={!enough} onClick={next}>{label}</Button></div>
        </div>
      </EntryScroll>
      <div className="dt:hidden"><BottomBar><Button size="l" block disabled={!enough} onClick={next}>{label}</Button></BottomBar></div>
    </EntryFrame>
  );
}
