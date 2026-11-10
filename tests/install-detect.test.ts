import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { detectEnvironment, installMode, isExcludedPath, showsScreen, detectInApp } from "@/lib/install/detect";
import { KEPT_ADDRESS_KEY, clearKeptAddress, keepAddress, safeAddress, takeKeptAddress } from "@/lib/install/address";
import { INSTALL_SCRIPT } from "@/lib/install/boot-script";

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipadSafari: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1",
  iosFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15",
  iosEdge: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/124.0.2478.50 Mobile/15E148 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
  desktopChrome: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  desktopEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  desktopFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
  desktopSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  instagramIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 Instagram 330.0.0.20.113 (iPhone14,5; iOS 17_4; en_NG; en; scale=3.00; 1170x2532; 570812455)",
  instagramAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.35.108 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8)",
  facebookIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 [FBAN/FBIOS;FBAV/450.0.0.38.108;FBBV/565;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]",
  facebookAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]",
  messengerIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 [FBAN/MessengerForiOS;FBAV/450.0.0.38.108;FBBV/565;FBDV/iPhone14,5]",
  messengerAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/450.0.0.38.108;]",
  whatsapp: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.8.80",
  whatsappIosWebView: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  twitterIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.30",
  twitterAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 TwitterAndroid",
  tiktok: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 trill_340000 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.0.0 BytedanceWebview/d8a21c6",
  snapchat: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.80.0.40 (like Safari/8618.1.15.10.14, panda)",
  linkedin: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1",
};
const env = (userAgent: string, extra: Partial<Parameters<typeof detectEnvironment>[0]> = {}) => detectEnvironment({ userAgent, ...extra });

describe("install detection", () => {
  it("standalone: display-mode or navigator.standalone, and never a screen", () => {
    const a = env(UA.androidChrome, { displayModeStandalone: true });
    expect(a.standalone).toBe(true);
    expect(installMode(a, true)).toBe("none-standalone");
    const b = env(UA.iosSafari, { navigatorStandalone: true });
    expect(b.standalone).toBe(true);
    expect(installMode(b, false)).toBe("none-standalone");
    expect(showsScreen(installMode(b, false))).toBe(false);
    expect(env(UA.iosSafari).standalone).toBe(false);
  });

  it("iPhone Safari gets the Share steps", () => {
    const e = env(UA.iosSafari);
    expect([e.os, e.browser, e.inApp]).toEqual(["ios", "safari", null]);
    expect(installMode(e, false)).toBe("ios-safari");
  });

  it("iPad Safari, by its own UA and in desktop mode (a Mac UA with a touch screen)", () => {
    expect(installMode(env(UA.ipadSafari), false)).toBe("ios-safari");
    expect(env(UA.ipadSafari).os).toBe("ipados");
    const d = env(UA.ipadDesktopMode, { maxTouchPoints: 5 });
    expect(d.os).toBe("ipados");
    expect(installMode(d, false)).toBe("ios-safari");
    // a real Mac has no touch points
    expect(env(UA.desktopSafari, { maxTouchPoints: 0 }).os).toBe("desktop");
  });

  it("iOS Chrome, Firefox and Edge get the steps with the Safari fallback", () => {
    for (const [ua, browser] of [[UA.iosChrome, "chrome"], [UA.iosFirefox, "firefox"], [UA.iosEdge, "edge"]] as const) {
      const e = env(ua);
      expect(e.os).toBe("ios");
      expect(e.browser).toBe(browser);
      expect(e.inApp).toBeNull();
      expect(installMode(e, false)).toBe("ios-other");
    }
  });

  it("each in-app browser is told to open in Safari or Chrome", () => {
    const cases: [string, string][] = [
      [UA.instagramIos, "Instagram"], [UA.instagramAndroid, "Instagram"],
      [UA.facebookIos, "Facebook"], [UA.facebookAndroid, "Facebook"],
      [UA.messengerIos, "Messenger"], [UA.messengerAndroid, "Messenger"],
      [UA.whatsapp, "WhatsApp"],
      [UA.twitterIos, "X"], [UA.twitterAndroid, "X"],
      [UA.tiktok, "TikTok"], [UA.snapchat, "Snapchat"], [UA.linkedin, "LinkedIn"],
    ];
    for (const [ua, name] of cases) {
      expect(detectInApp(ua)).toBe(name);
      const e = env(ua);
      expect(e.inApp).toBe(name);
      expect(installMode(e, true)).toBe("in-app");
    }
  });

  it("an iPhone web view with no browser token is an app's own browser", () => {
    const e = env(UA.whatsappIosWebView);
    expect(e.inApp).toBe("this app");
    expect(installMode(e, false)).toBe("in-app");
  });

  it("an Android web view is an app's own browser, but plain Chrome and Samsung Internet are not", () => {
    expect(detectInApp(UA.androidChrome)).toBeNull();
    expect(detectInApp(UA.androidSamsung)).toBeNull();
    expect(detectInApp("Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/124.0 Mobile Safari/537.36")).toBe("this app");
  });

  it("beforeinstallprompt: Chromium with the event gets the Install button, without it waits", () => {
    for (const ua of [UA.androidChrome, UA.androidSamsung, UA.desktopChrome, UA.desktopEdge]) {
      expect(installMode(env(ua), true)).toBe("prompt");
      expect(installMode(env(ua), false)).toBe("wait");
      expect(showsScreen("prompt")).toBe(true);
      expect(showsScreen("wait")).toBe(false);
    }
  });

  it("Safari 17 or later on a Mac (Popover probe) gets the Add to Dock steps; without the probe, none (V-41)", () => {
    const m = installMode(env(UA.desktopSafari, { supportsPopover: true }), false);
    expect(m).toBe("dock-safari");
    expect(showsScreen(m)).toBe(true);
    expect(installMode(env(UA.desktopSafari, { supportsPopover: false }), false)).toBe("none-cannot-install");
    // Firefox and Chrome are never Dock browsers, whatever the probe says
    expect(installMode(env(UA.desktopFirefox, { supportsPopover: true }), false)).toBe("none-cannot-install");
    expect(installMode(env(UA.desktopChrome, { supportsPopover: true }), false)).toBe("wait");
  });

  it("desktop browsers that cannot install, and Firefox on Android, get no screen", () => {
    for (const ua of [UA.desktopFirefox, UA.desktopSafari, UA.androidFirefox]) {
      const m = installMode(env(ua), false);
      expect(m).toBe("none-cannot-install");
      expect(showsScreen(m)).toBe(false);
    }
  });

  it("the excluded paths: admin and server-only routes; share links, invites' landing and payment returns are not", () => {
    for (const p of ["/admin", "/admin/news", "/api/x", "/_next/static/a.js", "/go/ab12cd7"]) expect(isExcludedPath(p)).toBe(true);
    for (const p of ["/", "/go", "/c/music", "/s/abc1234", "/units/done", "/administrator", "/join", "/q/1"]) expect(isExcludedPath(p)).toBe(false);
  });
});

