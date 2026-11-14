"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { onAnonPref, readAnonPref, writeAnonPref } from "@/lib/anon-pref";

/** Said under a reply box when the writer of a nameless answer replies under it: the server makes that reply nameless whatever is sent. */
export const OWN_NAMELESS_NOTE = "Your reply stays without your name, because your answer is without your name.";

/** The stored-choice slot of one reply box. A reply and the answer it hangs off never share a choice. */
export const replyAnonSlot = (answerId: string) => `reply:${answerId}`;

/**
 * "Post without my name" for a reply box (V-FIX-D). Off until turned on; kept for this answer in this tab (anon-pref) so a reply
 * held while the person buys tokens still goes out unnamed. `ref.current` is what a send reads, at the moment it sends:
 * a "Try again" tapped after a failure must use the switch as it is now, not as it was when the failed attempt began.
 */
export function useReplyAnon(answerId: string) {
  const ref = useRef(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const v = readAnonPref(replyAnonSlot(answerId));
    ref.current = v;
    setOn(v);
    // The voice sheet has its own switch on the same slot: when it changes, this one follows.
    return onAnonPref(replyAnonSlot(answerId), (v) => { ref.current = v; setOn(v); });
  }, [answerId]);
  const set = useCallback((v: boolean) => {
    ref.current = v;
    setOn(v);
    writeAnonPref(replyAnonSlot(answerId), v);
  }, [answerId]);
  /** After a reply is sent: forget the choice. */
  const clear = useCallback(() => { ref.current = false; setOn(false); writeAnonPref(replyAnonSlot(answerId), false); }, [answerId]);
  return { on, ref, set, clear };
}
