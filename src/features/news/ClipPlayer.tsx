"use client";
import { LivePlayer } from "@/features/profile/ClipPlayer";
import { getPlayUrl } from "@/lib/api/news";

/** A real voice player: asks the API for a short-lived signed URL when first played, never offers a download. */
export function ClipPlayer({ clipId, durationMs, peaks }: { clipId: string; durationMs: number | null; peaks: number[] | null }) {
  return <LivePlayer clipId={clipId} durationMs={durationMs} peaks={peaks} getUrl={async (id) => (await getPlayUrl(id)).url} failMessage="This voice is not ready to play yet." />;
}
