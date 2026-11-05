import { apiFetch } from "./client";
import { API_BASE } from "./config";
import type { components } from "./types";

export type WeeklyReport = components["schemas"]["WeeklyReport"];
export type WeeklyReportCard = components["schemas"]["WeeklyReportCard"];
export type WeeklyArchive = components["schemas"]["WeeklyArchive"];
export type PollResults = components["schemas"]["PollResults"];
export type Notification = components["schemas"]["Notification"];
export type NotificationPage = components["schemas"]["NotificationPage"];
export type ShareLink = components["schemas"]["ShareLink"];
export type SharePage = components["schemas"]["SharePage"];
export type ShareObjectType = components["schemas"]["ShareObjectType"];
export type ShareTarget = components["schemas"]["ShareTarget"];
export type ShareEventKind = components["schemas"]["ShareEventRequest"]["kind"];
export type NotificationFilter = "all" | "replies" | "reactions" | "polls";

const GUEST_KEY = "voices-guest-id";

/** A guest's share calls carry a client-made id (X-Guest-Id), kept in the browser. */
export function guestId(): string {
  const fresh = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000000");
  if (typeof window === "undefined") return fresh();
  try {
    const have = window.localStorage.getItem(GUEST_KEY);
    if (have) return have;
    const id = fresh();
    window.localStorage.setItem(GUEST_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

/** The API base for server-side calls (the share page renders on the server): VOICES_API_BASE if set, else API_BASE when it is absolute. */
export function serverApiOrigin(): string {
  const set = process.env.VOICES_API_BASE;
  if (set) return set;
  return /^https?:\/\//.test(API_BASE) ? API_BASE : "http://127.0.0.1:4000/api/v1";
}

function page(path: string, o: { cursor?: string | null; limit?: number; extra?: Record<string, string> } = {}): string {
  const q = new URLSearchParams(o.extra ?? {});
  if (o.cursor) q.set("cursor", o.cursor);
  if (o.limit) q.set("limit", String(o.limit));
  const qs = q.toString();
  return `${path}${qs ? "?" + qs : ""}`;
}

// ---- weekly report

export function getLatestWeeklyReport(): Promise<WeeklyReport> {
  return apiFetch<WeeklyReport>("/weekly-reports/latest", { authed: true });
}

export function getWeeklyReport(reportId: string): Promise<WeeklyReport> {
  return apiFetch<WeeklyReport>(`/weekly-reports/${encodeURIComponent(reportId)}`, { authed: true });
}

export function listWeeklyReports(o: { cursor?: string | null; limit?: number } = {}): Promise<WeeklyArchive> {
  return apiFetch<WeeklyArchive>(page("/weekly-reports", o), { authed: true });
}

export function getPollResults(pollId: string): Promise<PollResults> {
  return apiFetch<PollResults>(`/polls/${encodeURIComponent(pollId)}/results`, { authed: true });
}

// ---- share

export function createShareLink(objectType: ShareObjectType, objectId: string, signedIn: boolean): Promise<ShareLink> {
  return apiFetch<ShareLink>("/share/links", {
    method: "POST",
    authed: true,
    headers: signedIn ? undefined : { "X-Guest-Id": guestId() },
    body: { objectType, objectId },
  });
}

/** Fire and forget: a share intent, a link open or an Add your voice tap. Never blocks the page. */
export function recordShareEvent(code: string, kind: ShareEventKind, target?: ShareTarget): Promise<void> {
  return apiFetch<void>(`/share/${encodeURIComponent(code)}/events`, {
    method: "POST",
    authed: true,
    keepalive: true,
    headers: { "X-Guest-Id": guestId() },
    body: target ? { kind, target } : { kind },
  }).catch(() => undefined);
}

/** Server side only: the public page data. Never cached, so a card or count change shows at once. */
export function getSharePage(code: string): Promise<SharePage> {
  return apiFetch<SharePage>(`/share/${encodeURIComponent(code)}`, { baseUrl: serverApiOrigin(), cache: "no-store" });
}

// ---- notifications

export function listNotifications(o: { filter?: NotificationFilter; cursor?: string | null; limit?: number } = {}): Promise<NotificationPage> {
  const extra: Record<string, string> = {};
  if (o.filter && o.filter !== "all") extra.type = o.filter;
  return apiFetch<NotificationPage>(page("/notifications", { cursor: o.cursor, limit: o.limit, extra }), { authed: true });
}

/** Empty ids marks every notification read. */
export function markNotificationsRead(ids: string[] = []): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>("/notifications/read", { method: "POST", authed: true, body: { ids } });
}

// ---- a voice on a share page

export type PlayUrl = components["schemas"]["PlayUrl"];

/** A short-lived signed URL for one clip. Guests may listen. */
export function getPlayUrl(clipId: string): Promise<PlayUrl> {
  return apiFetch<PlayUrl>(`/voice-clips/${encodeURIComponent(clipId)}/play`, { authed: true });
}
