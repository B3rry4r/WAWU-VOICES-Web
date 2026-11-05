import type { ResultCommentProps } from "@/components/vx";
import type { ResultPost } from "@/lib/api/results";
import { lagosClock } from "./shared";

/** One API result post as the design's ResultComment: Lagos clock time, the place line, the three totals, the mark. */
export function toComment(p: ResultPost, isNew = false): ResultCommentProps {
  return {
    id: p.id,
    author: { handle: "@" + p.author.handle, name: p.author.displayName ?? p.author.handle },
    time: lagosClock(p.createdAt),
    place: `${p.pollingUnit}, ${p.ward}, ${p.lga}, ${p.state}`,
    figures: [
      { label: "Accredited", value: String(p.accredited) },
      { label: "Votes cast", value: String(p.votesCast) },
      { label: "Rejected", value: String(p.rejected) },
    ],
    status: p.status === "VERIFIED" ? "verified" : "unverified",
    checked: p.checkedLine ?? undefined,
    isNew,
  };
}
