"use client";
import { useRef, useState } from "react";
import { Banner, Composer } from "@/components/vx";
import type { IntentKind } from "@/components/vx";
import * as api from "@/lib/api/talk";
import type { Allowances, ReplyStance } from "@/lib/api/talk";
import { countChars } from "@/lib/shared/text-price";
import { AnonymousSwitch } from "./AnonymousSwitch";
import { useReplyAnon } from "./reply-anon";
import { failText, isOutOfPosts, postPrice, saveTyped, typedDraft, unitsText, uuidKey } from "./lib";

const INTENT_OF: Record<string, IntentKind> = { AGREE: "agree", DISAGREE: "disagree", EXPERIENCE: "experience" };
const STANCE_OF: Record<IntentKind, ReplyStance> = { agree: "AGREE", disagree: "DISAGREE", experience: "EXPERIENCE" };

/** The reply box drawn inside the Thread at 1440. A reply spends a free post or tokens like an answer, so a 402 keeps the words in this browser
 *  and sends the person to buy tokens, then back here. */
export function ReplyComposer({ aid, qid, who, stance, allow, onPosted, onBuy, onVoice }: {
  aid: string; qid: string; who: string; stance?: ReplyStance; allow: Allowances; onPosted: () => void; onBuy: (href: string) => void;
  /** Opens the voice reply (the same recorder as an answer). */
  onVoice?: () => void;
}) {
  const busy = useRef(false);
  const key = useRef<{ text: string; anon: boolean; st: ReplyStance; k: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const slot = `r:${aid}`;
  // V-FIX-D: "Post without my name". send() reads anon.ref at the moment it sends, never a value captured when an earlier try began.
  const anon = useReplyAnon(aid);
  const [text, setText] = useState(() => typedDraft(slot));
  const [intent, setIntent] = useState<IntentKind | null>(stance ? INTENT_OF[stance] : null);
  const c = allow.costs;
  const price = postPrice(text, allow);
  async function send() {
    if (busy.current) return;
    const body = text.trim();
    if (!body) return;
    const st = intent ? STANCE_OF[intent] : null;
    if (!st) return setMsg("Pick how you are replying: I agree, I disagree or My experience.");
    busy.current = true;
    setSending(true);
    setMsg(null);
    // The Idempotency-Key belongs to the exact body: the words, the stance and the switch. Flip the switch and it is a new request.
    const anonNow = anon.ref.current;
    if (!key.current || key.current.text !== body || key.current.anon !== anonNow || key.current.st !== st) key.current = { text: body, anon: anonNow, st, k: uuidKey() };
    try {
      await api.createReply(aid, st, body, key.current.k, anonNow);
      saveTyped(slot, "");
      anon.clear();
      key.current = null;
      setText("");
      setIntent(stance ? INTENT_OF[stance] : null);
      onPosted();
    } catch (e) {
      if (isOutOfPosts(e)) { saveTyped(slot, body); onBuy(`/units/buy?from=${encodeURIComponent(`/q/${qid}/a/${aid}`)}`); return; }
      setMsg(failText(e));
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <div className="grid gap-2">
      <AnonymousSwitch on={anon.on} disabled={sending} onChange={anon.set} />
      <Composer
        freeLeft={allow.freePostsRemaining}
        maxChars={c.textMaxChars}
        countChars={countChars}
        value={text}
        onChange={(t) => { setText(t); saveTyped(slot, t); }}
        replyTo={who}
        intent={intent ?? undefined}
        onIntentChange={setIntent}
        cost={price.text}
        costShort={price.short}
        postLabel={price.label}
        paid={price.paid}
        postDisabled={allow.messagesLeftToday === 0}
        balance={unitsText(allow.balanceMilli)}
        onVoice={onVoice ?? false}
        onSubmit={() => void send()}
      />
      {sending ? <Banner tone="info">Posting your reply.</Banner> : null}
      {msg ? <Banner tone="danger" title="This did not post" onClose={() => setMsg(null)}>{msg}</Banner> : null}
    </div>
  );
}
