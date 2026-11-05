import type { components } from "./types";
import { apiFetch } from "./client";

type S = components["schemas"];
export type Home = S["Home"];
export type Question = S["Question"];
export type Answer = S["Answer"];
export type Topic = S["Topic"];
export type Category = S["Category"];
export type CategoryDetail = S["CategoryDetail"];
export type SearchResults = S["SearchResults"];
export type PublicConfig = S["PublicConfig"];

const GUEST_KEY = "voices-guest-id";

/** A client-made id kept in local storage, sent as X-Guest-Id so a guest's likes and ad caps can be counted (V-15). */
export function guestId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

const opts = () => {
  const g = guestId();
  return { authed: true, headers: g ? { "X-Guest-Id": g } : undefined } as const;
};

function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const getHome = () => apiFetch<Home>("/home", opts());
export const getTodaysQuestion = () => apiFetch<Question>("/questions/today", opts());
export const getTrending = (limit = 20, cursor?: string) =>
  apiFetch<S["AnswerPage"]>(`/feed/trending${qs({ limit, cursor })}`, opts());
export const getTrendingQuestions = (limit = 5) => apiFetch<S["QuestionPage"]>(`/feed/trending-questions${qs({ limit })}`, opts());
export const getCurrentTopic = () => apiFetch<Topic>("/topics/current", opts());
export const getCategories = () => apiFetch<S["CategoryList"]>("/categories", opts());
export const getCategory = (slug: string, tab: string, cursor?: string) =>
  apiFetch<CategoryDetail>(`/categories/${encodeURIComponent(slug)}${qs({ tab, cursor, limit: 10 })}`, opts());
export const search = (q: string, type?: string) => apiFetch<SearchResults>(`/search${qs({ q, type, limit: 20 })}`, opts());
export const getPublicConfig = () => apiFetch<PublicConfig>("/config/public");
