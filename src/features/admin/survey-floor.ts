/** One rule for every row: no answers at all is drawn as 0; 1 to floor minus 1 answers are never drawn; the floor or more is drawn. */
export const rowShown = (responses: number | null | undefined, floor: number): boolean => responses === 0 || (typeof responses === "number" && responses >= floor);
/** A choice row is drawn with its number unless the server hid it or it is under the floor, whatever the server sent. */
export const choiceShown = (o: { hidden?: boolean; count: number | null }, floor: number): boolean => !o.hidden && rowShown(o.count, floor);
/** "Other" on a choice question is drawn only when it reaches the floor. */
export const otherShown = (o: { count: number } | null | undefined, floor: number): boolean => !!o && o.count >= floor;

export interface Counted { responses: number; share: number }
/** Rows under the floor are dropped; their counts go into "Other" when the server sent one. "Other" itself is drawn only when it reaches the floor. */
export function underFloor<T extends Counted>(rows: T[], other: Counted | null | undefined, floor: number): { rows: T[]; other: Counted | null } {
  const keep = rows.filter((x) => rowShown(x.responses, floor));
  const dropped = rows.filter((x) => !rowShown(x.responses, floor));
  let o: Counted | null = other ?? null;
  if (o && dropped.length) o = { responses: o.responses + dropped.reduce((n, x) => n + x.responses, 0), share: o.share + dropped.reduce((n, x) => n + x.share, 0) };
  return { rows: keep, other: o && o.responses >= floor ? o : null };
}

