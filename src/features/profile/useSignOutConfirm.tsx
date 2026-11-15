"use client";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Dialog } from "@/components/vx";
import { currentOwner, hasKeptRecording } from "@/features/speak/draft";

export const SIGN_OUT_WARNING = "You have a recording you have not sent. Sign out anyway?";
/** Sign out never waits on storage longer than this: no answer in time counts as "no recording" and signs out as before. The limit lives here (not in `hasKeptRecording`) so the read stays a plain read and this hook owns the person's wait. */
export const CHECK_MS = 1000;

/**
 * Sign out with a warning when the person has a recording kept on this device that was not sent (signing out removes it).
 * `ask` is for the Sign out buttons; `go` signs out as it always did. With no kept recording, `go` runs at once.
 * `checking` is true while the storage read is pending (at most CHECK_MS): the buttons show their busy state.
 * An answer that comes late does nothing. "Sign out anyway" signs out only the person the warning was shown for.
 */
export function useSignOutConfirm(go: () => void): { ask: () => void; checking: boolean; dialog: ReactElement } {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const gone = useRef(false);
  const warnedFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { gone.current = true; clearTimeout(timer.current); }, []);
  const ask = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    const who = currentOwner();
    let settled = false;
    const finish = (kept: boolean) => {
      if (settled) return; // a late answer does nothing
      settled = true;
      clearTimeout(timer.current);
      busy.current = false;
      if (gone.current) return;
      setChecking(false);
      if (kept) { warnedFor.current = who; setOpen(true); } else go();
    };
    timer.current = setTimeout(() => finish(false), CHECK_MS);
    hasKeptRecording(who).then(finish, () => finish(false));
  }, [go]);
  const dialog = (
    <Dialog
      open={open}
      title={SIGN_OUT_WARNING}
      confirmLabel="Sign out anyway"
      cancelLabel="Go back"
      onClose={() => setOpen(false)}
      onConfirm={() => { setOpen(false); if (currentOwner() === warnedFor.current) go(); }}
    />
  );
  return { ask, checking, dialog };
}
