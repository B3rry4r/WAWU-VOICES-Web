"use client";

import { useEffect, useState } from "react";
import { Button, Sheet } from "@/components/vx";
import { getTiers, getWallet } from "@/lib/api/units";
import { getDraft, setAwaiting } from "./draft";
import { naira, nairaOfUnits, smallestPack, units, unitsLabel } from "./format";
import { useDesktop, useLoad, useSignedIn } from "./hooks";
import { ErrorBlock, LoadingBlock, SignInNeeded } from "./ui";

/** "Out of free posts" (V-19). The Write screen opens this on a 402 FREE_POSTS_EXHAUSTED or INSUFFICIENT_UNITS, after saving the
 *  draft with saveDraft(). The draft stays in this browser and posts after a purchase; "Get Voice Units" marks it as waiting. */
export function OutOfPostsSheet({ questionId, onKeep, variant: forced }: { questionId: string; onKeep: () => void; variant?: "sheet" | "dialog" }) {
  const signedIn = useSignedIn();
  const desktop = useDesktop();
  const variant = forced ?? (desktop ? "dialog" : "sheet");
  const { result, reload } = useLoad(() => Promise.all([getWallet(), getTiers()]), signedIn === true);
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(getDraft(questionId)?.body ?? null), [questionId]);

  if (signedIn === false) {
    return <Sheet title="Voice Units" variant={variant} onClose={onKeep}><SignInNeeded /></Sheet>;
  }
  if (signedIn === null || result.state === "loading") {
    return (
      <Sheet title="Voice Units" variant={variant} onClose={onKeep}>
        <LoadingBlock rows={1} />
      </Sheet>
    );
  }
  if (result.state === "error") {
    return (
      <Sheet title="Voice Units" variant={variant} onClose={onKeep}>
        <ErrorBlock error={result.error} onRetry={reload} />
      </Sheet>
    );
  }
  const [wallet, tiers] = result.data;
  const min = smallestPack(tiers.tiers);
  const total = wallet.freePostsRemaining + wallet.freePostsUsed;
  const c = wallet.costs;
  const href = `/units/buy?from=${encodeURIComponent(`/q/${questionId}`)}`;

  return (
    <Sheet
      title={`You have used your ${total} free posts`}
      subtitle={`Balance: ${unitsLabel(wallet.balanceMilli)}`}
      variant={variant}
      onClose={onKeep}
      footer={
        <div className="vx-sheet__foot">
          <Button size="l" block icon="coins" href={href} onClick={() => setAwaiting(questionId, true)}>
            {min ? `Get Voice Units from ${naira(min.priceKobo)}` : "Get Voice Units"}
          </Button>
          <Button size="l" block variant="secondary" onClick={onKeep}>
            Keep my draft for later
          </Button>
          <p className="vx-sheet__fine">Reading, listening, liking and sharing are always free.</p>
        </div>
      }
    >
      {draft ? (
        <div className="flex flex-col gap-1 rounded-m bg-surface-2 p-4">
          <span className="vx-eyebrow text-green-text">Your draft is saved</span>
          <p className="m-0 whitespace-pre-wrap break-words text-[16px] leading-6">{draft}</p>
        </div>
      ) : null}
      <p className="m-0 text-[16px] leading-6 text-ink-2">
        To post it, get Voice Units. A text post uses {unitsLabel(c.textPostMilli)} ({nairaOfUnits(c.textPostMilli, c.baseKoboPerUnit)}).
        {min ? ` The smallest pack is ${units(min.unitsMilli)} units for ${naira(min.priceKobo)}.` : ""}
      </p>
    </Sheet>
  );
}
