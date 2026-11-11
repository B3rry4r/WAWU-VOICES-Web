import type { AdminQuestion } from "@/lib/api/admin";
import { startFlashPoll } from "@/lib/api/admin";

/** How long a flash poll stays open once started from the dashboard (RW5). */
export const FLASH_HOURS = 24;

/** Opens a FLASH question as a flash poll that starts now. The API allows one open flash poll at a time (409, in its own words). */
export function startFlashNow(q: AdminQuestion, topicId?: string) {
  const now = Date.now();
  return startFlashPoll({
    kind: "FLASH",
    questionId: q.id,
    ...(topicId ? { topicId } : {}),
    title: q.text.slice(0, 200),
    choiceMode: "SINGLE",
    options: ["Yes", "No"],
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + FLASH_HOURS * 3600000).toISOString(),
  });
}
