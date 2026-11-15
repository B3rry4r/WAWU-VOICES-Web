"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner, Button } from "@/components/vx";
import { signOut } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useSignOutConfirm } from "./useSignOutConfirm";
import { cancelDeletion, getMe } from "@/lib/api/profile";
import type { Me } from "@/lib/api/profile";
import { date } from "@/lib/format/date";
import "./profile.css";

/** The words match docs/legal/terms.md ("Deleting your account") and CLAIMS.md: 14 days, then unspent tokens are lost, never paid out.
 *  `ask` and `askKeep` are for the sheet, before the person has confirmed (it says what will happen); `grace` and `keep` are for after. */
export const DELETE_WORDS = {
  ask: "If you delete your account, it is kept for 14 days in case you change your mind. Nothing is removed in that time.",
  askKeep: "To keep your account in those 14 days, tap Undo.",
  grace: "Your account is set to be deleted. For 14 days nothing is removed.",
  lost: "After that, your posts, recordings and any unspent tokens are gone. Tokens are never paid back as cash.",
  keep: "To keep your account, tap Undo before the 14 days end.",
};

/** What a person sees once deletion is requested (and on every profile screen until they Undo or sign out).
 *  lead ruling WF, 6 Nov (A-M6, RW9): the day it will run, Undo (POST /me/deletion/cancel, no sign-out, back to the normal profile)
 *  and Sign out (to /welcome, never a dead end). Deletion is cancelled ONLY by Undo, never by signing in again. */
export function DeletionPending({ scheduledFor, onUndone }: { scheduledFor?: string | null; onUndone?: (me: Me) => void }) {
  const router = useRouter();
  const [out, setOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null | undefined>(scheduledFor);
  useEffect(() => {
    if (scheduledFor !== undefined) { setDay(scheduledFor); return; }
    let on = true;
    getMe().then((m) => on && setDay(m.deletionScheduledFor ?? null), () => undefined);
    return () => { on = false; };
  }, [scheduledFor]);
  const when = day ? date(day.length <= 10 ? `${day}T12:00:00+01:00` : day) : null;
  const { ask: signOutNow, dialog: signOutDialog } = useSignOutConfirm(() => {
    setOut(true);
    signOut();
    router.replace("/welcome");
  });
  async function undo() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const me = await cancelDeletion();
      if (onUndone) onUndone(me);
      else router.replace("/profile");
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 409 ? "This account has already been deleted, so it cannot be kept." : e instanceof ApiError && e.status === 0 ? "You are offline. Check your connection and try again." : "We could not undo the deletion. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pf-page" data-testid="deletion-pending">
      <h1 className="pf-h1">Account deletion</h1>
      <Banner tone="warning" title="Deletion is pending">{when ? `Your account will be deleted on ${when}.` : "Your account is set to be deleted."}</Banner>
      <p className="pf-body">{DELETE_WORDS.lost}</p>
      <p className="pf-body">{when ? `To keep your account, tap Undo before ${when}.` : DELETE_WORDS.keep}</p>
      {err ? <p className="pf-body text-[var(--danger)]" role="alert">{err}</p> : null}
      <Button block loading={busy} disabled={out} onClick={() => void undo()}>Undo</Button>
      <Button variant="secondary" block disabled={out || busy} onClick={signOutNow}>Sign out</Button>
      {signOutDialog}
    </div>
  );
}
