/**
 * V-41: which install screen a visitor gets. Pure functions over what the browser tells us, so each case has a test.
 * Nothing here touches the document; the caller reads the browser and passes it in.
 */
export type InAppName = "Instagram" | "WhatsApp" | "Facebook" | "Messenger" | "X" | "TikTok" | "Snapchat" | "LinkedIn" | "this app";
export type Os = "ios" | "ipados" | "android" | "desktop";
export type BrowserName = "safari" | "chrome" | "firefox" | "edge" | "samsung" | "opera" | "other";

export interface BrowserFacts {
  userAgent: string;
  maxTouchPoints?: number;
  /** `matchMedia("(display-mode: standalone)")` or fullscreen or minimal-ui. */
  displayModeStandalone?: boolean;
  /** iOS only: `navigator.standalone`. */
  navigatorStandalone?: boolean;
}

export interface Environment {
  standalone: boolean;
  os: Os;
  browser: BrowserName;
  inApp: InAppName | null;
}

/** The in-app browsers, most specific first (Messenger and Instagram UAs also carry the Facebook tokens). */
const IN_APP: [RegExp, InAppName][] = [
  [/Instagram/i, "Instagram"],
  [/MessengerForiOS|MessengerLite|Orca-Android|\bMESSENGER\b/i, "Messenger"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/WhatsApp/i, "WhatsApp"],
  [/Twitter|TwitterAndroid|\bX-Android\b/i, "X"],
  [/musical_ly|TikTok|BytedanceWebview|Bytedance|\btrill\b/i, "TikTok"],
  [/Snapchat/i, "Snapchat"],
  [/LinkedInApp/i, "LinkedIn"],
];

export function detectInApp(ua: string): InAppName | null {
  for (const [re, name] of IN_APP) if (re.test(ua)) return name;
  // A bare Android WebView ("; wv)") is some app's own browser. iOS has no such token, so an iPhone UA with no
  // "Safari/" and no known browser token is handled in detectEnvironment.
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return "this app";
  return null;
}

export function detectOs(ua: string, maxTouchPoints = 0): Os {
  if (/iPhone|iPod/.test(ua)) return "ios";
  if (/iPad/.test(ua)) return "ipados";
  // iPadOS 13 and later says it is a Mac; a Mac has no touch screen.
  if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "ipados";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function detectBrowser(ua: string, os: Os): BrowserName {
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return "edge";
  if (/FxiOS|Firefox/.test(ua)) return "firefox";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/OPR\/|OPiOS|Opera/.test(ua)) return "opera";
  if (/CriOS/.test(ua)) return "chrome";
  if (/Chrome\//.test(ua) || /Chromium/.test(ua)) return "chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "safari";
  if (os === "ios" || os === "ipados") return /Safari\//.test(ua) ? "safari" : "other";
  return "other";
}

export function detectEnvironment(f: BrowserFacts): Environment {
  const ua = f.userAgent || "";
  const os = detectOs(ua, f.maxTouchPoints ?? 0);
  let inApp = detectInApp(ua);
  const browser = detectBrowser(ua, os);
  // An iPhone or iPad web view (no "Safari/" token, and none of the iOS browser apps) is some app's own browser.
  if (!inApp && (os === "ios" || os === "ipados") && browser === "other") inApp = "this app";
  const standalone = !!f.displayModeStandalone || f.navigatorStandalone === true;
  return { standalone, os, browser, inApp };
}

export type InstallMode =
  /** Opened from the icon: no screen. */
  | "none-standalone"
  /** Chromium that fired (or may still fire) beforeinstallprompt: Install button. */
  | "prompt"
  /** Chromium on Android or desktop whose prompt has not arrived yet: wait a moment, then give up. */
  | "wait"
  /** Safari on iPhone or iPad: Share, then Add to Home Screen. */
  | "ios-safari"
  /** Chrome, Firefox or Edge on iPhone or iPad: the same steps from their Share menu, with the Safari fallback. */
  | "ios-other"
  /** Inside Instagram, WhatsApp and the rest: open in Safari or Chrome, with a copy-link button. */
  | "in-app"
  /** A desktop (or other) browser that cannot install this app: nothing to offer, so no screen. */
  | "none-cannot-install";

const CHROMIUM: BrowserName[] = ["chrome", "edge", "samsung", "opera"];

export function installMode(env: Environment, hasPrompt: boolean): InstallMode {
  if (env.standalone) return "none-standalone";
  if (env.inApp) return "in-app";
  if (env.os === "ios" || env.os === "ipados") {
    if (env.browser === "safari") return "ios-safari";
    return "ios-other";
  }
  if (CHROMIUM.includes(env.browser)) return hasPrompt ? "prompt" : "wait";
  return "none-cannot-install";
}

/** Does this mode draw the install screen (now or once the prompt arrives)? */
export function showsScreen(mode: InstallMode): boolean {
  return mode === "prompt" || mode === "ios-safari" || mode === "ios-other" || mode === "in-app";
}

/** Paths that never get the screen: the staff admin pages (a desktop work tool, never installed by the public) and the
 *  server-only routes (API, the invite redirect, build files). Share pages and everything else a person opens do get it. */
const EXCLUDED = ["/admin", "/api", "/_next", "/go/"];
export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED.some((p) => (p.endsWith("/") ? pathname.startsWith(p) && pathname !== "/go" : pathname === p || pathname.startsWith(p + "/")));
}
