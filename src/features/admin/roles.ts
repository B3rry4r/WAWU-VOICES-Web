import type { Role } from "@/lib/api/admin";

export type AdminPageId =
  | "today"
  | "override"
  | "calendar"
  | "pool"
  | "news"
  | "results"
  | "ads"
  | "weekly"
  | "moderation"
  | "money"
  | "money-payments"
  | "money-wallets"
  | "money-subscriptions"
  | "money-prices"
  | "verification"
  | "surveys"
  | "brands"
  | "users"
  | "ideas"
  | "people";

/** Who may open each admin page: the roles the API's operations for that page accept (docs/contract/openapi.yaml, x-wawu-roles). */
export const PAGE_ROLES: Record<AdminPageId, Role[]> = {
  today: ["EDITOR", "MODERATOR", "AD_MANAGER", "ADMIN"],
  override: ["EDITOR", "ADMIN"],
  calendar: ["EDITOR", "ADMIN"],
  pool: ["EDITOR", "ADMIN"],
  news: ["EDITOR", "ADMIN"],
  results: ["EDITOR", "ADMIN"],
  weekly: ["EDITOR", "ADMIN"],
  moderation: ["MODERATOR", "ADMIN"],
  ideas: ["MODERATOR", "ADMIN"],
  people: ["ADMIN"],
  ads: ["AD_MANAGER", "ADMIN"],
  surveys: ["AD_MANAGER", "ADMIN"],
  brands: ["AD_MANAGER", "ADMIN"],
  // V-46: identity documents are for admins only (the API route is ADMIN only).
  verification: ["ADMIN"],
  // The people list shows mail addresses, and the API route is ADMIN only.
  users: ["ADMIN"],
  // V-ADMIN-MONEY: the API's money routes are ADMIN only, so the pages are too.
  money: ["ADMIN"],
  "money-payments": ["ADMIN"],
  "money-wallets": ["ADMIN"],
  "money-subscriptions": ["ADMIN"],
  "money-prices": ["ADMIN"],
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

export const ADMIN_PAGES: { id: AdminPageId; label: string; href: string; icon: string; group?: string }[] = [
  { id: "today", label: "Today", href: "/admin", icon: "house" },
  { id: "override", label: "Override the day", href: "/admin/override", icon: "clock" },
  { id: "calendar", label: "Topic calendar", href: "/admin/calendar", icon: "clipboard-list" },
  { id: "pool", label: "Question pool", href: "/admin/pool", icon: "lightbulb" },
  { id: "news", label: "News tags", href: "/admin/news", icon: "shield-check" },
  { id: "results", label: "Posted results", href: "/admin/results", icon: "circle-check" },
  { id: "ads", label: "Adverts", href: "/admin/ads", icon: "megaphone" },
  { id: "surveys", label: "Sponsored Surveys", href: "/admin/surveys", icon: "vote" },
  { id: "brands", label: "Brand pages", href: "/admin/brands", icon: "badge-check" },
  { id: "weekly", label: "Weekly report", href: "/admin/weekly", icon: "chart-column" },
  { id: "moderation", label: "Moderation", href: "/admin/moderation", icon: "shield-alert" },
  { id: "users", label: "Users", href: "/admin/users", icon: "user" },
  { id: "verification", label: "Verification", href: "/admin/verification", icon: "badge-check" },
  { id: "money", label: "Overview", href: "/admin/money", icon: "wallet", group: "Money" },
  { id: "money-payments", label: "Payments", href: "/admin/money/payments", icon: "coins", group: "Money" },
  { id: "money-wallets", label: "A person's wallet", href: "/admin/money/wallets", icon: "user-check", group: "Money" },
  { id: "money-subscriptions", label: "Subscriptions", href: "/admin/money/subscriptions", icon: "clipboard-list", group: "Money" },
  { id: "money-prices", label: "Prices and limits", href: "/admin/money/prices", icon: "settings", group: "Money" },
  { id: "ideas", label: "Group ideas", href: "/admin/ideas", icon: "messages-square" },
  { id: "people", label: "People and roles", href: "/admin/people", icon: "user-check" },
];
