"use client";

import Link from "next/link";
import { Button } from "@/components/vx";
import { AdminPlain } from "./AdminSignIn";

/** A signed-in person whose account has no admin role. Nothing from the admin API is fetched or drawn for them. */
export function AdminNotAdmin({ handle, onOtherAccount }: { handle: string | null; onOtherAccount: () => void }) {
  return (
    <AdminPlain>
      <h1 className="m-0 font-display text-display-l">This account is not an admin</h1>
      <p className="m-0 text-body text-ink-2">
        {handle ? `You are signed in as @${handle}.` : "You are signed in."} Ask an admin to give this account access, or sign in with another account.
      </p>
      <Button size="l" block onClick={onOtherAccount}>Sign in with another account</Button>
      <Link href="/" className="link inline-flex min-h-[44px] items-center justify-center">Back to VOICES</Link>
    </AdminPlain>
  );
}
