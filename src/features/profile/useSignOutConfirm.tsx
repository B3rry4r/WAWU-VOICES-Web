"use client";
import { useCallback, useRef, useState, type ReactElement } from "react";
import { Dialog } from "@/components/vx";
import { currentOwner, hasKeptRecording } from "@/features/speak/draft";

export const SIGN_OUT_WARNING = "You have a recording you have not sent. Sign out anyway?";

/**
 * Sign out with a warning when the person has a recording kept on this device that was not sent (signing out removes it).
 * `ask` is for the Sign out buttons; `go` signs out as it always did. With no kept recording, `go` runs at once.
 */
export function useSignOutConfirm(go: () => void): { ask: () => void; dialog: ReactElement } {
  const [open, setOpen] = useState(false);
  const checking = useRef(false);
  const ask = useCallback(() => {
    if (checking.current) return;
    checking.current = true;
    void hasKeptRecording(currentOwner()).then(
      (kept) => { checking.current = false; if (kept) setOpen(true); else go(); },
      () => { checking.current = false; go(); },
    );
  }, [go]);
  const dialog = (
    <Dialog
      open={open}
      title={SIGN_OUT_WARNING}
      confirmLabel="Sign out anyway"
      cancelLabel="Go back"
      onClose={() => setOpen(false)}
      onConfirm={() => { setOpen(false); go(); }}
    />
  );
  return { ask, dialog };
}
