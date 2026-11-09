import type { PublicConfig } from "@/lib/api/feed";

/** "138" or "138.50": the smallest token pack in naira, from the config (never typed). */
export function nairaFromKobo(kobo: number, always2 = false): string {
  const n = kobo / 100;
  return n.toLocaleString("en-NG", { minimumFractionDigits: always2 || kobo % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

export const fromPrice = (cfg: PublicConfig): string => nairaFromKobo(cfg.costs.minPackKobo);

/** What a text post costs in naira ("6.90"): milli-tokens of a token worth `baseKoboPerUnit`. */
export function textPostNaira(cfg: PublicConfig): { units: string; naira: string } {
  const units = cfg.costs.textPostMilli / 1000;
  const kobo = Math.round((cfg.costs.textPostMilli * cfg.costs.baseKoboPerUnit) / 1000);
  return { units: String(units), naira: nairaFromKobo(kobo, true) };
}
