"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Banner, Button, Composer, FreePosts, NotFoundState, Skeleton } from "@/components/vx";
import type { IntentKind } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import * as api from "@/lib/api/talk";
import type { Allowances, Answer, Question, ReplyStance } from "@/lib/api/talk";
import { clearDraft, saveDraft } from "@/features/units/draft";
import { StageNav } from "@/features/stage/StageNav";
import { countChars } from "@/lib/shared/text-price";
import { FixPanel } from "./FixPanel";
import { TagPicker, useIsEditor } from "@/features/news/TagPicker";
import { NO_TAG, tagFields, tagReady, type TagChoice } from "@/features/news/tag-choice";
import { MoodWordNote } from "@/features/mood/MoodChip";
import { pickHref, useMoodWord, writePick } from "@/features/mood/mood";
import { AppBar, Problem, failText, isOutOfPosts, nairaOfMilli, outOfPostsHref, postPrice, saveTyped, typedDraft, unitsText, useSignedIn, uuidKey, SignInNote } from "./lib";

const STANCE_OF: Record<IntentKind, ReplyStance> = { agree: "AGREE", disagree: "DISAGREE", experience: "EXPERIENCE" };
const INTENT_OF: Record<string, IntentKind> = { AGREE: "agree", DISAGREE: "disagree", EXPERIENCE: "experience" };

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
  const [text, setText] = useState("");
  const [tag, setTag] = useState<TagChoice>(NO_TAG);
  const editor = useIsEditor(!!signedIn);
  const [intent, setIntent] = useState<IntentKind | null>(stanceQ ? INTENT_OF[stanceQ] ?? null : null);
  const key = useRef<{ text: string; k: string } | null>(null);
  const slot = replyTo ? `r:${replyTo}` : `q:${qid}`;
  const [initial, setInitial] = useState<string | null>(null);
  // LCH-02: a mood question needs its one word before anything is written; without one the person is sent to pick it.
  const mood = useMoodWord(replyTo ? null : q);

  useEffect(() => {
    if (signedIn === null) return;
    setLoadErr(null);
    const jobs: Promise<unknown>[] = [api.getQuestion(qid).then(setQ)];
    if (replyTo) jobs.push(api.getAnswer(replyTo).then(setParent));
    if (signedIn) jobs.push(api.getAllowance().then(setAllow));
    Promise.all(jobs).then(() => { const d = typedDraft(slot); setText(d); setInitial(d); }, setLoadErr);
  }, [qid, replyTo, signedIn, slot, tries]);

  const close = replyTo ? `/q/${qid}/a/${replyTo}` : `/q/${qid}`;
  const header = <><AppBar title={replyTo ? "Your reply" : "Your answer"} sub="Today’s question" close={close} /></>;
  if (signedIn === false) {
    return <>{header}<div className="mt-4"><SignInNote from={`/q/${qid}/write${sp.toString() ? `?${sp.toString()}` : ""}`}>Reading and listening are free. Sign in to post your answer.</SignInNote></div></>;
  }
  if (loadErr) {
    const gone = loadErr instanceof ApiError && loadErr.status === 404;
    return <>{header}<div className="mt-4">{gone ? <NotFoundState /> : <Problem error={loadErr} onRetry={() => setTries((n) => n + 1)} />}</div></>;
  }
  if (!q || initial === null || (signedIn && !allow) || (!replyTo && !mood.ready)) return <>{header}<div className="mt-4 grid gap-3" aria-busy="true"><Skeleton variant="tile" /><Skeleton variant="answer" /></div></>;
  if (q.status !== "LIVE") return <>{header}<div className="mt-4"><Banner tone="info" title="This question has closed.">You can still read and listen to every voice.</Banner></div></>;

  const whoLabel = parent?.author ? `@${parent.author.handle}` : "Anonymous";
  const left = allow?.freePostsRemaining ?? 0;
  const c = allow?.costs;
  const price = allow ? postPrice(text, allow) : null;
  const voice30 = c ? unitsText(c.extraVoice30Kobo * 10) : "";
  const voiceNaira = c ? nairaOfMilli(c.extraVoice30Kobo * 10, c.baseKoboPerUnit) : "";
  const dayLeft = allow?.messagesLeftToday ?? null;
  const buyHref = `/units/buy?from=${encodeURIComponent(close)}`;

  async function send() {
    if (busy.current) return;
    const stance = intent ? STANCE_OF[intent] : null;
    const body = text.trim();
    if (!body) return;
    if (replyTo && !stance) { setMsg("Pick how you are replying: I agree, I disagree or My experience."); return; }
    // The held draft carries the post's Idempotency-Key (same text, same key), so a post after a purchase is the same post.
    const held = replyTo ? undefined : saveDraft(qid, body);
    if (!key.current || key.current.text !== body) key.current = { text: body, k: held ? held.key : uuidKey() };
    busy.current = true;
    setSending(true);
    setMsg(null);
    try {
      if (replyTo) {
        await api.createReply(replyTo, stance!, body, key.current.k);
        saveTyped(slot, "");
        router.push(`/q/${qid}/a/${replyTo}`);
      } else {
        // V-FIX-B (addendum 1): a post carries a tag the person chose; the button waits for one.
        if (!tagReady(tag)) { busy.current = false; setSending(false); setMsg("Choose a tag before you post."); return; }
        const r = await api.createAnswer(qid, body, tagFields(tag), key.current.k, mood.word);
        saveTyped(slot, "");
        clearDraft(qid);
        writePick(qid, null);
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
        router.push(outOfPostsHref(qid));
        return;
      }
      setMsg(failText(e));
    }
  }

  return (
    <>
      {header}
      <div className="hidden dt:block"><StageNav questionId={qid} active="speak" /></div>
      <div className="mt-4 grid gap-4 dt:max-w-[640px]">
        {replyTo ? (
          <p className="m-0 text-body text-[var(--ink-2)]">{`Replying to ${whoLabel}: ${parent?.body ?? "a voice"}`.slice(0, 160)}</p>
        ) : (
          <div>
            <span className="vx-eyebrow text-[var(--green-text)]">Answering</span>
            <h1 className="m-0 mt-1 font-display text-display-l">{q.text}</h1>
            {q.hint ? <p className="m-0 mt-2 text-body text-[var(--ink-2)]">{q.hint}</p> : null}
            {mood.word ? <div className="mt-3"><MoodWordNote mood={mood.word} changeHref={pickHref(qid)} /></div> : null}
          </div>
        )}
        <div>
          <Composer
            freeLeft={left}
            maxChars={c?.textMaxChars}
            countChars={countChars}
            value={text}
            onChange={(t) => { setText(t); saveTyped(slot, t); }}
            replyTo={replyTo ? whoLabel : undefined}
            intent={intent ?? undefined}
            onIntentChange={setIntent}
            showTags={!replyTo}
            tagSlot={<TagPicker value={tag} onChange={setTag} editor={editor} />}
            cost={price?.text}
            costShort={price?.short}
            postLabel={price?.label}
            paid={price?.paid}
            postDisabled={dayLeft === 0 || (!replyTo && !tagReady(tag))}
            extra={signedIn && c ? <FixPanel text={text} costMilli={c.textFixMilli ?? 5000} buyHref={buyHref} onUse={(fixed) => { setText(fixed); saveTyped(slot, fixed); }} /> : undefined}
            balance={allow ? unitsText(allow.balanceMilli) : undefined}
            onVoice={false}
            onSubmit={() => void send()}
          />
        </div>
        {dayLeft === 0 ? <Banner tone="info" title="You have reached the daily limit">{`You can send ${c?.messagesPerDay ?? 20} messages a day. Come back after midnight, Lagos time. Reading, listening, likes, shares and reactions never count.`}</Banner> : null}
        {sending ? <Banner tone="info">Posting your answer.</Banner> : null}
        {msg ? <Banner tone="danger" title="This did not post" onClose={() => setMsg(null)}>{msg}</Banner> : null}
        {left === 1 && c ? (
          <Banner tone="warning" title="Last free post">{`This post is free if it is up to ${c.freePostTextChars ?? 500} characters. After it, text costs ${unitsText(c.textPostMilli)} for every ${c.textPriceChars ?? 150} characters and a voice message up to ${c.voiceTier1Seconds ?? 30} seconds costs ${voice30} (${voiceNaira}).`}</Banner>
        ) : null}
        <div className="hidden rounded-[var(--radius-l)] bg-[var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--line)] dt:block">
          <b className="mb-2 block">Your free posts</b>
          <FreePosts left={left} />
          {c ? <p className="m-0 mt-2 text-caption text-[var(--ink-2)]">{`Text and voice both count, and deleting a post does not give one back. After your free posts, text costs ${unitsText(c.textPostMilli)} for every ${c.textPriceChars ?? 150} characters and a voice message up to ${c.voiceTier1Seconds ?? 30} seconds costs ${voice30} (${voiceNaira}).`}</p> : null}
        </div>
        <p className="m-0 mx-auto text-center text-caption text-[var(--ink-2)]">Reading, listening, liking and sharing are always free.</p>
      </div>
    </>
  );
}
