"use client";
import { useRef, useState } from "react";
import { Banner, Composer } from "@/components/vx";
import type { IntentKind } from "@/components/vx";
import * as api from "@/lib/api/talk";
import type { Allowances, ReplyStance } from "@/lib/api/talk";
import { failText, isOutOfPosts, nairaOfMilli, saveTyped, typedDraft, unitsText, uuidKey } from "./lib";

const INTENT_OF: Record<string, IntentKind> = { AGREE: "agree", DISAGREE: "disagree", EXPERIENCE: "experience" };
const STANCE_OF: Record<IntentKind, ReplyStance> = { agree: "AGREE", disagree: "DISAGREE", experience: "EXPERIENCE" };

/** The reply box drawn inside the Thread at 1440. A reply spends a free post or units like an answer, so a 402 keeps the words in this browser
 *  and sends the person to buy units, then back here. */
export function ReplyComposer({ aid, qid, who, stance, allow, onPosted, onBuy }: {
  aid: string; qid: string; who: string; stance?: ReplyStance; allow: Allowances; onPosted: () => void; onBuy: (href: string) => void;
}) {
  const busy = useRef(false);
  const key = useRef<{ text: string; k: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const slot = `r:${aid}`;
  const [text, setText] = useState(() => typedDraft(slot));
  const [intent, setIntent] = useState<IntentKind | null>(stance ? INTENT_OF[stance] : null);
  const c = allow.costs;
  async function send() {
    if (busy.current) return;
    const body = text.trim();
    if (!body) return;
    const st = intent ? STANCE_OF[intent] : null;
    if (!st) return setMsg("Pick how you are replying: I agree, I disagree or My experience.");
    busy.current = true;
    setSending(true);
    setMsg(null);
    if (!key.current || key.current.text !== body) key.current = { text: body, k: uuidKey() };
    try {
      await api.createReply(aid, st, body, key.current.k);
      saveTyped(slot, "");
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
      <Composer
        freeLeft={allow.freePostsRemaining}
        maxChars={c.textMaxChars}
        value={text}
        onChange={(t) => { setText(t); saveTyped(slot, t); }}
        replyTo={who}
        intent={intent ?? undefined}
        onIntentChange={setIntent}
        cost={`${unitsText(c.textPostMilli)} (${nairaOfMilli(c.textPostMilli, c.baseKoboPerUnit)})`}
        costShort={unitsText(c.textPostMilli)}
        balance={unitsText(allow.balanceMilli)}
        onVoice={false}
        onSubmit={() => void send()}
      />
      {sending ? <Banner tone="info">Posting your reply.</Banner> : null}
      {msg ? <Banner tone="danger" title="This did not post" onClose={() => setMsg(null)}>{msg}</Banner> : null}
    </div>
  );
}
