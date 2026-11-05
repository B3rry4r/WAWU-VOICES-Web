import type { Poll } from "@/lib/api/vote";

/** The poll a question's Vote and Results screens show: the open one, else the latest closed, else one that has not started. */
export function pickPoll(items: Poll[]): Poll | undefined {
  const open = items.find((p) => p.status === "OPEN");
  if (open) return open;
  const closed = items.filter((p) => p.status === "CLOSED").sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt));
  return closed[0] ?? items[0];
}
