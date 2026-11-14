export interface Counted { responses: number; share: number }
/** Rows under the floor are dropped; their counts go into "Other" when the server sent one. "Other" itself is drawn only when it reaches the floor. */
export function underFloor<T extends Counted>(rows: T[], other: Counted | null | undefined, floor: number): { rows: T[]; other: Counted | null } {
  const keep = rows.filter((x) => x.responses >= floor);
  const dropped = rows.filter((x) => x.responses < floor);
  let o: Counted | null = other ?? null;
  if (o && dropped.length) o = { responses: o.responses + dropped.reduce((n, x) => n + x.responses, 0), share: o.share + dropped.reduce((n, x) => n + x.share, 0) };
  return { rows: keep, other: o && o.responses >= floor ? o : null };
}

