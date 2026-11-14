"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/vx";
import { SignIn } from "@/features/entry/SignIn";
import { isAdminPath, safeReturn } from "@/lib/auth/entry-draft";

/** The admin's own plain page: no app tab bar, no Speak button. A centred column on a phone, a card from 1024 px. */
export function AdminPlain({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10 text-ink">
      <div className="flex w-full max-w-[480px] flex-col gap-5 dt:rounded-[28px] dt:border dt:border-line dt:bg-surface dt:p-8">{children}</div>
    </main>
  );
}

/** Where to land after signing in: the admin address that was asked for, and /admin when that is not an admin address. */
export function adminReturnFor(path: string): string {
  const p = safeReturn(path);
  return p && isAdminPath(p) ? p : "/admin";
}

/**
 * Shown at /admin and every /admin/... address to a person with no session. The form is the app's own sign-in form, reused as it is;
 * only the frame is the admin's. `onSignedIn` lets the gate check the new session for an admin role.
 */
export function AdminSignIn({ path, onSignedIn }: { path: string; onSignedIn: () => void }) {
  const router = useRouter();
  // The query string and hash of the address asked for come back too; adminReturnFor keeps them inside /admin on this site.
  const [tail, setTail] = useState("");
  useEffect(() => setTail(window.location.search + window.location.hash), [path]);
  const returnTo = adminReturnFor(path + tail);
  return (
    <AdminPlain>
      <Logo variant="mark" height={44} alt="VOICES" />
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-display-l">VOICES admin</h1>
        <p className="m-0 text-body text-ink-2">Sign in with your WAWU ID. Only admin accounts can open this area.</p>
      </div>
      <Suspense>
        <SignIn
          admin={{
            returnTo,
            onSignedIn: () => {
              router.replace(returnTo);
              onSignedIn();
            },
          }}
        />
      </Suspense>
    </AdminPlain>
  );
}
