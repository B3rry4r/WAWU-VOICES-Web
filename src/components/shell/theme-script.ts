/**
 * Runs in <head> before first paint: applies the saved theme (localStorage "voices-theme": "light" or "dark";
 * "system" or nothing leaves data-theme off so the tokens follow the device). Storage may throw: then the device decides.
 */
export const THEME_KEY = "voices-theme";

export const THEME_SCRIPT = `(function(){try{var t=window.localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
