import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ShareUnavailable } from "@/features/share/ShareUnavailable";
import { SharePageView } from "@/features/share/SharePageView";
import type { ShareExtras } from "@/features/share/SharePageView";
import { ApiError } from "@/lib/api/client";
import { getPollTitle, getProfileVoices, getSharePage } from "@/lib/api/reach";
import type { SharePage } from "@/lib/api/reach";
import { forwardHeaders } from "@/lib/api/forward";

export const dynamic = "force-dynamic";

/** The page, null for a link that does not exist, "unreachable" when the API cannot be reached or fails (never a 500 for the visitor). */
async function load(code: string): Promise<SharePage | null | "unreachable"> {
  try {
    return await getSharePage(code, forwardHeaders(headers()));
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
    return "unreachable";
  }
}

/** The link preview WhatsApp and X read: the card (1200 x 630) as the image, the title and the description. */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  // A link that cannot be read (unknown code, API trouble) is never indexed and never throws from the metadata step.
  const page = await load(params.code);
  if (page === "unreachable") return { title: "Link not available", robots: { index: false, follow: false } };
  if (!page) return { title: "Link not found", robots: { index: false, follow: false } };
  const og = page.openGraph;
  return {
    title: og.title,
    description: og.description,
    openGraph: { type: "website", siteName: "VOICES", title: og.title, description: og.description, url: og.url, images: [{ url: og.imageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: og.title, description: og.description, images: [og.imageUrl] },
  };
}

export default async function Page({ params }: { params: { code: string } }) {
  const page = await load(params.code);
  if (page === "unreachable") return <ShareUnavailable />;
  if (!page) notFound();
  // lead ruling WF-6, 6 Nov (RX5): the poll's own title on a question page, the person's voicesCount on a profile page.
  const extras: ShareExtras = {};
  if (page.poll && page.objectType !== "POLL_RESULT") extras.pollTitle = await getPollTitle(page.poll.pollId, forwardHeaders(headers()));
  if (page.objectType === "PROFILE") {
    const handle = /^@(\S+) on VOICES$/.exec(page.topicLine)?.[1];
    extras.profileVoices = handle ? await getProfileVoices(handle, forwardHeaders(headers())) : null;
  }
  return <SharePageView page={page} now={Date.now()} extras={extras} />;
}
