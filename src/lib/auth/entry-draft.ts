/**
 * What the join steps remember between pages, and where a person goes back to after signing in.
 * Browser only (V-19: drafts and a guest's recording stay in the browser). Every read and write is guarded:
 * private windows and blocked storage must leave the screens working, just without memory.
 */
const DRAFT_KEY = "voices-join-draft";
const RETURN_KEY = "voices-return-to";

export interface TopicPick { categoryId: string; alertsOn: boolean }

export interface JoinDraft {
  countryCode: string;
  languages: string[];
  email?: string;
  fullName?: string;
  ageConfirmed?: boolean;
  topics?: TopicPick[];
  /** When the email code was last sent (ms), and how long it lives (s). */
  /** The code was accepted: only the steps after it may be retried, never the code. */
  verified?: boolean;
  codeSentAt?: number;
  codeLifeSec?: number;
}

export const DEFAULT_DRAFT: JoinDraft = { countryCode: "NG", languages: ["en", "pcm"] };

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(): JoinDraft {
  try {
    const raw = store()?.getItem(DRAFT_KEY);
    if (!raw) return { ...DEFAULT_DRAFT };
    return { ...DEFAULT_DRAFT, ...(JSON.parse(raw) as Partial<JoinDraft>) };
  } catch {
    return { ...DEFAULT_DRAFT };
  }
}

export function saveDraft(patch: Partial<JoinDraft>): JoinDraft {
  const next = { ...readDraft(), ...patch };
  try {
    store()?.setItem(DRAFT_KEY, JSON.stringify(next));
  } catch {
    /* no storage: the next page starts from the defaults */
  }
  return next;
}

export function clearDraft(): void {
  try {
    store()?.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

const ENTRY_PATHS = ["/welcome", "/sign-in", "/join"];
const KIND_KEY = "voices-return-kind";
const BAD_CHARS = /[\u0000-\u001f\u007f\s]/;

/**
 * Only a path inside this app, and never an entry screen (that would loop). Control characters and whitespace are
 * refused before and after decoding (a tab or newline inside "//" is dropped by browsers and turns "/\t/evil" into
 * "//evil"). The path is parsed against this origin and only pathname, search and hash are returned.
 */
export function safeReturn(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (BAD_CHARS.test(path) || BAD_CHARS.test(decoded)) return null;
  for (const v of [path, decoded]) if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  let u: URL;
  try {
    u = new URL(path, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin || !/^\/(?!\/)/.test(u.pathname)) return null;
  if (ENTRY_PATHS.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"))) return null;
  return u.pathname + u.search + u.hash;
}

/**
 * Remember where the person was, so sign-in can put them back. Pass kind "post" only when a recording or draft is
 * really held in the browser: then the sheets say "posts as soon as you are in". Otherwise they use the plain words.
 */
export function holdReturn(path: string, kind: "page" | "post" = "page"): void {
  const p = safeReturn(path);
  if (!p) return;
  try {
    store()?.setItem(RETURN_KEY, p);
    store()?.setItem(KIND_KEY, kind);
  } catch {
    /* no storage: they land on Home */
  }
}

export function peekReturn(): string | null {
  try {
    return safeReturn(store()?.getItem(RETURN_KEY));
  } catch {
    return null;
  }
}

/** True only when the held return is for a post that is really waiting (a held recording or draft). */
export function peekHeldPost(): boolean {
  try {
    return peekReturn() !== null && store()?.getItem(KIND_KEY) === "post";
  } catch {
    return false;
  }
}

export function takeReturn(): string | null {
  const p = peekReturn();
  try {
    store()?.removeItem(RETURN_KEY);
    store()?.removeItem(KIND_KEY);
  } catch {
    /* nothing to clear */
  }
  return p;
}

/** Sign out forgets the join draft and the held return. */
export function clearEntryState(): void {
  try {
    store()?.removeItem(DRAFT_KEY);
    store()?.removeItem(RETURN_KEY);
    store()?.removeItem(KIND_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The current page as a return path, for a button that sends a guest to sign in. Pass held when a post is waiting. */
export function signInHref(from: string, held = false): string {
  const p = safeReturn(from);
  return p ? `/sign-in?next=${encodeURIComponent(p)}${held ? "&held=1" : ""}` : "/sign-in";
}
