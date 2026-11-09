/**
 * Text and voice prices, pure and dependency free. The web keeps a copy of this file (`npm run sync:shared`), so the
 * character count and the price shown before posting are the ones the server charges (LCH-10).
 */

/**
 * The one character count: Unicode code points of the text as sent (spaces and punctuation count). An emoji is one
 * character, a letter with a combining mark is two, the same on the server and in the browser.
 */
export function countChars(text: string): number {
  return [...text].length;
}

/**
 * Milli-tokens for a text of `chars` characters when `blockMilli` buys `blockChars` characters (5 tokens per 150), in
 * proportion and rounded to the hundredth of a token (500 characters is 16.67 tokens, so 16670 milli). Integer maths only.
 */
export function textCostMilli(
  chars: number,
  blockMilli: number,
  blockChars: number,
): number {
  if (!(chars > 0) || !(blockChars > 0)) return 0;
  const hundredths = Math.floor(
    (2 * chars * blockMilli + blockChars * 10) / (2 * blockChars * 10),
  );
  return hundredths * 10;
}

/** Milli-tokens for a voice message of this length: the up-to-30-second price, or the longer one. */
export function voiceCostMilli(
  durationMs: number,
  tier1Milli: number,
  tier2Milli: number,
  tier1Seconds = 30,
): number {
  return durationMs <= tier1Seconds * 1000 ? tier1Milli : tier2Milli;
}

/** Tokens as people read them: up to 2 decimals, no trailing zeros ("3.33", "16.67", "78"). */
export function tokensLabel(milli: number): string {
  const hundredths = Math.round(milli / 10);
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac === 0) return w;
  return `${w}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}
