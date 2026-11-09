import { ApiError } from "./client";

/** The words nginx's busy page, the API's own busy answer and the share page say (G1). Keep them in step. */
export const BUSY_TITLE = "We are busy.";
export const BUSY_TEXT = "Try again in a minute.";
export const BUSY_WORDS = `${BUSY_TITLE} ${BUSY_TEXT}`;

/**
 * True when the API could not be reached or said it is full: 502, 503 or 504 (nginx's answer when the API is down or slow,
 * or the API's own busy answer). A lost connection in the browser (status 0) stays "You are offline": the phone cannot
 * tell the two apart and the person's own connection is the likelier cause.
 */
export function isBusy(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 502 || e.status === 503 || e.status === 504);
}
