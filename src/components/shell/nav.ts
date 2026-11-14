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

/**
 * One list of route prefixes for the shell. A prefix matches the route itself and anything under it ("/join" matches
 * "/join" and "/join/topics", never "/joinx"). A "*" stands for exactly one path segment ("/q/*\/write").
 * A prefix for a route that is not built yet is harmless.
 */
function matches(pathname: string, prefix: string): boolean {
  const have = pathname.split("/").filter(Boolean);
  const want = prefix.split("/").filter(Boolean);
  if (have.length < want.length) return false;
  return want.every((w, i) => w === "*" || w === have[i]);
}

function matchesAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => matches(pathname, p));
}

/** Chromeless: no shell at all (no top bar, no tab bar, no side nav). The screen draws its whole page. */
export const CHROMELESS_PREFIXES = ["/s", "/welcome", "/go", "/sign-in", "/forgot-password", "/reset-password", "/join", "/admin", "/link-not-found"] as const;

/** Full-screen tasks (V-5): recording, writing, paying, reporting. No tab bar; the screen draws its own app bar. */
export const FULLSCREEN_PREFIXES = [
  "/speak",
  "/q/*/write",
  "/q/*/mood",
  "/friends",
  "/q/*/propose",
  "/report",
  "/live/*/post",
  "/profile/edit",
  "/units/buy",
  "/units/done",
  "/units/out-of-posts",
  "/messages/*",
] as const;

/**
 * The tab screens, where the shell's logo bar shows (boards: Home, Discover, Profile, Speak root). Every other screen
 * draws its own app bar (back + title) and the shell bar is hidden.
 */
export const MAIN_TAB_ROUTES = ["/", "/discover", "/profile", "/speak"] as const;

/** Which tab is lit on a screen, as the boards show (Weekly, Newsroom, Search, topics: Discover; Wallet, Settings, units: Profile). */
const ACTIVE_BY_PREFIX: [string, NavId][] = [
  ["/units", "profile"],
  ["/wallet", "profile"],
  ["/settings", "profile"],
  ["/verify", "profile"],
  ["/news", "discover"],
  ["/weekly", "discover"],
  ["/search", "discover"],
  ["/c", "discover"],
  ["/live", "home"],
  ["/notifications", "home"],
  ["/q", "home"],
  ["/p", "home"],
  ["/surveys", "home"],
  ["/brands", "home"],
];

export function activeNav(pathname: string): NavId | null {
  if (pathname === "/") return "home";
  const hit = NAV.find((n) => n.href !== "/" && matches(pathname, n.href));
  if (hit) return hit.id;
  const by = ACTIVE_BY_PREFIX.find(([p]) => matches(pathname, p));
  return by ? by[1] : null;
}

export function isChromeless(pathname: string): boolean {
  return matchesAny(pathname, CHROMELESS_PREFIXES);
}

export function hidesTabBar(pathname: string): boolean {
  return matchesAny(pathname, FULLSCREEN_PREFIXES);
}

/** The shell's logo bar shows on the tab screens only; /speak shows it on its root, not on a recording state (a full-screen task). */
export function showsLogoBar(pathname: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (MAIN_TAB_ROUTES as readonly string[]).includes(clean);
}

/** The desktop side nav has a Weekly report row (Weekly board); on a phone the Discover tab stays lit there. */
export function onWeekly(pathname: string): boolean {
  return matches(pathname, "/weekly");
}
