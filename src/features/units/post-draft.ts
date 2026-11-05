import { ApiError, NetworkError } from "@/lib/api/client";
import { postHeldAnswer } from "@/lib/api/units";
import { awaitingDrafts, clearDraft, setAwaiting } from "./draft";

export type DraftOutcome =
  | { status: "none" }
  | { status: "posted"; questionId: string }
  | { status: "kept"; questionId: string; message: string }
  | { status: "retry"; questionId: string };

/** After units arrive: post the draft the person was holding. The draft's own Idempotency-Key makes a refresh safe.
 *  A refusal keeps the draft (and stops waiting); a lost connection keeps it waiting so the next try posts it. */
export async function postAwaitingDraft(post: typeof postHeldAnswer = postHeldAnswer): Promise<DraftOutcome> {
  const d = awaitingDrafts()[0];
  if (!d) return { status: "none" };
  try {
    await post(d.questionId, d.body, d.key);
    clearDraft(d.questionId);
    return { status: "posted", questionId: d.questionId };
  } catch (e) {
    if (e instanceof NetworkError || (e instanceof ApiError && (e.status >= 500 || e.status === 429))) return { status: "retry", questionId: d.questionId };
    setAwaiting(d.questionId, false);
    const message = e instanceof ApiError && e.explained && e.message ? e.message : "It could not be posted.";
    return { status: "kept", questionId: d.questionId, message };
  }
}
