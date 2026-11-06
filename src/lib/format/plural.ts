/** "1 vote", "0 votes", "12 reactions": plural for every count except exactly 1 (sibling of the vx voicesText helper). */
export function countText(n: number, one: string, many: string = one + "s"): string {
  return `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;
}
