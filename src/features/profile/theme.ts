"use client";
export type ThemeChoice = "light" | "dark" | "system";
const KEY = "voices-theme";

const isChoice = (v: unknown): v is ThemeChoice => v === "light" || v === "dark" || v === "system";

/** What this device saved ("voices-theme"), or null when it has made no choice. */
export function deviceChoice(): ThemeChoice | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return isChoice(v) ? v : null;
  } catch {
    return null;
  }
}

/** Sets data-theme on <html>; "system" removes it so the tokens follow the device. Saves nothing. */
export function applyTheme(t: ThemeChoice): void {
  if (typeof document === "undefined") return;
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

/** The person chose a theme on this device (Settings): it shows now and is saved here, and Settings also writes it to the account. */
export function chooseTheme(t: ThemeChoice): void {
  applyTheme(t);
  try { window.localStorage.setItem(KEY, t); } catch { /* storage unavailable: the choice still applies this visit */ }
}

/** The account's setting: the device's own choice wins, so this applies only when the device has none, and it never saves over the device. */
export function applyAccountTheme(account: ThemeChoice): void {
  const device = deviceChoice();
  if (device) return applyTheme(device);
  applyTheme(account);
}
