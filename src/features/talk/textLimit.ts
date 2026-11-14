"use client";
import { useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/api/units";

/** The longest a written post can be when the public config does not say (the owner's order of 14 Nov 2026). The one place the number is held. */
export const TEXT_MAX_CHARS_FALLBACK = 2500;

/** The limit from a costs block (`costs.textMaxChars` of /config/public or /me/allowance), else the fallback. */
export function textLimit(costs?: { textMaxChars?: number | null } | null): number {
  const n = costs?.textMaxChars;
  return typeof n === "number" && n > 0 ? n : TEXT_MAX_CHARS_FALLBACK;
}

/** The plain words shown when a person reaches the limit. */
export function limitWords(limit: number): string {
  return `Keep it to ${limit.toLocaleString("en-NG")} characters.`;
}

let cached: number | null = null;
/** The limit for a screen that has no costs block of its own (the edit sheet): the fallback at once, the config's number when it arrives. */
export function useTextLimit(): number {
  const [n, setN] = useState(cached ?? TEXT_MAX_CHARS_FALLBACK);
  useEffect(() => {
    if (cached !== null) return;
    let live = true;
    getPublicConfig().then((c) => { cached = textLimit(c.costs); if (live) setN(cached); }, () => undefined);
    return () => { live = false; };
  }, []);
  return n;
}
