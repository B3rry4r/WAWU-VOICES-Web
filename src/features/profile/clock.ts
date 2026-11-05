/** 8 -> "0:08", 65 -> "1:05". */
export function clock(s: number): string {
  const t = Math.max(0, Math.round(s));
  return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
}
