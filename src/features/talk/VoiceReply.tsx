"use client";
import { useState } from "react";
import { Button, Sheet, TopicChip } from "@/components/vx";
import { VoiceBox } from "@/features/speak/VoiceBox";
import { freeCovers, tokenFor, voicePriceMilli } from "@/features/speak/logic";
import * as api from "@/lib/api/talk";
import type { Allowances, ReplyStance } from "@/lib/api/talk";
import { tokensLabel } from "@/lib/shared/text-price";
import { isOutOfPosts } from "./lib";

const STANCES: { id: ReplyStance; label: string }[] = [
  { id: "AGREE", label: "I agree" },
  { id: "DISAGREE", label: "I disagree" },
  { id: "EXPERIENCE", label: "My experience" },
];

/** Reply by voice: the same recorder and upload as an answer, posted to POST /answers/{id}/replies with kind VOICE.
 *  A voice reply spends a free post or tokens like a voice answer; the server decides, and the button shows the same price. */
export function VoiceReplySheet({ aid, who, stance, allow, onClose, onPosted, onBuy }: {
  aid: string; who: string; stance?: ReplyStance; allow: Allowances; onClose: () => void; onPosted: () => void; onBuy: () => void;
}) {
  const [pick, setPick] = useState<ReplyStance | undefined>(stance);
  const [short, setShort] = useState(false);
  const c = allow.costs;
  const limit = allow.maxVoiceSeconds ?? c.voiceMaxSeconds ?? 60;
  const freeSeconds = c.freeVoiceSeconds ?? 60;
  return (
    <Sheet title="Reply by voice" subtitle={`To ${who}`} onClose={onClose}>
      <div className="grid gap-3 pb-2">
        <div className="flex min-w-0 max-w-full flex-wrap gap-2" role="group" aria-label="How are you replying?">
          {STANCES.map((s) => <TopicChip key={s.id} label={s.label} selected={pick === s.id} onClick={() => setPick(pick === s.id ? undefined : s.id)} />)}
        </div>
        <VoiceBox
          purpose="REPLY"
          maxSeconds={limit}
          freeSeconds={freeSeconds}
          freeLeft={allow.freePostsRemaining}
          tokens={allow.extraVoiceTokens}
          disabled={!pick || allow.messagesLeftToday === 0}
          hint={<p className="vx-rec__hint">{!pick ? <b>Pick how you are replying first.</b> : <>{"Tap to record. You have "}<b>{`${limit} seconds`}</b>{"."}</>}</p>}
          sendLabel={(sec) => ((allow.freePostsRemaining > 0 && freeCovers(sec, freeSeconds)) || tokenFor(allow.extraVoiceTokens, sec, freeSeconds, allow.freePostsRemaining) ? "Send" : `Send for ${tokensLabel(voicePriceMilli(sec, c))} tokens`)}
          onSend={async (clip) => {
            if (!pick) return;
            setShort(false);
            await api.createVoiceReply(aid, pick, clip.clipId, clip.key, clip.tokenId);
            onPosted();
          }}
          errorText={(e) => {
            if (isOutOfPosts(e)) { setShort(true); return "You have no free posts left and not enough tokens for this voice reply."; }
            return null;
          }}
          extra={short ? <Button variant="onforest" size="l" block onClick={onBuy}>Get tokens</Button> : null}
          onCancel={onClose}
        />
      </div>
    </Sheet>
  );
}
