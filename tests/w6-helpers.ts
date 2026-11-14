import { vi } from "vitest";

export type Handler = (init: { body: unknown; url: string; headers: Headers }) => unknown | Response;
export const calls: { method: string; path: string; body: unknown }[] = [];

/** Stubs fetch with a table keyed "METHOD /path" (query ignored). Anything else answers 404 in the API's error shape. */
export function mockApi(table: Record<string, Handler | unknown>) {
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const path = url.replace(/^.*\/api\/v1/, "").split("?")[0];
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const hit = table[`${method} ${path}`];
    if (hit === undefined) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "We could not find that." } }), { status: 404 });
    const v = typeof hit === "function" ? (hit as Handler)({ body, url, headers: new Headers(init.headers) }) : hit;
    if (v instanceof Response) return v;
    return v === null ? new Response(null, { status: 204 }) : new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
  }));
}

export const apiError = (status: number, code: string, message: string, details?: unknown) =>
  new Response(JSON.stringify({ error: { code, message, details } }), { status });

export function signIn(token = "tok") {
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: token, refreshToken: "r" }));
}

const settings = { language: "en", dataSaver: true, theme: "system", timezone: "Africa/Lagos", quietHoursStart: null, quietHoursEnd: null, notifyDailyQuestion: true, notifyWeeklyTopic: true, notifyReplies: true, notifyReactions: true, notifyPollResults: true, notifyFlashPolls: false, notifyCategoryAlerts: true, dailyQuestionMinute: 480 };
export const profile = { id: "u1", handle: "ada.okafor", displayName: "Ada Okafor", bio: null, avatarUrl: null, voiceCard: null, countryCode: "NG", state: "Enugu", city: null, languages: ["en"], joinedAt: "2026-11-02T10:00:00Z", voiceCount: 48, replyCount: 3, reactionsReceived: 1240 };
export const me = {
  phoneMasked: "+234 803 *** 4412", id: "u1", wawuId: "w", handle: "ada.okafor", profileComplete: true, savedCount: 12, replyCount: 3, reactionsReceived: 1240, roles: [], profile,
  allowances: { freePostsRemaining: 7, balanceMilli: 12500, maxVoiceSeconds: 10, freeReactionsLeftToday: 20, freeVotesLeftToday: 1, costs: {}, extraVoiceTokens: [] },
  unreadNotifications: 0, settings, referralCode: "ADA-7K2Q", status: "ACTIVE",
};
export const cats = { items: ["Money", "Work and pay", "Power and light", "Love"].map((name, i) => ({ id: "c" + i, slug: name, name, blurb: null, voicesThisWeek: 0, questionCount: 0 })) };
