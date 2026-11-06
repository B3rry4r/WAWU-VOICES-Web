/** "1 vote", "0 votes", "12 reactions": plural for every count except exactly 1 (sibling of the vx voicesText helper). */
export function countText(n: number, one: string, many: string = one + "s"): string {
  return `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;
}

/** lead ruling WF, 6 Nov (A-L4): a poll's results list the leader first. Stable: options with equal votes keep their authored order. */
export function leaderFirst<T extends { votes?: number | null }>(options: T[]): T[] {
  return options.map((o, i) => ({ o, i })).sort((a, b) => (b.o.votes ?? 0) - (a.o.votes ?? 0) || a.i - b.i).map((x) => x.o);
}
