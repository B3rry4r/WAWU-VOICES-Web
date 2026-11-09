/* One purchase attempt = one Idempotency-Key, kept in this browser's localStorage (shared by every tab), per person and choice.
 * Two tabs on the same pack get the same key and so the same payment, until it settles or expires.
 * - A retry of the same choice (network error, a second tap, a reload, the back button from checkout) re-uses the key,
 *   so the server hands back the same payment and a second payment is never made.
 * - Once the POST has answered, the checkout address is kept too, so a repeat tap goes straight to it without a request.
 * - The entry is dropped when the payment reaches a final state (the return page) or the payment has expired.
 * Storage can be blocked: every call falls back to a key held in memory for this page. */

import { sessionStorage as authStore } from "@/lib/auth/session-storage";

const STORE = "voices-buy-attempts";
const MAX_AGE_MS = 20 * 60 * 1000; // under the 30 minute payment expiry, well inside the server's 24 hour key window

export interface Attempt {
  key: string;
  createdAt: number;
  /** A tokens screen the person came from, a path inside VOICES (never an address). */
  from?: string;
  /** The question whose held draft this purchase is for. Only this draft may post when this purchase succeeds. */
  draftQuestionId?: string;
  paymentId?: string;
  checkoutUrl?: string;
  expiresAt?: number;
}

type Table = Record<string, Attempt>;

/** The signed-in person (the token's `sub`), so one person's attempt is never reused for another. */
function person(): string {
  try {
    const tok = authStore.getToken();
    const part = tok?.split(".")[1];
    if (part) {
      const sub = (JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown }).sub;
      if (typeof sub === "string" && sub) return sub;
    }
  } catch {
    /* an unreadable token: fall through */
  }
  return "anon";
}
const slot = (choice: string) => `${person()}|${choice}`;
const memory: Table = {};
let blocked = false; // storage threw once: this page keeps its own copy

function read(): Table {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return blocked ? { ...memory } : {};
    const t = JSON.parse(raw) as Table;
    if (!t || typeof t !== "object") return {};
    return t;
  } catch {
    blocked = true;
    return { ...memory };
  }
}

function write(t: Table): void {
  Object.keys(memory).forEach((k) => delete memory[k]);
  Object.assign(memory, t);
  try {
    window.localStorage.setItem(STORE, JSON.stringify(t));
  } catch {
    blocked = true; // memory above still holds it for this page
  }
}

export function newKey(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** A path inside VOICES, or undefined. Blocks addresses and `//host`. */
export function safePath(p: string | null | undefined): string | undefined {
  if (!p || p.length > 200 || !/^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/.test(p)) return undefined;
  return p;
}

export function choiceId(spec: { kind: "UNITS"; tierId: string; method?: string } | { kind: "EXTRA_VOICE"; tokenKind: string }): string {
  return spec.kind === "UNITS" ? `UNITS:${spec.tierId}:${spec.method ?? "any"}` : `EXTRA_VOICE:${spec.tokenKind}`;
}

function fresh(a: Attempt, now: number): boolean {
  if (now - a.createdAt > MAX_AGE_MS) return false;
  if (a.expiresAt !== undefined && a.expiresAt <= now) return false;
  return true;
}

/** The live attempt for this choice, or a new one. */
export function attemptFor(choice: string, from?: string, now = Date.now(), draftQuestionId?: string): Attempt {
  const t = read();
  const k = slot(choice);
  const have = t[k];
  if (have && fresh(have, now)) {
    if (have.draftQuestionId !== draftQuestionId) {
      have.draftQuestionId = draftQuestionId;
      t[k] = have;
      write(t);
    }
    return have;
  }
  const a: Attempt = { key: newKey(), createdAt: now, ...(from ? { from } : {}), ...(draftQuestionId ? { draftQuestionId } : {}) };
  t[k] = a;
  write(t);
  // Another tab may have written between our read and write: whatever is stored now is the attempt for everyone.
  return read()[k] ?? a;
}

export function saveAttempt(choice: string, patch: Partial<Attempt>): void {
  const t = read();
  const k = slot(choice);
  if (t[k]) {
    t[k] = { ...t[k], ...patch };
    write(t);
  }
}

/** Forget a choice that failed before the server answered with a payment (so the next tap is a clean attempt). */
export function dropAttempt(choice: string): void {
  const t = read();
  delete t[slot(choice)];
  write(t);
}

/** The attempt that made this payment, for the return page. */
export function findByPayment(paymentId: string): Attempt | undefined {
  return Object.values(read()).find((a) => a.paymentId === paymentId);
}

/** The payment reached a final state: forget every attempt that made it. */
export function clearByPayment(paymentId: string): void {
  const t = read();
  let changed = false;
  for (const k of Object.keys(t)) {
    if (t[k].paymentId === paymentId) {
      delete t[k];
      changed = true;
    }
  }
  if (changed) write(t);
}
