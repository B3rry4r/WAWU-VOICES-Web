"use client";
import { useState } from "react";
import { Banner, Button } from "@/components/vx";
import { signOut } from "@/lib/api/auth";
import "./profile.css";

export const DELETE_WORDS = {
  grace: "Your account is set to be deleted. For 14 days nothing is removed.",
  lost: "After that, your posts, recordings and any unspent Voice Units are gone. Voice Units are never paid back as cash.",
  keep: "To keep your account, sign in again before the 14 days end.",
};

/** What a person sees once deletion is requested (and on every profile screen until they sign out or sign in again). */
export function DeletionPending() {
  const [out, setOut] = useState(false);
  return (
    <div className="pf-page" data-testid="deletion-pending">
      <h1 className="pf-h1">Account deletion</h1>
      <Banner tone="warning" title="Deletion is pending">{DELETE_WORDS.grace}</Banner>
      <p className="pf-body">{DELETE_WORDS.lost}</p>
      <p className="pf-body">{DELETE_WORDS.keep}</p>
      {out ? <p className="pf-note" role="status">You are signed out.</p> : <Button variant="secondary" block onClick={() => { signOut(); setOut(true); }}>Sign out</Button>}
    </div>
  );
}
