import type { Role } from "@/lib/api/admin";

export type AdminPageId = "today" | "override" | "calendar" | "news" | "results" | "ads" | "weekly" | "moderation";

/** Who may open each admin page: the roles the API's operations for that page accept (docs/contract/openapi.yaml, x-wawu-roles). */
export const PAGE_ROLES: Record<AdminPageId, Role[]> = {
  today: ["EDITOR", "MODERATOR", "AD_MANAGER", "ADMIN"],
  override: ["EDITOR", "ADMIN"],
  calendar: ["EDITOR", "ADMIN"],
  news: ["EDITOR", "ADMIN"],
  results: ["EDITOR", "ADMIN"],
  weekly: ["EDITOR", "ADMIN"],
  moderation: ["MODERATOR", "ADMIN"],
  ads: ["AD_MANAGER", "ADMIN"],
};

export function canOpen(roles: readonly Role[], page: AdminPageId): boolean {
  return PAGE_ROLES[page].some((r) => roles.includes(r));
}

export function isAdminPerson(roles: readonly Role[]): boolean {
  return roles.length > 0;
}

const WORDS: Record<Role, string> = { EDITOR: "Editor", MODERATOR: "Moderator", AD_MANAGER: "Ad manager", ADMIN: "Admin" };

/** "Editor and admin" for a person with two roles. */
export function roleLine(roles: readonly Role[]): string {
  const order: Role[] = ["EDITOR", "MODERATOR", "AD_MANAGER", "ADMIN"];
  const w = order.filter((r) => roles.includes(r)).map((r) => WORDS[r]);
  if (w.length === 0) return "";
  const joined = w.length === 1 ? w[0] : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1].toLowerCase()}`;
  return joined;
}

export const ADMIN_PAGES: { id: AdminPageId; label: string; href: string; icon: string }[] = [
  { id: "today", label: "Today", href: "/admin", icon: "house" },
  { id: "override", label: "Override the day", href: "/admin/override", icon: "clock" },
  { id: "calendar", label: "Topic calendar", href: "/admin/calendar", icon: "clipboard-list" },
  { id: "news", label: "News tags", href: "/admin/news", icon: "shield-check" },
  { id: "results", label: "Posted results", href: "/admin/results", icon: "circle-check" },
  { id: "ads", label: "Adverts", href: "/admin/ads", icon: "megaphone" },
  { id: "weekly", label: "Weekly report", href: "/admin/weekly", icon: "chart-column" },
  { id: "moderation", label: "Moderation", href: "/admin/moderation", icon: "shield-alert" },
];
