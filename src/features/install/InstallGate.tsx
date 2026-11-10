"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download } from "lucide-react";
import { Button, Logo } from "@/components/vx";
import { detectEnvironment, installMode, isExcludedPath, showsScreen, type Environment, type InstallMode } from "@/lib/install/detect";
import { keepAddress, safeAddress, takeKeptAddress } from "@/lib/install/address";
import { INSTALL_DISMISSED_KEY } from "@/lib/install/boot-script";
import { PicAddRow, PicHome, PicOpenIn, PicShare } from "./StepPictures";
import "./install.css";

/** What Chromium hands us for `beforeinstallprompt`. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type WithPrompt = Window & { __voicesInstall?: InstallPromptEvent | null };

/** How long a Chromium browser is given to offer its prompt before we stop waiting (already installed, or it will not). */
export const PROMPT_WAIT_MS = 1200;

function readFacts(w: Window) {
  let display = false;
  try {
    display = ["standalone", "fullscreen", "minimal-ui"].some((m) => w.matchMedia(`(display-mode: ${m})`).matches);
  } catch { /* no matchMedia */ }
  return {
    userAgent: w.navigator.userAgent,
    maxTouchPoints: w.navigator.maxTouchPoints,
    displayModeStandalone: display,
    navigatorStandalone: (w.navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

function setMark(v: "show" | null) {
  try {
    if (v) document.documentElement.setAttribute("data-install", v);
    else document.documentElement.removeAttribute("data-install");
  } catch { /* nothing to mark */ }
}

function rememberContinue() {
  try { window.sessionStorage.setItem(INSTALL_DISMISSED_KEY, "1"); } catch { /* storage may be off */ }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * V-41: the install screen. Mounted once in the root layout, after the app root. It renders nothing on the server and on
 * the first client render, so server HTML (share cards, admin, crawlers) never carries it; after load it decides from the
 * browser (src/lib/install/detect.ts) and either reveals the app or draws the screen in front of it. The app stays mounted
 * behind the screen, so the address that was opened (an invite, a share link, a payment return) is already loaded:
 * "Continue in the browser" just takes the screen away. Opened from the icon (standalone) it never draws.
 */
export function InstallGate() {
  const router = useRouter();
  const [env, setEnv] = useState<Environment | null>(null);
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [hasPrompt, setHasPrompt] = useState(false);
  const [phase, setPhase] = useState<"deciding" | "show" | "off">("deciding");
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState<"idle" | "yes" | "no">("idle");
  const heading = useRef<HTMLHeadingElement>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  const decide = useCallback(() => {
    const w = window as WithPrompt;
    const facts = readFacts(w);
    const e = detectEnvironment(facts);
    const prompt = !!w.__voicesInstall;
    const m = installMode(e, prompt);
    setEnv(e);
    setMode(m);
    setHasPrompt(prompt);
    return { e, m };
  }, []);

  useEffect(() => {
    const w = window as WithPrompt;
    const path = w.location.pathname;
    const { e, m } = decide();
    if (e.standalone) {
      // Opened from the icon: never a screen. If the person installed from a link, take them to it once.
      setPhase("off");
      setMark(null);
      if (path === "/") {
        const kept = takeKeptAddress();
        if (kept && kept !== "/") routerRef.current.replace(kept);
      }
      return;
    }
    let continued = false;
    try { continued = w.sessionStorage.getItem(INSTALL_DISMISSED_KEY) === "1"; } catch { /* storage may be off */ }
    if (isExcludedPath(path) || continued) { setPhase("off"); setMark(null); return; }
    if (showsScreen(m)) { setPhase("show"); setMark("show"); return; }
    if (m !== "wait") { setPhase("off"); setMark(null); return; }

    // Chromium without its prompt yet: give it a moment, then step aside.
    let done = false;
    const onReady = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      decide();
      setPhase("show");
      setMark("show");
    };
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      setPhase("off");
      setMark(null);
    }, PROMPT_WAIT_MS);
    w.addEventListener("voices-install-ready", onReady);
    w.addEventListener("beforeinstallprompt", onReady);
    return () => {
      done = true;
      window.clearTimeout(timer);
      w.removeEventListener("voices-install-ready", onReady);
      w.removeEventListener("beforeinstallprompt", onReady);
    };
  }, [decide]);

  // Installed from the browser menu or from our button: the screen has done its job.
  useEffect(() => {
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // The app behind the screen is not reachable by keyboard or a screen reader while the screen is up.
  useEffect(() => {
    const root = document.getElementById("app-root");
    if (!root) return;
    if (phase === "show") root.setAttribute("inert", "");
    else root.removeAttribute("inert");
    if (phase === "show") heading.current?.focus();
    return () => root.removeAttribute("inert");
  }, [phase]);

  const current = () => {
    const a = safeAddress(window.location.pathname + window.location.search + window.location.hash);
    return a ?? "/";
  };

  const cont = () => {
    rememberContinue();
    setPhase("off");
    setMark(null);
  };

  const install = async () => {
    const ev = (window as WithPrompt).__voicesInstall;
    if (!ev) return;
    keepAddress(current());
    (window as WithPrompt).__voicesInstall = null;
    setHasPrompt(false);
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch { /* the browser refused; the steps below still apply */ }
  };

  const copy = async () => {
    const ok = await copyText(window.location.href);
    setCopied(ok ? "yes" : "no");
    window.setTimeout(() => setCopied("idle"), 3000);
  };

  if (phase !== "show" || !env || !mode) return null;

  const ios = env.os === "ios" || env.os === "ipados";
  const ipad = env.os === "ipados";
  const where = env.os === "android" ? "Chrome" : "Safari";
  const copyLabel = copied === "yes" ? "Link copied" : "Copy link";
  const copyBtn = (
    <Button variant="secondary" block onClick={copy}>
      <span className="ig-btnrow">{copied === "yes" ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}{copyLabel}</span>
    </Button>
  );
  const status = <p className="ig-status" role="status" aria-live="polite">{copied === "yes" ? "Link copied. Paste it in your browser." : copied === "no" ? "Could not copy. Press and hold the address to copy it." : ""}</p>;

  let title = "Add VOICES to your home screen";
  let lede = "VOICES works best as an app. It opens full screen and sits one tap away.";
  let body: React.ReactNode = null;

  if (installed) {
    title = "VOICES is on its way";
    lede = "";
    body = <p className="ig-done">Open VOICES from your home screen or your apps. You can carry on here in the meantime.</p>;
  } else if (mode === "prompt") {
    body = (
      <div className="ig-actions">
        {hasPrompt ? (
          <Button block size="l" onClick={install}><span className="ig-btnrow"><Download size={22} aria-hidden="true" />Install VOICES</span></Button>
        ) : (
          <p className="ig-note">To install later, use “Install” or “Add to Home screen” in your browser menu.</p>
        )}
      </div>
    );
  } else if (mode === "ios-safari" || mode === "ios-other") {
    const browser = env.browser === "chrome" ? "Chrome" : env.browser === "firefox" ? "Firefox" : env.browser === "edge" ? "Edge" : "Safari";
    body = (
      <>
        <ol className="ig-steps">
          <li className="ig-step">
            <span className="ig-step__n" aria-hidden="true">1</span>
            <span className="ig-step__t">{mode === "ios-safari" ? `Tap the Share button ${ipad ? "at the top" : "at the bottom"} of Safari.` : `Tap the Share button next to the address in ${browser}.`}</span>
            <div className="ig-step__pic"><PicShare ipad={ipad || mode === "ios-other"} browser={browser} /></div>
          </li>
          <li className="ig-step">
            <span className="ig-step__n" aria-hidden="true">2</span>
            <span className="ig-step__t">Scroll down and choose “Add to Home Screen”.</span>
            <div className="ig-step__pic"><PicAddRow /></div>
          </li>
          <li className="ig-step">
            <span className="ig-step__n" aria-hidden="true">3</span>
            <span className="ig-step__t">Tap “Add”. Then open VOICES from your home screen.</span>
            <div className="ig-step__pic"><PicHome /></div>
          </li>
        </ol>
        {mode === "ios-other" ? (
          <div className="ig-actions">
            <p className="ig-note">Cannot see “Add to Home Screen”? Open this page in Safari instead.</p>
            {copyBtn}
            {status}
          </div>
        ) : null}
      </>
    );
  } else if (mode === "in-app") {
    const app = env.inApp ?? "this app";
    title = "Open VOICES in your browser";
    lede = app === "this app"
      ? `This link opened inside another app, which cannot install VOICES. Open it in ${where} instead.`
      : `${app} opens links in its own small browser, which cannot install VOICES. Open it in ${where} instead.`;
    body = (
      <>
        <ol className="ig-steps">
          <li className="ig-step">
            <span className="ig-step__n" aria-hidden="true">1</span>
            <span className="ig-step__t">Tap the menu (three dots) or the Share button in the corner.</span>
            <div className="ig-step__pic"><PicOpenIn browser={where} /></div>
          </li>
          <li className="ig-step">
            <span className="ig-step__n" aria-hidden="true">2</span>
            <span className="ig-step__t">Choose “Open in {where}” (or “Open in browser”).</span>
          </li>
          <li className="ig-step">
            <span className="ig-step__n" aria-hidden="true">3</span>
            <span className="ig-step__t">{ios ? "Then add VOICES to your home screen from Safari." : "Then tap Install VOICES."}</span>
          </li>
        </ol>
        <div className="ig-actions">
          <p className="ig-note">Or copy the link and paste it into {where}.</p>
          {copyBtn}
          {status}
        </div>
      </>
    );
  }

  return (
    <div className="ig-root" role="dialog" aria-modal="true" aria-labelledby="ig-title" data-install-mode={mode}>
      <div className="ig-card">
        <div className="ig-logo"><Logo height={36} alt="" /></div>
        <h1 id="ig-title" className="ig-title" ref={heading} tabIndex={-1}>{title}</h1>
        {lede ? <p className="ig-lede">{lede}</p> : null}
        {body}
        <button type="button" className="ig-continue" onClick={cont}>Continue in the browser</button>
      </div>
    </div>
  );
}
