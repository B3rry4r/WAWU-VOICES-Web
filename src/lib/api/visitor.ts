/**
 * The visitor id behind listen reports (LISTEN-1). A random id the browser keeps in its own first-party cookie, so a
 * person who is not signed in counts once per voice. It holds nothing readable: it is a fresh random UUID, never a
 * user id, name, address or anything derived from them. The server stores only a keyed hash of it.
 */
export const VISITOR_COOKIE = "voices_vid";
const YEAR_S = 365 * 24 * 60 * 60;
const SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CookieJar { cookie: string }

function randomId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return "";
}

/** The visitor id, made on first use. Undefined when cookies are blocked or there is no browser: then no listen record is kept for a guest. */
export function visitorId(jar: CookieJar | undefined = typeof document !== "undefined" ? document : undefined, secure = typeof location !== "undefined" && location.protocol === "https:"): string | undefined {
  if (!jar) return undefined;
  try {
    const found = jar.cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${VISITOR_COOKIE}=`));
    const have = found ? found.slice(VISITOR_COOKIE.length + 1) : "";
    if (SHAPE.test(have)) return have;
    const id = randomId();
    if (!id) return undefined;
    jar.cookie = `${VISITOR_COOKIE}=${id}; Max-Age=${YEAR_S}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
    // Cookies can be blocked: the write is then ignored and no id is kept.
    return jar.cookie.includes(`${VISITOR_COOKIE}=${id}`) ? id : undefined;
  } catch {
    return undefined;
  }
}
