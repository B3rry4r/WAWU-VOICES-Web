export type NavId = "home" | "discover" | "speak" | "profile";

export interface NavItem {
  id: NavId;
  label: string;
  href: string;
}

export const NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "discover", label: "Discover", href: "/discover" },
  { id: "speak", label: "Speak", href: "/speak" },
  { id: "profile", label: "Profile", href: "/profile" },
];

/** Full-screen tasks hide the phone tab bar (V-5): recording, writing, paying, reporting, sign-up. */
export const FULLSCREEN_PREFIXES = ["/speak"];

export function activeNav(pathname: string): NavId | null {
  if (pathname === "/") return "home";
  const hit = NAV.find((n) => n.href !== "/" && (pathname === n.href || pathname.startsWith(n.href + "/")));
  if (hit) return hit.id;
  if (pathname.startsWith("/q/")) return "home";
  return null;
}

/** Public pages that draw their own page and carry no app chrome at all: the share page behind a link (/s/[code]). */
export const CHROMELESS_PREFIXES = ["/s"];

export function isChromeless(pathname: string): boolean {
  return CHROMELESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function hidesTabBar(pathname: string): boolean {
  return FULLSCREEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
