"use client";
import { LivePlayer } from "@/features/profile/ClipPlayer";
import { getPlayUrl } from "@/lib/api/reach";

/** A voice player for a public page: asks the API for a short-lived URL on first play, never offers a download. */
export function ClipPlayer({ clipId, durationMs, peaks, answerId }: { answerId?: string; clipId: string; durationMs: number | null; peaks: number[] | null }) {
  return <LivePlayer answerId={answerId} clipId={clipId} durationMs={durationMs} peaks={peaks} getUrl={async (id) => (await getPlayUrl(id)).url} failMessage="This voice is not ready to play yet." />;
}
