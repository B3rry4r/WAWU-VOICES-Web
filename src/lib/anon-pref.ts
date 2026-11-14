/**
 * V-ANON: "Post without my name" is remembered for one question in this tab, so a post held while the person buys
 * tokens or signs in is still posted without their name. It is never on until the person turns it on, and it is
 * forgotten once the post is sent. Browser storage can be blocked, so every call is guarded.
 */
const key = (qid: string) => `voices-anon:${qid}`;

export function readAnonPref(qid: string): boolean {
  try { return window.sessionStorage.getItem(key(qid)) === "1"; } catch { return false; }
}

export function writeAnonPref(qid: string, on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(key(qid), "1");
    else window.sessionStorage.removeItem(key(qid));
  } catch { /* nothing to remember it in */ }
  // Two switches can share one slot (a reply's text box and its voice sheet): tell the other one.
  try { window.dispatchEvent(new CustomEvent(ANON_EVENT, { detail: { slot: qid, on } })); } catch { /* no window */ }
}

export const ANON_EVENT = "voices-anon-pref";

/** Calls `fn` when another switch changes this slot. Returns the unsubscribe. */
export function onAnonPref(slot: string, fn: (on: boolean) => void): () => void {
  const h = (e: Event) => { const d = (e as CustomEvent<{ slot: string; on: boolean }>).detail; if (d && d.slot === slot) fn(d.on); };
  window.addEventListener(ANON_EVENT, h);
  return () => window.removeEventListener(ANON_EVENT, h);
}
