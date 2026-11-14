"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDmUnread } from "@/lib/api/dm";
import { sessionStorage } from "@/lib/auth/session-storage";
import { UNREAD_POLL_MS } from "@/features/dm/dm-logic";

/** The messages icon's unread number. A conversation page announces the number it knows so the badge follows at once. */
export const DM_UNREAD_EVENT = "voices:dm-unread";

export function announceDmUnread(unread: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<number>(DM_UNREAD_EVENT, { detail: unread }));
}

/** Unread messages for a signed-in person (GET /dm/unread), asked for every 30 seconds while the page is open; null for a guest or while unknown. */
export function useDmUnread(): number | null {
  const pathname = usePathname();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!sessionStorage.getToken()) {
      setN(null);
      return;
    }
    let stop = false;
    const load = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      getDmUnread().then((r) => { if (!stop) setN(r.unread); }).catch(() => { /* the badge stays as it was */ });
    };
    load();
    const timer = setInterval(load, UNREAD_POLL_MS);
    const onEvent = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === "number") setN(v);
    };
    window.addEventListener(DM_UNREAD_EVENT, onEvent);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      clearInterval(timer);
      window.removeEventListener(DM_UNREAD_EVENT, onEvent);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname]);
  return n;
}

const DmUnreadContext = createContext<number | null>(null);

/** One poll for every messages icon on the page (phone bar and desktop row). */
export function DmUnreadProvider({ children }: { children: ReactNode }) {
  const unread = useDmUnread();
  return <DmUnreadContext.Provider value={unread}>{children}</DmUnreadContext.Provider>;
}

/** The messages icon in the top bar: opens /messages, with the number of unread messages on it. Signed in only. */
export function MessagesIcon({ className }: { className?: string }) {
  const unread = useContext(DmUnreadContext);
  const on = (usePathname() ?? "").startsWith("/messages");
  if (unread === null) return null;
  return (
    <Link href="/messages" aria-current={on ? "page" : undefined} className={"sh-iconbtn" + (on ? " sh-iconbtn--on" : "") + (className ? " " + className : "")} aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}>
      <MessageCircle size={22} aria-hidden="true" />
      {unread > 0 ? <span className="sh-iconbtn__dot" data-testid="messages-dot" aria-hidden="true" /> : null}
    </Link>
  );
}
