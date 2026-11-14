import { apiFetch } from "./client";
import { API_BASE } from "./config";
import type { components } from "./types-pending";

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

/** null when no report is published yet (the API answers 200 with null). */
export function getLatestWeeklyReport(): Promise<WeeklyReport | null> {
  return apiFetch<WeeklyReport | null>("/weekly-reports/latest", { authed: true });
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
export function getSharePage(code: string, fwd: Record<string, string> = {}): Promise<SharePage> {
  return apiFetch<SharePage>(`/share/${encodeURIComponent(code)}`, { baseUrl: serverApiOrigin(), cache: "no-store", headers: fwd });
}

/** The same answer the share page's server render reads, asked from the browser (a waiting share page uses it to see whether the question has opened before it asks the server to draw the page again). */
export function probeSharePage(code: string): Promise<SharePage> {
  return apiFetch<SharePage>(`/share/${encodeURIComponent(code)}`, { cache: "no-store" });
}

/** What a share page needs beyond the page itself (the poll's own title, a person's voice count), asked from the browser. Each is null when it cannot be read; never throws. */
export async function probeShareExtras(page: SharePage): Promise<{ pollTitle?: string | null; profileVoices?: number | null }> {
  const extras: { pollTitle?: string | null; profileVoices?: number | null } = {};
  if (page.poll && page.objectType !== "POLL_RESULT") {
    extras.pollTitle = await apiFetch<{ title?: string }>(`/polls/${encodeURIComponent(page.poll.pollId)}`, { cache: "no-store" }).then((p) => p?.title?.trim() || null, () => null);
  }
  if (page.objectType === "PROFILE") {
    const handle = /^@(\S+) on VOICES$/.exec(page.topicLine)?.[1];
    extras.profileVoices = handle
      ? await apiFetch<{ profile?: { voicesCount?: number } }>(`/people/by-handle/${encodeURIComponent(handle)}`, { cache: "no-store" }).then((p) => (typeof p?.profile?.voicesCount === "number" ? p.profile.voicesCount : null), () => null)
      : null;
  }
  return extras;
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

/** Server side only: the poll's own title (a question's share page shows the week's poll under it). null when it cannot be read. */
export async function getPollTitle(pollId: string, fwd: Record<string, string> = {}): Promise<string | null> {
  try {
    const p = await apiFetch<{ title?: string }>(`/polls/${encodeURIComponent(pollId)}`, { baseUrl: serverApiOrigin(), cache: "no-store", headers: fwd });
    return p?.title?.trim() || null;
  } catch {
    return null;
  }
}

/** Server side only: a person's voicesCount for their profile share page. null when it cannot be read. */
export async function getProfileVoices(handle: string, fwd: Record<string, string> = {}): Promise<number | null> {
  try {
    const p = await apiFetch<{ profile?: { voicesCount?: number } }>(`/people/by-handle/${encodeURIComponent(handle)}`, { baseUrl: serverApiOrigin(), cache: "no-store", headers: fwd });
    return typeof p?.profile?.voicesCount === "number" ? p.profile.voicesCount : null;
  } catch {
    return null;
  }
}
