"use client";
import { useRef, useState } from "react";
import { Button, Sheet, TextField } from "@/components/vx";
import { ApiError } from "@/lib/api/client";
import { createAppeal } from "@/lib/api/talk";
import type { ReportTargetType } from "@/lib/api/talk";

export const APPEAL_MAX = 500;

/** The words a person sees once an appeal is with a moderator (lead ruling WF, 6 Nov, RW2). */
export const APPEAL_SENT = "Appeal sent. Another moderator will look again.";

/** Appeal a removal, a warning or a suspension (POST /appeals). One note, up to 500 characters; built in the Report sheet's pattern. A suspended person can send it too. */
export function AppealSheet({ target, onSent, onClose }: { target: { targetType: ReportTargetType; targetId: string }; onSent: () => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Set at once, before the next render, so a double tap sends one appeal.
  const sending = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    if (sending.current) return;
    if (!note.trim()) return; // Send is disabled while the box is empty (lead ruling WF-6, 6 Nov, A-L6)
    sending.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await createAppeal({ ...target, note: note.trim() });
      setDone(true);
      onSent();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Already with a moderator, or already decided: the notice shows the sent state either way.
        setDone(true);
        onSent();
      } else {
        setMsg(e instanceof ApiError && e.status === 0 ? "You are offline. Check your connection and try again." : e instanceof ApiError && e.status === 422 ? "Tell us why you are appealing." : "We could not send your appeal. Try again in a moment.");
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <Sheet title="Appeal this decision" subtitle={done ? undefined : "Another moderator will look again."} onClose={onClose}>
      {done ? (
        <div className="grid gap-3 pb-2">
          <p className="m-0 text-body" role="status">{APPEAL_SENT}</p>
          <Button size="l" block onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="grid gap-3 pb-2">
          <TextField label="Tell us why we got it wrong" multiline maxLength={APPEAL_MAX} placeholder="What did we miss?" value={note} onChange={(v) => { setNote(v); setMsg(null); }} error={msg ?? undefined} />
          <Button size="l" block loading={busy} disabled={!note.trim()} onClick={() => void send()}>Send</Button>
        </div>
      )}
    </Sheet>
  );
}
