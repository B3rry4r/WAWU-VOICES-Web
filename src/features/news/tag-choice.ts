import type { NewsTag } from "@/lib/api/news";

/**
 * V-FIX-B (addendum 1): a post cannot publish without a tag the person chose. Nothing is pre-selected. "Request Verified
 * News" posts as Unverified News and asks the editors to check the named source; only an editor can choose "Verified News"
 * (an editor names the source at once).
 */
export type TagPick = "NONE" | "UNVERIFIED_NEWS" | "GOSSIP" | "REQUEST_VERIFIED" | "VERIFIED_NEWS";

export interface TagChoice {
  pick: TagPick | null;
  sourceName: string;
  sourceUrl: string;
}

export const NO_TAG: TagChoice = { pick: "NONE", sourceName: "", sourceUrl: "" };

const needsSource = (p: TagPick | null) => p === "REQUEST_VERIFIED" || p === "VERIFIED_NEWS";

/** A link is empty, or starts with http:// or https:// and has a host. */
export function linkOk(url: string): boolean {
  const v = url.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** The Post and Send buttons wait for this. */
export function tagReady(c: TagChoice): boolean {
  if (!c.pick) return false;
  if (needsSource(c.pick)) return c.sourceName.trim().length > 0 && linkOk(c.sourceUrl);
  return true;
}

/** Why the button waits, in words for the person; null when it does not. */
export function tagWaitText(c: TagChoice): string | null {
    if (needsSource(c.pick) && !c.sourceName.trim()) return "Name your source to ask for Verified News.";
  if (!linkOk(c.sourceUrl)) return "Use a full link that starts with https://.";
  return null;
}

export interface TagFields {
  isNews: true;
  newsTag: NewsTag;
  requestVerified?: true;
  newsSourceName?: string;
  newsSourceUrl?: string;
}

/** What the person's choice adds to the post request; null for "Not news" (nothing is sent). Call only when tagReady. */
export function tagFields(c: TagChoice): TagFields | null {
  const src = {
    newsSourceName: c.sourceName.trim(),
    ...(c.sourceUrl.trim() ? { newsSourceUrl: c.sourceUrl.trim() } : {}),
  };
  switch (c.pick) {
    case "REQUEST_VERIFIED":
      return { isNews: true, newsTag: "UNVERIFIED_NEWS", requestVerified: true, ...src };
    case "VERIFIED_NEWS":
      return { isNews: true, newsTag: "VERIFIED_NEWS", ...src };
    case "GOSSIP":
      return { isNews: true, newsTag: "GOSSIP" };
    case "UNVERIFIED_NEWS":
      return { isNews: true, newsTag: "UNVERIFIED_NEWS" };
    default:
      return null;
  }
}

const PICKS = ["NONE", "UNVERIFIED_NEWS", "GOSSIP", "REQUEST_VERIFIED", "VERIFIED_NEWS"];
/** A tag read back from storage is used only if it has the shape we wrote (a hand-edited draft never breaks the screen). */
export function validTag(t: unknown): boolean {
  const c = t as TagChoice | null | undefined;
  return !!c && typeof c === "object" && typeof c.pick === "string" && PICKS.includes(c.pick) && typeof c.sourceName === "string" && typeof c.sourceUrl === "string";
}
