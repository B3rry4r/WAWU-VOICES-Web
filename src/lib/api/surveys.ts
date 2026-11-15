import type { components } from "./types";
import { apiFetch } from "./client";

type S = components["schemas"];
export type SurveyCard = S["SurveyCard"];
export type Survey = S["Survey"];
export type SurveyQuestionView = S["SurveyQuestionView"];
export type SurveyEventKind = S["SurveyEventRequest"]["kind"];
export type SurveyResponseRequest = S["SurveyResponseRequest"];
export type SurveyAnswerInput = S["SurveyAnswerInput"];
export type SurveyResponseResult = S["SurveyResponseResult"];
export type BrandPage = S["BrandPage"];
export type BrandAdCard = S["BrandAdCard"];
export type BrandSurveyCard = S["BrandSurveyCard"];

const enc = encodeURIComponent;

/** The Sponsored Survey for the feed slot, or null where none may show. A failed call is also null: the card is simply left out. */
export async function getSurveyPlacement(): Promise<SurveyCard | null> {
  try {
    const r = await apiFetch<S["SurveyPlacementResponse"]>("/surveys/placement", { authed: true });
    return r?.survey ?? null;
  } catch {
    return null;
  }
}

/** One survey to answer. `myStatus` ANSWERED comes back with no questions. A signed-in person with a finished profile only. */
export const getSurvey = (id: string) => apiFetch<Survey>(`/surveys/${enc(id)}`, { authed: true });

/**
 * VIEW (the card was seen), START (the first question opened), SKIP (the person left it). Never throws: a lost count must not stop the person.
 * `keepalive` lets the request finish while the page closes (leaving by Back, closing the tab). A beacon cannot carry the sign-in header, so fetch is used.
 */
export const recordSurveyEvent = (id: string, kind: SurveyEventKind, opts?: { keepalive?: boolean; expectSubject?: string }): Promise<void> =>
  apiFetch<void>(`/surveys/${enc(id)}/events`, { method: "POST", authed: true, body: { kind }, ...(opts?.keepalive ? { keepalive: true } : {}), ...(opts?.expectSubject !== undefined ? { expectSubject: opts.expectSubject } : {}) }).then(
    () => undefined,
    () => undefined,
  );

/** One answer per person. A second one is a 409 (the caller shows the Done screen). Free: no tokens, no free post. */
export const answerSurvey = (id: string, body: SurveyResponseRequest, idempotencyKey?: string, expectSubject?: string) =>
  apiFetch<SurveyResponseResult>(`/surveys/${enc(id)}/responses`, {
    method: "POST",
    authed: true,
    body,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(expectSubject !== undefined ? { expectSubject } : {}),
  });

/** A brand's public page by its slug. No sign-in needed. */
export const getBrandPage = (slug: string) => apiFetch<BrandPage>(`/brands/${enc(slug)}`);
