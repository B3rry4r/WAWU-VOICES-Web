/**
 * "Share my word" (LCH-06): on unless the person turns it off. A person who is not signed in yet can still make the
 * choice on the pick screen; it waits in this browser and is sent as soon as they are signed in, before their link is
 * ever counted.
 */
const KEY = "voices-share-word";

export function readPendingShareWord(): boolean | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "on" ? true : v === "off" ? false : null;
  } catch { return null; }
}

export function writePendingShareWord(v: boolean | null): void {
  try {
    if (v === null) window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, v ? "on" : "off");
  } catch { /* the choice then stays as it is on the server */ }
}
