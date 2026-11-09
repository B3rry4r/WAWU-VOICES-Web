import type { components } from "./types";
import { apiFetch } from "./client";

type S = components["schemas"];
export type MyInvite = S["MyInvite"];
export type Friend = S["Friend"];
export type FriendsPage = S["FriendsPage"];

/** LCH-06: my one invite code and link, and how many friends have answered through it. */
export const getMyInvite = () => apiFetch<MyInvite>("/me/invite", { authed: true });

/** LCH-06: the friends who answered through my link (a friend's word only if they keep Share my word on). */
export const listFriends = (cursor?: string, limit?: number) => {
  const q = new URLSearchParams();
  if (cursor) q.set("cursor", cursor);
  if (limit) q.set("limit", String(limit));
  const s = q.toString();
  return apiFetch<FriendsPage>(`/me/friends${s ? `?${s}` : ""}`, { authed: true });
};

/** LCH-06: count me as the friend of whoever's link I arrived by. Always answers 204. */
export const claimInvite = (code: string) => apiFetch<void>("/me/invite/claim", { method: "POST", authed: true, body: { code } });

export type InviterHandle = S["InviterHandle"];

/** LCH-A2: the handle of whoever owns a kept invite code, for the "asked how you feel" line on /go. Public, handle only; null when the code is not good. */
export const getInviter = (code: string) => apiFetch<InviterHandle>(`/invites/${encodeURIComponent(code)}`);
