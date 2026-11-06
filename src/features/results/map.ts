import type { ResultCommentProps } from "@/components/vx";
import type { ResultPost } from "@/lib/api/results";
import { unitLabel } from "@/lib/format/place";
import { lagosClock } from "./shared";

/** One API result post as the design's ResultComment: Lagos clock time, the place line, the three totals, the mark. */
export function toComment(p: ResultPost, isNew = false): ResultCommentProps {
  return {
    id: p.id,
    author: { handle: "@" + p.author.handle, name: p.author.displayName ?? p.author.handle },
    time: lagosClock(p.createdAt),
    place: unitLabel(p),
    figures: [
      { label: "Accredited", value: String(p.accredited) },
      { label: "Votes cast", value: String(p.votesCast) },
      { label: "Rejected", value: String(p.rejected) },
    ],
    status: p.status === "VERIFIED" ? "verified" : "unverified",
    checked: p.checkedLine ?? undefined,
    // C-N7: not verified AND never checked shows nothing; a checked, not verified post keeps its pill
    unchecked: p.status === "NOT_VERIFIED" && !p.checkedAt,
    isNew,
  };
}
