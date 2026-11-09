import type { components } from "./types";
import { apiFetch } from "./client";

type S = components["schemas"];
export type Mood = S["Mood"];
export type MoodCounts = S["MoodCounts"];
export type WhereYouSit = S["WhereYouSit"];

const id = encodeURIComponent;

/** LCH-02: valid answers per word on a mood question (the "How Nigeria feels so far" bar). */
export const getQuestionMoods = (qid: string) => apiFetch<MoodCounts>(`/questions/${id(qid)}/moods`, { authed: true });
/** LCH-04: where the signed-in person's own word sits, in Nigeria and the World. */
export const getWhereYouSit = (aid: string) => apiFetch<WhereYouSit>(`/answers/${id(aid)}/where-you-sit`, { authed: true });
/** LCH-03: "Show my name on the card" for one of my mood answers. */
export const setCardName = (aid: string, showName: boolean) =>
  apiFetch<S["CardNameResult"]>(`/answers/${id(aid)}/card`, { method: "PATCH", authed: true, body: { showName } });
