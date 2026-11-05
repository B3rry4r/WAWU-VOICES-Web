"use client";
import { useState } from "react";
import { Banner, Button, Sheet } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { createReport } from "@/lib/api/talk";
import type { ReportReason } from "@/lib/api/talk";

const WHY: { reason: ReportReason; label: string; note?: string }[] = [
  { reason: "OTHER", label: "The numbers look wrong", note: "Wrong numbers" },
  { reason: "SCAM_OR_SPAM", label: "Spam or a scam" },
  { reason: "PERSONAL_DETAILS", label: "Shares personal details" },
];

/** Report a result post (POST /reports, RESULT_POST). The post's author is never told who reported it. */
export function ReportSheet({ postId, signedIn, onClose }: { postId: string; signedIn: boolean | null; onClose: () => void }) {
  const [busy, setBusy] = useState<ReportReason | null>(null);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(w: (typeof WHY)[number]) {
    if (busy) return;
    setBusy(w.reason);
    setMsg(null);
    try {
      await createReport({ targetType: "RESULT_POST", targetId: postId, reason: w.reason, note: w.note });
      setDone(true);
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 409 ? "You already reported this. Our team has it." : e instanceof ApiError && e.status === 0 ? "You are offline. Check your connection and try again." : "We could not send your report. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title="Report wrong numbers" subtitle="The person is not told who reported them." onClose={onClose}>
      {signedIn === false ? (
        <Banner tone="info" title="Sign in to report.">Reading stays free.</Banner>
      ) : done ? (
        <div className="grid gap-3 pb-2">
          <p className="m-0 text-[16px] leading-6" role="status">Thanks. We got your report. The WAWU team will check these numbers.</p>
          <Button size="l" block onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="grid gap-2 pb-2">
          {WHY.map((w) => <Button key={w.reason} variant="secondary" size="l" block loading={busy === w.reason} disabled={!!busy} onClick={() => void send(w)}>{w.label}</Button>)}
          {msg ? <p role="alert" className="m-0 text-[14px] font-semibold text-[var(--danger)]">{msg}</p> : null}
        </div>
      )}
    </Sheet>
  );
}
