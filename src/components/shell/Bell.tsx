"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell as BellIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { sessionStorage } from "@/lib/auth/session-storage";
import { UNREAD_EVENT } from "./unread";

/** Unread notifications for a signed-in person (GET /notifications/unread-count); null for a guest or while unknown. */
export function useUnread(): number | null {
  const pathname = usePathname();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!sessionStorage.getToken()) {
      setN(null);
      return;
    }
    let stop = false;
    const load = () =>
      apiFetch<{ unread: number }>("/notifications/unread-count", { authed: true })
        .then((r) => { if (!stop) setN(r.unread); })
        .catch(() => { /* the bell stays as it was */ });
    void load();
    const onEvent = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === "number") setN(v);
    };
    window.addEventListener(UNREAD_EVENT, onEvent);
    window.addEventListener("focus", load);
    return () => {
      stop = true;
      window.removeEventListener(UNREAD_EVENT, onEvent);
      window.removeEventListener("focus", load);
    };
  }, [pathname]);
  return n;
}

/** The bell: opens /notifications, with a dot when something is unread. Signed in only (a guest has no alerts). */
export function Bell({ className }: { className?: string }) {
  const unread = useUnread();
  if (unread === null) return null;
  return (
    <Link href="/notifications" className={"sh-iconbtn" + (className ? " " + className : "")} aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
      <BellIcon size={22} aria-hidden="true" />
      {unread > 0 ? <span className="sh-iconbtn__dot" data-testid="bell-dot" aria-hidden="true" /> : null}
    </Link>
  );
}
