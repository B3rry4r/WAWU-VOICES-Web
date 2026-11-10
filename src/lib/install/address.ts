/**
 * V-41: "the address opened is kept". A visitor arrives at an invite, a share link or a payment return; the install screen
 * stands in front of that same address, so "Continue in the browser" simply reveals it. The address is also written down
 * when the person installs, so the installed app (which opens at "/") can take them to it once, within a week.
 * Only same-site paths are ever kept or opened.
 */
export const KEPT_ADDRESS_KEY = "voices-opened-address";
export const KEPT_ADDRESS_DAYS = 7;

/** A same-site path with its query and hash, else null (no other origin, no "//", no scheme). */
export function safeAddress(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || /[\u0000-\u001f]/.test(s)) return null;
  if (s.length > 2048) return null;
  return s;
}

export function keepAddress(address: string, now = Date.now(), store?: Pick<Storage, "setItem">): void {
  const a = safeAddress(address);
  if (!a || a === "/") return;
  try { (store ?? window.localStorage).setItem(KEPT_ADDRESS_KEY, JSON.stringify({ a, t: now })); } catch { /* storage may be off */ }
}

/** The kept address if it is still fresh; it is removed on the way out. */
export function takeKeptAddress(now = Date.now(), store?: Pick<Storage, "getItem" | "removeItem">): string | null {
  try {
    const s = store ?? window.localStorage;
    const raw = s.getItem(KEPT_ADDRESS_KEY);
    if (!raw) return null;
    s.removeItem(KEPT_ADDRESS_KEY);
    const p = JSON.parse(raw) as { a?: unknown; t?: unknown };
    if (typeof p.t !== "number" || now - p.t > KEPT_ADDRESS_DAYS * 86_400_000) return null;
    return safeAddress(p.a);
  } catch {
    return null;
  }
}
