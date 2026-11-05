"use client";
export type ThemeChoice = "light" | "dark" | "system";
const KEY = "voices-theme";

/** Sets data-theme on <html>; "system" removes it so the tokens follow the device. */
export function applyTheme(t: ThemeChoice): void {
  if (typeof document === "undefined") return;
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try { window.localStorage.setItem(KEY, t); } catch { /* storage unavailable: the choice still applies this visit */ }
}