describe("the kept address (more)", () => {
  it("refuses a time in the future, a wrong clock (L2)", () => {
    const m = new Map<string, string>();
    const s = { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k) };
    keepAddress("/s/future", 9e12, s);
    expect(takeKeptAddress(1000, s)).toBeNull();
  });
  it("clearKeptAddress forgets it (sign-out)", () => {
    const m = new Map<string, string>();
    const s = { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k) };
    keepAddress("/s/abc", 100, s);
    clearKeptAddress(s);
    expect(takeKeptAddress(200, s)).toBeNull();
  });
});

describe("the kept address", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { m, setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k) };
  };
  it("keeps a same-site path with its query, and gives it back once", () => {
    const s = mem();
    keepAddress("/c/music?ref=abc#top", 1000, s);
    expect(takeKeptAddress(2000, s)).toBe("/c/music?ref=abc#top");
    expect(takeKeptAddress(2000, s)).toBeNull();
  });
  it("keeps an invite landing and a payment return", () => {
    const s = mem();
    keepAddress("/go", 0, s);
    expect(takeKeptAddress(1, s)).toBe("/go");
    keepAddress("/units/done?ref=tx_1", 0, s);
    expect(takeKeptAddress(1, s)).toBe("/units/done?ref=tx_1");
  });
  it("drops an old one (over a week) and never keeps the root", () => {
    const s = mem();
    keepAddress("/c/music", 0, s);
    expect(takeKeptAddress(8 * 86_400_000, s)).toBeNull();
    keepAddress("/", 0, s);
    expect(s.m.has(KEPT_ADDRESS_KEY)).toBe(false);
  });
  it("refuses another site, a scheme-relative address and control characters", () => {
    for (const bad of ["https://evil.test/x", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/a\nb", "", null, 5]) expect(safeAddress(bad)).toBeNull();
    const s = mem();
    s.setItem(KEPT_ADDRESS_KEY, JSON.stringify({ a: "//evil.test", t: 1 }));
    expect(takeKeptAddress(2, s)).toBeNull();
  });
});

describe("the head script", () => {
  function run(opts: { ua: string; path?: string; standalone?: boolean; navStandalone?: boolean; dismissed?: boolean; touch?: number }) {
    const attrs: Record<string, string> = {};
    const listeners: Record<string, (e: unknown) => void> = {};
    const win: Record<string, unknown> = {
      location: { pathname: opts.path ?? "/" },
      matchMedia: (q: string) => ({ matches: !!opts.standalone && q.includes("standalone") }),
      sessionStorage: { getItem: () => (opts.dismissed ? "1" : null) },
      addEventListener: (n: string, f: (e: unknown) => void) => { listeners[n] = f; },
      dispatchEvent: () => true,
    };
    const nav = { userAgent: opts.ua, maxTouchPoints: opts.touch ?? 0, standalone: opts.navStandalone };
    const doc = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } };
    vm.runInNewContext(INSTALL_SCRIPT, { window: win, navigator: nav, document: doc, Event: class {} });
    return { attrs, listeners, win };
  }
  it("hides nothing for anyone: it never marks the page (M1)", () => {
    for (const ua of [UA.iosSafari, UA.androidChrome, UA.desktopChrome, UA.desktopEdge, UA.androidSamsung, UA.desktopFirefox, UA.desktopSafari]) {
      expect(run({ ua }).attrs["data-install"]).toBeUndefined();
      expect(Object.keys(run({ ua }).attrs)).toEqual([]);
    }
  });
  it("keeps the browser's install prompt for the button", () => {
    const r = run({ ua: UA.androidChrome });
    let prevented = false;
    const ev = { preventDefault: () => { prevented = true; } };
    r.listeners["beforeinstallprompt"](ev);
    expect(prevented).toBe(true);
    expect(r.win.__voicesInstall).toBe(ev);
  });
});
