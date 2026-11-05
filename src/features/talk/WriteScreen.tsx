"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Banner, Button, Composer, EmptyState, FreePosts, Skeleton } from "@/components/vx";
import type { IntentKind } from "@/components/vx/speak";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, Question, ReplyStance } from "@/lib/api/talk";
import { AppBar, Problem, ShellTweaks, failText, heldDraft, holdDraft, isOutOfPosts, nairaOfMilli, outOfPostsHref, saveTyped, typedDraft, unitsText, useSignedIn, uuidKey, SignInNote, dropHeld } from "./lib";

const STANCE_OF: Record<IntentKind, ReplyStance> = { agree: "AGREE", disagree: "DISAGREE", experience: "EXPERIENCE" };
const INTENT_OF: Record<string, IntentKind> = { AGREE: "agree", DISAGREE: "disagree", EXPERIENCE: "experience" };

/** Reads what the design system's Composer holds (it is uncontrolled): the words, the news tag, the reply stance. */
export function readComposer(root: HTMLElement | null): { text: string; tag: "none" | "unverified" | "gossip" | null; stance: ReplyStance | null } {
  const ta = root?.querySelector("textarea");
  const on = root?.querySelector(".vx-tagpick .vx-chip[aria-pressed='true']");
  const tag = !on ? null : on.classList.contains("is-unverified") ? "unverified" : on.classList.contains("is-gossip") ? "gossip" : "none";
  const chips = Array.from(root?.querySelectorAll(".vx-intent .vx-chip") ?? []);
  const i = chips.findIndex((c) => c.getAttribute("aria-pressed") === "true");
  return { text: ta?.value ?? "", tag, stance: i < 0 ? null : (["AGREE", "DISAGREE", "EXPERIENCE"] as const)[i] };
}

