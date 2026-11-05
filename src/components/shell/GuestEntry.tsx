"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { sessionStorage } from "@/lib/auth/session-storage";
import { signInHref } from "@/lib/auth/entry-draft";

/**
 * What a guest sees where a signed-in person sees the bell: the country pill (to /join/country, as README-2 draws it) and
 * a Sign in button that comes back to this page. Signed in: nothing here (the bell shows, and there is no route to change
 * country after sign-up, README-2 gap 3). Nothing is held for a draft here, so this never calls holdReturn with "post".
 */
export function GuestEntry() {
  const pathname = usePathname() ?? "/";
  const [guest, setGuest] = useState(false);
  const [from, setFrom] = useState(pathname);
  useEffect(() => {
    setGuest(!sessionStorage.getToken());
    setFrom(pathname + window.location.search);
  }, [pathname]);
  if (!guest) return null;
  return (
    <>
      <Link href="/join/country" className="sh-country" aria-label="Country: Nigeria. Change country">
        <Globe size={18} aria-hidden="true" />
        Nigeria
      </Link>
      <Link href={signInHref(from)} className="sh-signin">Sign in</Link>
    </>
  );
}
