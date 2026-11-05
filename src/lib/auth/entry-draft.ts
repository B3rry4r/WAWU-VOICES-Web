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
  codeSentAt?: number;
  codeLifeSec?: number;
}

export const DEFAULT_DRAFT: JoinDraft = { countryCode: "NG", languages: ["en"] };

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

/** Only a path inside this app, and never an entry screen (that would loop). */
export function safeReturn(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  const only = path.split(/[?#]/)[0];
  if (ENTRY_PATHS.some((p) => only === p || only.startsWith(p + "/"))) return null;
  return path;
}

/** Remember where the person was, so sign-in can put them back (a question, the writing screen with its draft, a held recording). */
export function holdReturn(path: string): void {
  const p = safeReturn(path);
  if (!p) return;
  try {
    store()?.setItem(RETURN_KEY, p);
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

export function takeReturn(): string | null {
  const p = peekReturn();
  try {
    store()?.removeItem(RETURN_KEY);
  } catch {
    /* nothing to clear */
  }
  return p;
}

/** The current page as a return path, for a button that sends a guest to sign in. */
export function signInHref(from: string): string {
  const p = safeReturn(from);
  return p ? `/sign-in?next=${encodeURIComponent(p)}` : "/sign-in";
}
