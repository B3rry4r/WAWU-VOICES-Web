import type { NewsTag } from "@/lib/api/news";

/**
 * V-FIX-B (addendum 1): a post cannot publish without a tag the person chose. Nothing is pre-selected. "Request Verified
 * News" posts as Unverified News and asks the editors to check the named source; only an editor can choose "Verified News"
 * (an editor names the source at once).
 */
export type TagPick = "UNVERIFIED_NEWS" | "GOSSIP" | "REQUEST_VERIFIED" | "VERIFIED_NEWS";

export interface TagChoice {
  pick: TagPick | null;
  sourceName: string;
  sourceUrl: string;
}

export const NO_TAG: TagChoice = { pick: null, sourceName: "", sourceUrl: "" };

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
  if (!c.pick) return "Choose a tag to post.";
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

/** What the person's choice adds to the post request. Call only when tagReady. */
export function tagFields(c: TagChoice): TagFields {
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
    default:
      return { isNews: true, newsTag: "UNVERIFIED_NEWS" };
  }
}
