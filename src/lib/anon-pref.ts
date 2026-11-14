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
}
