/**
 * LCH-06: the invite code a visitor arrives with. Only the code is kept (in one first-party cookie, for 30 days, first
 * link wins): nothing about the device, the address or the visit. The server counts the person as the sender's friend
 * once they have signed up and answered.
 */
export const INVITE_COOKIE = "voices_invite";
export const INVITE_DAYS = 30;
export const INVITE_MAX_AGE = INVITE_DAYS * 24 * 60 * 60;
const CODE_RE = /^[a-z0-9]{7}$/;

/** The code in lower case if it has the right shape, else null. */
export function cleanInviteCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toLowerCase();
  return CODE_RE.test(c) ? c : null;
}

/** The Set-Cookie value that keeps `code` for 30 days. */
export function inviteCookieValue(code: string, secure: boolean): string {
  return `${INVITE_COOKIE}=${code}; Max-Age=${INVITE_MAX_AGE}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** The kept code in a cookie string (document.cookie or a Cookie header), or null. */
export function readInviteCode(cookies: string): string | null {
  for (const part of cookies.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === INVITE_COOKIE) return cleanInviteCode(rest.join("="));
  }
  return null;
}

/** Browser side: the code kept for this visitor. */
export function keptInviteCode(): string | null {
  try { return readInviteCode(document.cookie); } catch { return null; }
}

/** Browser side: forget the code once it has been used. */
export function forgetInviteCode(): void {
  try { document.cookie = `${INVITE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`; } catch { /* nothing to forget */ }
}
