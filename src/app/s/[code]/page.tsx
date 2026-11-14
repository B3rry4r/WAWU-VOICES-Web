import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharePageView } from "@/features/share/SharePageView";
import { ShareMoveOn } from "@/features/share/ShareMoveOn";
import { speakTarget } from "@/features/share/speak-target";
import type { ShareExtras } from "@/features/share/SharePageView";
import { ApiError, NetworkError } from "@/lib/api/client";
import { isBusy } from "@/lib/api/busy";
import { getPollTitle, getProfileVoices, getSharePage } from "@/lib/api/reach";
import type { SharePage } from "@/lib/api/reach";
import { requestForward } from "@/lib/api/forward-server";
import { ShareGate } from "@/features/share/ShareGate";
import { questionStart } from "@/lib/feed-format";

export const dynamic = "force-dynamic";

/** The page, null for a link that does not exist, "unreachable" when the API cannot be reached or fails (never a 500 for the visitor). */
async function load(code: string): Promise<SharePage | null | "unreachable" | "busy"> {
  try {
    return await getSharePage(code, requestForward());
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
    // The API is full (its own busy answer, or nginx's 503 for it): say so, instead of "we could not open that link".
    // G1: so is an API that cannot be reached at all (this runs on the server, where "offline" cannot be the visitor's own phone).
    if (isBusy(e) || e instanceof NetworkError) return "busy";
    return "unreachable";
  }
}

/** The link preview WhatsApp and X read: the card (1200 x 630) as the image, the title and the description. */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  // A link that cannot be read (unknown code, API trouble) is never indexed and never throws from the metadata step.
  const page = await load(params.code);
  if (page === "busy") return { title: "We are busy", robots: { index: false, follow: false } };
  if (page === "unreachable") return { title: "Link not available", robots: { index: false, follow: false } };
  if (!page) return { title: "Link not found", robots: { index: false, follow: false } };
  const og = page.openGraph;
  // A QUESTION link is titled with the question itself; the description is the API's own words (never typed here).
  const title = (page.objectType === "QUESTION" && page.question?.text?.trim()) || og.title;
  return {
    title,
    description: og.description,
    openGraph: { type: "website", siteName: "VOICES", title, description: og.description, url: og.url, images: [{ url: og.imageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description: og.description, images: [og.imageUrl] },
  };
}

export default async function Page({ params }: { params: { code: string } }) {
  const page = await load(params.code);
  // A server fault is never an error page: the visitor gets the waiting state, which asks again from the browser until the page can be drawn (or the link is found to be gone).
  if (page === "busy" || page === "unreachable") return <ShareGate code={params.code} />;
  if (!page) notFound();
  // An open question: people are moved on to its Speak screen in the browser (this page still answers 200 with its own tags).
  const to = speakTarget(page);
  if (to) return <ShareMoveOn code={page.code} to={to} />;
  // lead ruling WF-6, 6 Nov (RX5): the poll's own title on a question page, the person's voicesCount on a profile page.
  const extras: ShareExtras = {};
  if (page.poll && page.objectType !== "POLL_RESULT") extras.pollTitle = await getPollTitle(page.poll.pollId, requestForward());
  if (page.objectType === "PROFILE") {
    const handle = /^@(\S+) on VOICES$/.exec(page.topicLine)?.[1];
    extras.profileVoices = handle ? await getProfileVoices(handle, requestForward()) : null;
  }
  const now = Date.now();
  const view = <SharePageView page={page} now={now} extras={extras} />;
  // A question that has not opened: the gate keeps this drawing on the screen and turns it into the live page from the browser at the instant.
  const opensAt = page.question ? questionStart(page.question) : null;
  return opensAt !== null ? <ShareGate code={page.code} opensAt={opensAt} serverNow={now}>{view}</ShareGate> : view;
}
