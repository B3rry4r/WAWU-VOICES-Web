import { countryByCode, DIAL_COUNTRIES, type DialCountry } from "./countries";

export type PhoneRead = { ok: true; e164: string; national: string } | { ok: false; reason: "empty" | "invalid" };

/**
 * What a person typed, as one full international number: "+" and the country's dial code and the national number with
 * its trunk 0 dropped ("0803 214 7720" in Nigeria is "+2348032147720"). A number typed with its own "+" or "00" is read on
 * its own. The same form the Who Made This app sends to WAWU ID.
 */
export function readPhone(typed: string, country: DialCountry | string = "NG"): PhoneRead {
  const c = typeof country === "string" ? countryByCode(country) : country;
  let s = typed.trim().replace(/[\s\-().]/g, "");
  if (s === "" || s === "+") return { ok: false, reason: "empty" };
  if (!/^\+?\d+$/.test(s)) return { ok: false, reason: "invalid" };
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  const digits = s.replace(/\D/g, "");
  let full: string;
  if (s.startsWith("+")) full = digits;
  else if (digits.startsWith(c.dial) && digits.length >= c.dial.length + 8) full = digits;
  else full = c.dial + digits.replace(/^0+/, "");
  // A trunk 0 kept after the code ("+234 0803...") is the same number without it.
  if (full.startsWith(c.dial) && full[c.dial.length] === "0") full = c.dial + full.slice(c.dial.length + 1);
  if (full.length < 8 || full.length > 15) return { ok: false, reason: "invalid" };
  // Nigeria: ten digits after 234, starting 7, 8 or 9 (the rule WAWU ID applies).
  if (full.startsWith("234") && !/^234[789]\d{9}$/.test(full)) return { ok: false, reason: "invalid" };
  return { ok: true, e164: `+${full}`, national: full.startsWith(c.dial) ? full.slice(c.dial.length) : full };
}

/** True when the text looks like a phone number rather than an email: digits, spaces, dashes, brackets, a leading "+", and nothing else. */
export function looksLikePhone(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && /^\+?[\d\s\-().]+$/.test(t) && /\d/.test(t);
}

/** Where several countries share one code, the one people mean. */
const MAIN = new Set(["GB", "US", "RU", "IT", "RE"]);

/** The country a full number belongs to: the one whose dial code starts it, the longest code first, the chosen country winning a tie. */
export function countryForNumber(e164: string, preferred: string = "NG"): DialCountry {
  const digits = e164.replace(/\D/g, "");
  const hits = DIAL_COUNTRIES.filter((c) => digits.startsWith(c.dial));
  if (hits.length === 0) return countryByCode(preferred);
  const longest = Math.max(...hits.map((c) => c.dial.length));
  const best = hits.filter((c) => c.dial.length === longest);
  return best.find((c) => c.code === preferred) ?? best.find((c) => MAIN.has(c.code)) ?? best[0];
}
