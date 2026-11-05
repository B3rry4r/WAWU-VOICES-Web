import { sessionStorage } from "./session-storage";

/** The name claims in the WAWU ID access token (firstName, lastName). Read only to greet and to start the handle; never trusted for access. */
export function tokenName(): { first: string; last: string } | null {
  try {
    const t = sessionStorage.getToken();
    if (!t) return null;
    const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { firstName?: unknown; lastName?: unknown };
    const first = typeof p.firstName === "string" ? p.firstName : "";
    const last = typeof p.lastName === "string" ? p.lastName : "";
    return first || last ? { first, last } : null;
  } catch {
    return null;
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "V";
}

/** A first guess at a handle from a name: first.last, lower case, letters and digits only. */
export function handleFromName(name: string): string {
  const parts = name.toLowerCase().split(/\s+/).map((p) => p.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  return parts.slice(0, 2).join(".").slice(0, 20);
}
