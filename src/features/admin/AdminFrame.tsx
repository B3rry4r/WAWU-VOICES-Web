"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar, EmptyState, Icon } from "@/components/vx";
import type { IconName } from "@/components/vx";
import { getAdminToday } from "@/lib/api/admin";
import type { AdminToday, Role } from "@/lib/api/admin";
import { getMe } from "@/lib/api/feed";
import { sessionStorage } from "@/lib/auth/session-storage";
import "./admin.css";
import { ADMIN_PAGES, canOpen, isAdminPerson, roleLine } from "./roles";
import type { AdminPageId } from "./roles";

interface AdminCtx {
  roles: Role[];
  name: string;
  /** The Today figures. Null until loaded, or when the call failed. The nav counts come from it. */
  today: AdminToday | null;
  todayError: Error | null;
  reloadToday: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin outside AdminFrame");
  return c;
}

type Gate = { s: "checking" } | { s: "no" } | { s: "yes"; roles: Role[]; name: string };

/** The admin area is only drawn for a signed-in person with an admin role. Everyone else gets the same "could not find that" any unknown address gets. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>({ s: "checking" });
  const [today, setToday] = useState<AdminToday | null>(null);
  const [todayError, setTodayError] = useState<Error | null>(null);
  const [n, setN] = useState(0);
  const reloadToday = useCallback(() => setN((x) => x + 1), []);

  useEffect(() => {
    if (!sessionStorage.getToken()) {
      setGate({ s: "no" });
      return;
    }
    let live = true;
    getMe().then(
      (me) => {
        if (!live) return;
        const roles = me.roles ?? [];
        setGate(isAdminPerson(roles) ? { s: "yes", roles, name: me.profile?.displayName || me.handle || "Admin" } : { s: "no" });
      },
      () => live && setGate({ s: "no" }),
    );
    return () => {
      live = false;
    };
  }, []);

  const yes = gate.s === "yes";
  useEffect(() => {
    if (yes) document.title = "Admin | VOICES";
  }, [yes]);
  useEffect(() => {
    if (!yes) return;
    let live = true;
    getAdminToday().then(
      (t) => {
        if (live) {
          setToday(t);
          setTodayError(null);
        }
      },
      (e: Error) => live && setTodayError(e),
    );
    return () => {
      live = false;
    };
  }, [yes, n]);

  const value = useMemo<AdminCtx | null>(() => (gate.s === "yes" ? { roles: gate.roles, name: gate.name, today, todayError, reloadToday } : null), [gate, today, todayError, reloadToday]);

  if (gate.s === "checking") return <div className="min-h-[60vh]" aria-busy="true" aria-label="Loading" />;
  if (gate.s === "no" || !value) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <EmptyState icon="compass" title="We could not find that" body="Go back to Home and pick another page." action="Go to Home" onAction={() => window.location.assign("/")} />
      </div>
    );
  }

  return (
    <Ctx.Provider value={value}>
      <div className="ad-root min-h-screen bg-bg text-ink">
        <div className="hidden min-h-full dt:grid dt:grid-cols-[248px_minmax(0,1fr)]">
          <Sidebar />
          <div className="min-w-0 px-10 pb-16 pt-8">{children}</div>
        </div>
        <div className="flex min-h-screen items-center justify-center p-6 dt:hidden">
          <p className="m-0 mx-auto max-w-[320px] text-center text-body text-ink-2">Open the admin on a computer.</p>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function countFor(id: AdminPageId, t: AdminToday | null): number | null {
  if (!t) return null;
  const a = t.needsAttention;
  switch (id) {
    case "news":
      return a.newsTags;
    case "results":
      return a.resultPosts;
    case "ads":
      return a.ads;
    case "weekly":
      return a.weeklyReports;
    case "moderation":
      return a.moderationOpen;
    default:
      return null;
  }
}

function Sidebar() {
  const { roles, name, today } = useAdmin();
  const path = usePathname() ?? "/admin";
  const items = ADMIN_PAGES.filter((p) => canOpen(roles, p.id));
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <aside className="sticky top-0 flex h-screen flex-col bg-forest px-4 py-6 text-forest-on" aria-label="Admin">
      <div className="mb-6 flex items-center gap-3 px-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-wordmark-white.png" alt="VOICES" className="h-9 w-auto" />
        <span className="rounded-xs bg-forest-2 px-2 py-1 text-eyebrow uppercase text-sun">Admin</span>
      </div>
      <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto" aria-label="Admin pages">
        {items.map((p, i) => {
          // "/admin/money" is a page of its own and the parent of the other Money pages: it is current only on itself.
          const own = ADMIN_PAGES.some((o) => o.href.startsWith(p.href + "/"));
          const on = p.href === "/admin" || own ? path === p.href : path === p.href || path.startsWith(p.href + "/");
          const c = countFor(p.id, today);
          const heading = p.group && p.group !== items[i - 1]?.group ? p.group : null;
          return (
            <div key={p.id} className="contents">
              {heading ? (
                <div className="vx-eyebrow mt-4 px-3 pb-1 text-[var(--on-forest-2)]" role="presentation">
                  {heading}
                </div>
              ) : null}
            <Link
              href={p.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-m px-3 text-label text-forest-on no-underline a-plain ${on ? "bg-forest-2" : "hover:bg-forest-2"}`}
            >
              <Icon name={p.icon as IconName} size={22} />
              <span className="min-w-0 flex-1">{p.label}</span>
              {c ? <span className="rounded-pill bg-green px-2 py-0.5 text-count text-green-on">{c}</span> : null}
            </Link>
            </div>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-3 border-t border-forest-2 px-3 pt-4">
        <Avatar name={name} size="l" />
        <div className="min-w-0">
          <div className="truncate text-count">{name}</div>
          <div className="text-caption text-[var(--on-forest-2)]">{roleLine(roles)}</div>
        </div>
        <span className="sr-only">{initials}</span>
      </div>
    </aside>
  );
}
