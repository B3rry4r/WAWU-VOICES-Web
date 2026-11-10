/**
 * Runs in <head> before first paint (like the theme script). It does three things and nothing else:
 *  1. keeps the browser's `beforeinstallprompt` (it can fire before React has loaded) on window.__voicesInstall;
 *  2. when this could be an install-screen visit (not opened from the icon, not an excluded path, not already continued
 *     in this tab, and a browser that may show a screen), marks <html data-install="pending">, so the page is hidden
 *     for the moment it takes to decide, never flashing the app first. The CSS has a timed failsafe that reveals it;
 *  3. nothing runs during server rendering of the page body: the screen itself is a client component that mounts after load.
 * Keep the standalone and excluded-path rules in step with src/lib/install/detect.ts.
 */
export const INSTALL_DISMISSED_KEY = "voices-install-continue";

export const INSTALL_SCRIPT = `(function(){try{
var d=document.documentElement,w=window,n=navigator;
w.__voicesInstall=null;
w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w.__voicesInstall=e;try{w.dispatchEvent(new Event("voices-install-ready"));}catch(x){}});
var sa=false;try{sa=!!(w.matchMedia&&(w.matchMedia("(display-mode: standalone)").matches||w.matchMedia("(display-mode: fullscreen)").matches||w.matchMedia("(display-mode: minimal-ui)").matches))||n.standalone===true;}catch(e){}
if(sa)return;
var p=w.location.pathname;
if(/^\\/(admin|api|_next)(\\/|$)/.test(p)||/^\\/go\\/./.test(p))return;
var dm=false;try{dm=w.sessionStorage.getItem(${JSON.stringify(INSTALL_DISMISSED_KEY)})==="1";}catch(e){}
if(dm)return;
var ua=n.userAgent||"";
var mobile=/iPhone|iPod|iPad|Android/.test(ua)||(/Macintosh/.test(ua)&&(n.maxTouchPoints||0)>1);
var chromium=/Chrome\\/|CriOS|SamsungBrowser/.test(ua)&&!/FxiOS/.test(ua);
if(mobile||chromium)d.setAttribute("data-install","pending");
}catch(e){}})();`;
