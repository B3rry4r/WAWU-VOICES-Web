"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesColumn, Compass, House, Mic, User } from "lucide-react";
import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import { DeskSearch } from "./DeskSearch";
import { ShellSlotsContext } from "./ShellSlots";
import { Bell, UnreadProvider } from "./Bell";
import { GuestEntry } from "./GuestEntry";
import { NAV, activeNav, hidesTabBar, isChromeless, onWeekly, showsLogoBar, type NavId } from "./nav";

const ICONS: Record<Exclude<NavId, "speak">, typeof House> = { home: House, discover: Compass, profile: User };

/** Messages never (V-10). The bell shows for a signed-in person; a guest gets the country pill and Sign in (GuestEntry).
 *  Phone chrome below 1024 px, desktop chrome (left nav, centre, right rail) from 1024 px. Page content goes in children; `rail` fills the right rail. */
export function AppShell({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  const [railEl, setRailEl] = useState<HTMLElement | null>(null);
  const [barEl, setBarEl] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const [bareClaims, setBareClaims] = useState(0);
  const hideTabs = useCallback(() => {
    setBareClaims((n) => n + 1);
    return () => setBareClaims((n) => n - 1);
  }, []);
  const claimBar = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  // The same element every render, so the ref callbacks' state updates never re-render the search row's Suspense boundary.
  const deskSearch = useMemo(() => <DeskSearch />, []);
  const slots = useMemo(() => ({ railEl, barEl, claimBar, hideTabs }), [railEl, barEl, claimBar, hideTabs]);
  const pathname = usePathname() ?? "/";
  const active = activeNav(pathname);
  const bare = hidesTabBar(pathname) || bareClaims > 0;
  const weekly = onWeekly(pathname);
  const logoBar = showsLogoBar(pathname);
  if (isChromeless(pathname)) return <>{children}</>;

  return (
    <UnreadProvider>
    <div className="sh-root">
      {/* desktop left nav */}
      <nav className="sh-desk sh-sidenav" aria-label="Main">
        <Link href="/" className="sh-sidenav__logo" aria-label="VOICES home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark-green.png" alt="VOICES" />
        </Link>
        {NAV.filter((n) => n.id !== "speak").map((n) => {
          const Icon = ICONS[n.id as Exclude<NavId, "speak">];
          const here = active === n.id && !(n.id === "discover" && weekly);
          return (
            <Fragment key={n.id}>
              <Link href={n.href} className="sh-tab" aria-current={here ? "page" : undefined}>
                <span className="sh-tab__ic"><Icon size={22} strokeWidth={here ? 2.4 : 2} aria-hidden="true" /></span>
                {n.label}
              </Link>
              {n.id === "discover" ? (
                <Link href="/weekly" className="sh-tab" aria-current={weekly ? "page" : undefined}>
                  <span className="sh-tab__ic"><ChartNoAxesColumn size={22} strokeWidth={weekly ? 2.4 : 2} aria-hidden="true" /></span>
                  Weekly report
                </Link>
              ) : null}
            </Fragment>
          );
        })}
        <Link href="/speak" className="sh-sidenav__speak" aria-current={active === "speak" ? "page" : undefined}>
          <Mic size={22} aria-hidden="true" />
          Speak
        </Link>
      </nav>

      {/* phone top bar: the logo bar on the tab screens only; elsewhere the screen draws its own app bar (PhoneBar or inline) */}
      <header className={claims > 0 ? "sh-topbar sh-topbar--page" : logoBar ? "sh-topbar" : "sh-topbar sh-topbar--none"}>
        {claims > 0 || !logoBar ? null : (
          <Link href="/" className="sh-topbar__logo" aria-label="VOICES home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-wordmark-green.png" alt="VOICES" />
          </Link>
        )}
        <div ref={setBarEl} className="sh-topbar__slot" />
        {logoBar ? <><GuestEntry /><Bell /></> : null}
      </header>

      <div className="sh-centre">
        {deskSearch}
        {/* The slots provider wraps only the page. The ref callbacks below set state while the shell hydrates, and a context
            change above DeskSearch's Suspense boundary would hand it an update before it finished hydrating: React then throws the
            server HTML away and re-renders the root (#423), dropping the pre-paint data-theme with it. */}
        <ShellSlotsContext.Provider value={slots}>
          <main className={bare ? "sh-main sh-main--bare" : "sh-main"}>{children}</main>
        </ShellSlotsContext.Provider>
      </div>

      <aside ref={setRailEl} className="sh-desk sh-rail" aria-label="This week">{rail}</aside>

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
    </UnreadProvider>
  );
}
