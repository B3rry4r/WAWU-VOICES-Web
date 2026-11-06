"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Button } from "@/components/vx";
import { signOut } from "@/lib/api/auth";
import "./profile.css";

export const DELETE_WORDS = {
  grace: "Your account is set to be deleted. For 14 days nothing is removed.",
  lost: "After that, your posts, recordings and any unspent Voice Units are gone. Voice Units are never paid back as cash.",
  keep: "To keep your account, sign in again before the 14 days end.",
};

/** What a person sees once deletion is requested (and on every profile screen until they sign out or sign in again).
 *  lead ruling WF, 6 Nov (A-M6): Undo (sign in again, which cancels the deletion) and Sign out; after Sign out the person lands on the
 *  Landing page, never a dead end. The date ("will be deleted on ...") needs the API to send it: Me has no such field yet. */
export function DeletionPending() {
  const router = useRouter();
  const [out, setOut] = useState(false);
  const leave = (to: string) => {
    setOut(true);
    signOut();
    router.replace(to);
  };
  return (
    <div className="pf-page" data-testid="deletion-pending">
      <h1 className="pf-h1">Account deletion</h1>
      <Banner tone="warning" title="Deletion is pending">{DELETE_WORDS.grace}</Banner>
      <p className="pf-body">{DELETE_WORDS.lost}</p>
      <p className="pf-body">To keep your account, tap Undo and sign in again before the 14 days end.</p>
      <Button block loading={out} onClick={() => leave("/sign-in")}>Undo</Button>
      <Button variant="secondary" block disabled={out} onClick={() => leave("/welcome")}>Sign out</Button>
    </div>
  );
}
