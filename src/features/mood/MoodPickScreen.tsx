"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner, Button, Icon, NotFoundState, Skeleton } from "@/components/vx";
import * as api from "@/lib/api/talk";
import { getPublicConfig } from "@/lib/api/feed";
import { ApiError } from "@/lib/api/client";
import type { Mood } from "@/lib/api/mood";
import { AppBar, Problem, useSignedIn } from "@/features/talk/lib";
import { getSettings, updateSettings } from "@/lib/api/profile";
import { MOODS, TONE, isMood, readPick, writePick } from "./mood";
import { ShareWordSwitch } from "./ShareWordSwitch";
import { readPendingShareWord, writePendingShareWord } from "./share-word";

/** MoodPick board: before Record or Write on a mood question, pick one word. It can be changed until the answer is posted. */
export function MoodPickScreen({ qid }: { qid: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const signedIn = useSignedIn();
  const [q, setQ] = useState<api.Question | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [tries, setTries] = useState(0);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [word, setWord] = useState<Mood | null>(null);
  const [hint, setHint] = useState(false);
  // LCH-06: "Share my word", on by default. Signed in it is saved at once; before that it waits in this browser.
  const [shareWord, setShareWord] = useState(true);
  const [shareBusy, setShareBusy] = useState(false);
  useEffect(() => {
    if (signedIn === null) return undefined;
    if (!signedIn) { setShareWord(readPendingShareWord() ?? true); return undefined; }
    let live = true;
    getSettings().then((s) => { if (live) setShareWord(s.shareMyWord); }, () => undefined);
    return () => { live = false; };
  }, [signedIn]);
  async function changeShareWord(v: boolean) {
    const before = shareWord;
    setShareWord(v);
    if (!signedIn) { writePendingShareWord(v); return; }
    setShareBusy(true);
    try { await updateSettings({ shareMyWord: v }); } catch { setShareWord(before); } finally { setShareBusy(false); }
  }

  useEffect(() => {
    setErr(null);
    api.getQuestion(qid).then(setQ, setErr);
  }, [qid, tries, signedIn]);
  useEffect(() => { getPublicConfig().then((c) => setSeconds(c.voiceFreeSeconds), () => undefined); }, []);
  useEffect(() => {
    const asked = sp?.get("mood") ?? null;
    setWord(isMood(asked) ? asked : readPick(qid));
  }, [qid, sp]);

  const close = `/q/${qid}`;
  const header = <AppBar title="Speak" sub="Today’s question" close={close} />;
  if (err) {
    const gone = err instanceof ApiError && err.status === 404;
    return <>{header}<div className="mt-4">{gone ? <NotFoundState /> : <Problem error={err} onRetry={() => setTries((n) => n + 1)} />}</div></>;
  }
  if (!q) return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="tile" /></div></>;
  if (q.status !== "LIVE") return <>{header}<div className="mt-4"><Banner tone="info" title="This question has closed.">You can still read and listen to every voice.</Banner></div></>;

  const words = (q.moodOptions?.length ? q.moodOptions : MOODS) as Mood[];
  const go = (to: "speak" | "write") => {
    if (!word) { setHint(true); return; }
    writePick(qid, word);
    router.push(`/q/${qid}/${to}?mood=${word}`);
  };
  return (
    <>
      {header}
      <div className="mt-5 grid gap-5 dt:max-w-[640px]">
        <section className="flex flex-col gap-2">
          <span className="vx-eyebrow text-[var(--green-text)]">Nigeria’s national conversation</span>
          <h1 className="m-0 font-display text-display-l [text-wrap:balance]">{q.text}</h1>
          {q.hint ? <p className="m-0 text-body-l text-[var(--ink-2)]">{q.hint}</p> : null}
        </section>
        <section aria-labelledby="pick-h" className="flex flex-col gap-[10px]">
          <h2 id="pick-h" className="m-0 text-[14px] font-bold leading-[18px] text-[var(--ink-2)]">Pick one word</h2>
          <div role="group" aria-labelledby="pick-h" className="grid grid-cols-2 gap-[10px]">
            {words.map((m) => {
              const on = m === word;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  data-testid={`mood-${m}`}
                  onClick={() => { setWord(m); setHint(false); writePick(qid, m); }}
                  className={`min-h-[72px] cursor-pointer rounded-[var(--radius-l)] border-0 p-4 text-left focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none ${TONE[m].chip} ${on ? TONE[m].pressed : ""}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[22px] font-extrabold leading-7 tracking-[0.04em]">{m}</span>
                    {on ? <Icon name="circle-check" size={24} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={`m-0 text-[13px] font-medium leading-[18px] ${hint ? "text-[var(--danger)]" : "text-[var(--ink-2)]"}`} role={hint ? "alert" : undefined}>
            {hint ? "Pick one word first." : "Your word shows beside your answer. You can change it until you post."}
          </p>
        </section>
        <section className="flex flex-col gap-[10px]">
          <Button size="l" icon="mic" block onClick={() => go("speak")}>{seconds ? `Say it in ${seconds} seconds` : "Say it"}</Button>
          <Button size="l" variant="secondary" icon="message-square" block onClick={() => go("write")}>Type it instead</Button>
        </section>
        <ShareWordSwitch on={shareWord} busy={shareBusy} onChange={(v) => void changeShareWord(v)} />
      </div>
    </>
  );
}
