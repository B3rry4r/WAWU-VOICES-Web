"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, House, Mic, User } from "lucide-react";
import type { ReactNode } from "react";
import { NAV, activeNav, hidesTabBar, isChromeless, type NavId } from "./nav";

const ICONS: Record<Exclude<NavId, "speak">, typeof House> = { home: House, discover: Compass, profile: User };

/** Messages, the bell, the country pill and the desktop search are not shown until the tasks that build them (V-10, W2, W1) add them back.
 *  Phone chrome below 1024 px, desktop chrome (left nav, centre, right rail) from 1024 px. Page content goes in children; `rail` fills the right rail. */
export function AppShell({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const active = activeNav(pathname);
  const bare = hidesTabBar(pathname);
  if (isChromeless(pathname)) return <>{children}</>;

  return (
    <div className="sh-root">
      {/* desktop left nav */}
      <nav className="sh-desk sh-sidenav" aria-label="Main">
        <Link href="/" className="sh-sidenav__logo" aria-label="VOICES home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark-green.png" alt="VOICES" />
        </Link>
        {NAV.filter((n) => n.id !== "speak").map((n) => {
          const Icon = ICONS[n.id as Exclude<NavId, "speak">];
          return (
            <Link key={n.id} href={n.href} className="sh-tab" aria-current={active === n.id ? "page" : undefined}>
              <span className="sh-tab__ic"><Icon size={22} strokeWidth={active === n.id ? 2.4 : 2} aria-hidden="true" /></span>
              {n.label}
            </Link>
          );
        })}
        <Link href="/speak" className="sh-sidenav__speak" aria-current={active === "speak" ? "page" : undefined}>
          <Mic size={22} aria-hidden="true" />
          Speak
        </Link>
      </nav>

      {/* phone top bar */}
      <header className="sh-topbar">
        <Link href="/" className="sh-topbar__logo" aria-label="VOICES home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark-green.png" alt="VOICES" />
        </Link>
      </header>

      <div className="sh-centre">
        <main className={bare ? "sh-main sh-main--bare" : "sh-main"}>{children}</main>
      </div>

      <aside className="sh-desk sh-rail" aria-label="This week">{rail}</aside>

      {/* phone bottom tab bar */}
      {bare ? null : (
        <nav className="sh-bottombar" aria-label="Main">
          {NAV.map((n) =>
            n.id === "speak" ? (
              <Link key={n.id} href={n.href} className="sh-speak" aria-current={active === "speak" ? "page" : undefined}>
                <span className="sh-speak__btn"><Mic size={28} strokeWidth={2.25} aria-hidden="true" /></span>
                Speak
              </Link>
            ) : (
              <Link key={n.id} href={n.href} className="sh-tab" aria-current={active === n.id ? "page" : undefined}>
                <span className="sh-tab__ic">
                  {(() => { const Icon = ICONS[n.id]; return <Icon size={22} strokeWidth={active === n.id ? 2.4 : 2} aria-hidden="true" />; })()}
                </span>
                {n.label}
              </Link>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