export function WriteScreen({ qid }: { qid: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const replyTo = sp.get("reply");
  const stanceQ = sp.get("stance");
  const signedIn = useSignedIn();
  const [q, setQ] = useState<Question | null>(null);
  const [parent, setParent] = useState<Answer | null>(null);
  const [allow, setAllow] = useState<Allowances | null>(null);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const key = useRef<{ text: string; k: string } | null>(null);
  const slot = replyTo ? `r:${replyTo}` : `q:${qid}`;
  const [initial, setInitial] = useState<string | null>(null);

  useEffect(() => {
    if (signedIn === null) return;
    setLoadErr(null);
    const jobs: Promise<unknown>[] = [api.getQuestion(qid).then(setQ)];
    if (replyTo) jobs.push(api.getAnswer(replyTo).then(setParent));
    if (signedIn) jobs.push(api.getAllowance().then(setAllow));
    Promise.all(jobs).then(() => setInitial(typedDraft(slot)), setLoadErr);
  }, [qid, replyTo, signedIn, slot, tries]);

  const close = replyTo ? `/q/${qid}/a/${replyTo}` : `/q/${qid}`;
  const header = <><ShellTweaks tabBar={false} /><AppBar title={replyTo ? "Your reply" : "Your answer"} sub="Today’s question" close={close} /></>;
  if (signedIn === false) {
    return <>{header}<div className="mt-4"><SignInNote>Reading and listening are free. Sign in to post your answer.</SignInNote></div></>;
  }
  if (loadErr) {
    const gone = loadErr instanceof ApiError && loadErr.status === 404;
    return <>{header}<div className="mt-4">{gone ? <EmptyState icon="message-square" title="We could not find this question" body="It may have been removed, or the link is wrong." /> : <Problem error={loadErr} onRetry={() => setTries((n) => n + 1)} />}</div></>;
  }
  if (!q || initial === null || (signedIn && !allow)) return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="tile" /><Skeleton variant="answer" /></div></>;
  if (q.status !== "LIVE") return <>{header}<div className="mt-4"><Banner tone="info" title="This question has closed.">You can still read and listen to every voice.</Banner></div></>;

  const whoLabel = parent?.author ? `@${parent.author.handle}` : "Anonymous";
  const left = allow?.freePostsRemaining ?? 0;
  const c = allow?.costs;
  const nairaText = c ? nairaOfMilli(c.textPostMilli, c.baseKoboPerUnit) : "";
  const voiceNaira = c ? nairaOfMilli(c.voicePostMilli, c.baseKoboPerUnit) : "";
  const textCost = c ? `${unitsText(c.textPostMilli)} (${nairaText})` : undefined;

  async function send() {
    if (busy.current) return;
    const { text, tag, stance } = readComposer(root.current);
    const body = text.trim();
    if (!body) return;
    if (replyTo && !stance) { setMsg("Pick how you are replying: I agree, I disagree or My experience."); return; }
    // A held draft (a post that was refused for units) keeps ITS key: the post after a purchase is the same post.
    const held = replyTo ? undefined : heldDraft(qid);
    if (!key.current || key.current.text !== body) key.current = { text: body, k: held && held.body === body ? held.key : uuidKey() };
    busy.current = true;
    setSending(true);
    setMsg(null);
    try {
      if (replyTo) {
        await api.createReply(replyTo, stance!, body, key.current.k);
        saveTyped(slot, "");
        router.push(`/q/${qid}/a/${replyTo}`);
      } else {
        const r = await api.createAnswer(qid, body, { isNews: tag === "unverified" || tag === "gossip", newsTag: tag === "unverified" ? "UNVERIFIED_NEWS" : tag === "gossip" ? "GOSSIP" : undefined }, key.current.k);
        saveTyped(slot, "");
        dropHeld(qid);
        router.push(`/q/${qid}/posted?a=${r.answer.id}`);
      }
    } catch (e) {
      busy.current = false;
      setSending(false);
      if (isOutOfPosts(e)) {
        saveTyped(slot, body);
        if (replyTo) {
          router.push(`/units/buy?from=${encodeURIComponent(close)}`);
          return;
        }
        holdDraft(qid, body, key.current.k);
        router.push(outOfPostsHref(qid));
        return;
      }
      setMsg(failText(e));
    }
  }

  return (
    <>
      {header}
      <div className="mt-4 grid gap-4 dt:max-w-[640px]">
        {replyTo ? (
          <p className="m-0 text-[15px] text-[var(--ink-2)]">{`Replying to ${whoLabel}: ${parent?.body ?? "a voice"}`.slice(0, 160)}</p>
        ) : (
          <div>
            <span className="vx-eyebrow text-[var(--green-text)]">Answering</span>
            <h1 className="m-0 mt-1 font-display text-[26px] font-normal leading-[32px]">{q.text}</h1>
            {q.hint ? <p className="m-0 mt-2 text-[15px] leading-5 text-[var(--ink-2)]">{q.hint}</p> : null}
          </div>
        )}
        <div ref={root} onInputCapture={(e) => { if ((e.target as HTMLElement).tagName === "TEXTAREA") saveTyped(slot, (e.target as HTMLTextAreaElement).value); }}>
          <Composer
            freeLeft={left}
            maxLength={c?.textMaxChars}
            defaultValue={initial}
            replyTo={replyTo ? whoLabel : undefined}
            intent={stanceQ ? INTENT_OF[stanceQ] : undefined}
            showTags={!replyTo}
            newsTag="none"
            cost={textCost}
            costShort={c ? unitsText(c.textPostMilli) : undefined}
            balance={allow ? unitsText(allow.balanceMilli) : undefined}
            onVoice={false}
            onSend={send}
          />
        </div>
        {sending ? <Banner tone="info">Posting your answer.</Banner> : null}
        {msg ? <Banner tone="danger" title="This did not post" onClose={() => setMsg(null)}>{msg}</Banner> : null}
        {left === 1 && c ? (
          <Banner tone="warning" title="Last free post">{`This post is free. After it, a text post uses ${unitsText(c.textPostMilli)} (${nairaText}) and a voice uses ${unitsText(c.voicePostMilli)} (${voiceNaira}).`}</Banner>
        ) : null}
        <div className="hidden rounded-[var(--radius-l)] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line)] dt:block">
          <b className="mb-2 block">Your free posts</b>
          <FreePosts left={left} />
          {c ? <p className="m-0 mt-2 text-[14px] leading-5 text-[var(--ink-2)]">{`Text and voice both count, and deleting a post does not give one back. After your free posts, a text post uses ${unitsText(c.textPostMilli)} (${nairaText}) and a voice up to ${allow?.maxVoiceSeconds ?? 10} seconds uses ${unitsText(c.voicePostMilli)} (${voiceNaira}).`}</p> : null}
        </div>
        <p className="m-0 text-center text-[13px] text-[var(--ink-2)]">Reading, listening, liking and sharing are always free.</p>
      </div>
    </>
  );
}
