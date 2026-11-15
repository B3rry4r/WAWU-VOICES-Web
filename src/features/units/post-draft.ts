import { ApiError, NetworkError } from "@/lib/api/client";
import { needsNewKey, newKeyLine } from "@/lib/api/keys";
import { postHeldAnswer } from "@/lib/api/units";
import { AUTO_POST_MAX_AGE_MS, findPostedFor, getRecord, markPosted, renewDraftKey, setAwaiting } from "./draft";
import { openedFor } from "@/features/speak/draft";
import { forgetPostedWords } from "@/features/talk/lib";

export type DraftOutcome =
  | { status: "none" }
  | { status: "posted"; questionId: string }
  | { status: "offer"; questionId: string }
  | { status: "kept"; questionId: string; message: string }
  | { status: "retry"; questionId: string };

/** The held post is recorded as posted: the typed words for that question (the write box) go with it, so a Post tap cannot send them a second time. */
function forgetWords(questionId: string): void {
  const rec = getRecord(questionId, openedFor());
  if (rec?.posted) forgetPostedWords(`q:${questionId}`, rec.body, openedFor());
}

/** After a tokens purchase succeeds: post THE draft this purchase was made for, once.
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
    const was = findPostedFor(paymentId, openedFor()); // this browser already posted the draft for this payment (another tab won)
    if (was) forgetWords(was);
    return was ? { status: "posted", questionId: was } : { status: "none" };
  }
  const d = getRecord(questionId, openedFor());
  if (!d) return { status: "none" };
  if (d.posted === paymentId) { forgetWords(questionId); return { status: "posted", questionId }; }
  if (d.posted || (!d.awaitingUnits && !opts.force)) return { status: "none" };
  if (!opts.force && (opts.now ?? Date.now()) - d.savedAt > AUTO_POST_MAX_AGE_MS) return { status: "offer", questionId };
  const post = opts.post ?? postHeldAnswer;
  try {
    await post(d.questionId, d.body, d.key);
    markPosted(d.questionId, paymentId, openedFor());
    forgetWords(d.questionId);
    return { status: "posted", questionId };
  } catch (e) {
    if (e instanceof NetworkError || (e instanceof ApiError && (e.status >= 500 || e.status === 429))) return { status: "retry", questionId };
    setAwaiting(d.questionId, false, openedFor());
    if (needsNewKey(e)) {
      // The key is spent: the same words get a new one now, so the next Post tap on the write screen goes out with it and posts.
      renewDraftKey(d.questionId, openedFor());
      return { status: "kept", questionId, message: newKeyLine("Post") };
    }
    const message = e instanceof ApiError && e.explained && e.message ? e.message : "It could not be posted.";
    return { status: "kept", questionId, message };
  }
}
