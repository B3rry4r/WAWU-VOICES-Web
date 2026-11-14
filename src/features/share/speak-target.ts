import type { SharePage } from "@/lib/api/reach";

/** A share code as it travels in an address: letters, digits, dash and underscore only. Anything else is dropped. */
export const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const cleanCode = (v: string | null | undefined): string | null => (v && CODE_RE.test(v) ? v : null);

/**
 * Where a link for an open QUESTION leads: the question's Speak screen (the pick-one-word screen when the question has word
 * options), with the link's code kept as `from`. null for every other link (an answer, a closed or unopened question, ...):
 * those keep the share page as it is.
 */
export function speakTarget(page: Pick<SharePage, "objectType" | "code" | "question">): string | null {
  const q = page.question;
  const code = cleanCode(page.code);
  if (page.objectType !== "QUESTION" || !q || q.status !== "LIVE" || !q.id || !code) return null;
  const base = q.moodOptions?.length ? `/q/${encodeURIComponent(q.id)}/mood` : `/q/${encodeURIComponent(q.id)}/speak`;
  return `${base}?from=${encodeURIComponent(code)}`;
}
