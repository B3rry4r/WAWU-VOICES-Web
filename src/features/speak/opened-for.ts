import { sessionSubject } from "@/lib/api/client";

/**
 * The person a record screen was opened for. When the screen is mounted again straight away (the page swaps it for its loading state and back
 * after another tab changed the sign-in), the new copy keeps the person the first one was opened for, so the screen cannot quietly become
 * someone else's. A screen opened fresh (the previous one gone for more than a moment, or a reload) is opened for whoever is signed in then.
 */
const REMOUNT_MS = 20;
let held: string | null | undefined;
let live = 0;
let lastGone = 0;

export function openedFor(): string | null {
  if (live === 0 && Date.now() - lastGone > REMOUNT_MS) held = undefined;
  live++;
  if (held === undefined) held = sessionSubject();
  return held;
}

export function closedFor(): void {
  live = Math.max(0, live - 1);
  lastGone = Date.now();
}
