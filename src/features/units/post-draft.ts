import { ApiError, NetworkError } from "@/lib/api/client";
import { postHeldAnswer } from "@/lib/api/units";
import { AUTO_POST_MAX_AGE_MS, findPostedFor, getRecord, markPosted, setAwaiting } from "./draft";

export type DraftOutcome =
  | { status: "none" }
  | { status: "posted"; questionId: string }
  | { status: "offer"; questionId: string }
  | { status: "kept"; questionId: string; message: string }
  | { status: "retry"; questionId: string };

/** After a Voice Units purchase succeeds: post THE draft this purchase was made for, once.
 *  - No draft id (a token purchase, a refresh of an old page whose attempt is gone): nothing is posted.
 *  - A draft that already posted for this payment (another tab won): reported as posted, never posted twice.
 *  - A draft older than 24 hours is only offered (`force` posts it when the person taps the offer).
 *  - A refusal keeps the draft (and stops waiting); a lost connection keeps it waiting so the next try posts it. */
export async function postDraftForPurchase(
  questionId: string | undefined,
  paymentId: string,
  opts: { force?: boolean; now?: number; post?: typeof postHeldAnswer } = {},
): Promise<DraftOutcome> {
  if (!questionId) {
    const was = findPostedFor(paymentId); // this browser already posted the draft for this payment (another tab won)
    return was ? { status: "posted", questionId: was } : { status: "none" };
  }
  const d = getRecord(questionId);
  if (!d) return { status: "none" };
  if (d.posted === paymentId) return { status: "posted", questionId };
  if (d.posted || (!d.awaitingUnits && !opts.force)) return { status: "none" };
  if (!opts.force && (opts.now ?? Date.now()) - d.savedAt > AUTO_POST_MAX_AGE_MS) return { status: "offer", questionId };
  const post = opts.post ?? postHeldAnswer;
  try {
    await post(d.questionId, d.body, d.key);
    markPosted(d.questionId, paymentId);
    return { status: "posted", questionId };
  } catch (e) {
    if (e instanceof NetworkError || (e instanceof ApiError && (e.status >= 500 || e.status === 429))) return { status: "retry", questionId };
    setAwaiting(d.questionId, false);
    const message = e instanceof ApiError && e.explained && e.message ? e.message : "It could not be posted.";
    return { status: "kept", questionId, message };
  }
}
