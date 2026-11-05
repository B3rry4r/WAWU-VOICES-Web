import { ApiError } from "@/lib/api/client";

export interface PostForm {
  state: string;
  lga: string;
  ward: string;
  pollingUnit: string;
  accredited: string;
  votesCast: string;
  rejected: string;
}

export type FieldName = keyof PostForm;
export type FieldErrors = Partial<Record<FieldName, string>>;

export const EMPTY_FORM: PostForm = { state: "", lga: "", ward: "", pollingUnit: "", accredited: "", votesCast: "", rejected: "" };
export const MAX_TOTAL = 100000;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const WORDS: Record<FieldName, string> = {
  state: "State",
  lga: "Local government",
  ward: "Ward",
  pollingUnit: "Polling unit",
  accredited: "Accredited",
  votesCast: "Votes cast",
  rejected: "Rejected",
};

function whole(v: string): number | null {
  return /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
}

/** Same rules as the server (it re-checks): all seven filled, totals are whole numbers, no more votes than accredited, no more rejected than votes. */
export function validate(f: PostForm): FieldErrors {
  const e: FieldErrors = {};
  for (const k of ["state", "lga", "ward", "pollingUnit"] as const) if (!f[k].trim()) e[k] = `Add the ${WORDS[k].toLowerCase()}.`;
  for (const k of ["state", "lga", "ward"] as const) if (!e[k] && f[k].trim().length > 80) e[k] = "Use 80 characters or fewer.";
  if (!e.pollingUnit && f.pollingUnit.trim().length > 120) e.pollingUnit = "Use 120 characters or fewer.";
  const n = { accredited: whole(f.accredited), votesCast: whole(f.votesCast), rejected: whole(f.rejected) };
  for (const k of ["accredited", "votesCast", "rejected"] as const) {
    if (f[k].trim() === "") e[k] = "Add the number.";
    else if (n[k] === null) e[k] = "Use whole numbers only.";
    else if ((n[k] as number) > MAX_TOTAL) e[k] = "That number is too large.";
  }
  if (!e.votesCast && !e.accredited && (n.votesCast as number) > (n.accredited as number)) e.votesCast = "Votes cast cannot be more than the number accredited.";
  if (!e.rejected && !e.votesCast && (n.rejected as number) > (n.votesCast as number)) e.rejected = "Rejected votes cannot be more than the votes cast.";
  return e;
}

export function toRequest(f: PostForm) {
  return {
    state: f.state.trim(),
    lga: f.lga.trim(),
    ward: f.ward.trim(),
    pollingUnit: f.pollingUnit.trim(),
    accredited: Number(f.accredited),
    votesCast: Number(f.votesCast),
    rejected: Number(f.rejected),
  };
}

/** Maps a 422 `details.fields` list from the server onto the form's fields. */
export function serverFieldErrors(err: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!(err instanceof ApiError)) return out;
  const d = err.details as { fields?: { path?: string; message?: string }[] } | undefined;
  for (const f of d?.fields ?? []) {
    if (f.path && f.path in WORDS && f.message) out[f.path as FieldName] = f.message;
  }
  return out;
}

/** The sentence under the Post button when the server refused for a reason that is not one field. */
export function postErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.explained) return err.message;
    if (err.code === "OFFLINE" || err.code === "TIMEOUT") return "Could not reach VOICES. Check your connection and try again.";
  }
  return "Something went wrong. Try again.";
}
