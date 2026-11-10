/**
 * Runs in <head> before first paint (like the theme script). It does one thing: it keeps the browser's
 * `beforeinstallprompt` (it can fire before React has loaded) on window.__voicesInstall and tells the screen when it
 * arrives. It hides nothing: the app is never covered by CSS while the page waits, so no visitor sees a blank page.
 * The install screen (a client component) is drawn over the app only when it applies: at once on iPhone, iPad and in-app
 * browsers, and on Chrome, Edge and Samsung only when the browser offers install.
 */
export const INSTALL_DISMISSED_KEY = "voices-install-continue";

export const INSTALL_SCRIPT = `(function(){try{
var w=window;
w.__voicesInstall=null;
w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w.__voicesInstall=e;try{w.dispatchEvent(new Event("voices-install-ready"));}catch(x){}});
}catch(e){}})();`;
