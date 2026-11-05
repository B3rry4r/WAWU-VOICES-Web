import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharePageView } from "@/features/share/SharePageView";
import { ApiError } from "@/lib/api/client";
import { getSharePage } from "@/lib/api/reach";
import type { SharePage } from "@/lib/api/reach";

export const dynamic = "force-dynamic";

async function load(code: string): Promise<SharePage | null> {
  try {
    return await getSharePage(code);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/** The link preview WhatsApp and X read: the card (1200 x 630) as the image, the title and the description. */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  // A link that cannot be read (unknown code, API trouble) is never indexed and never throws from the metadata step.
  let page: SharePage | null = null;
  try {
    page = await load(params.code);
  } catch {
    return { title: "Link not found", robots: { index: false, follow: false } };
  }
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
  if (!page) notFound();
  return <SharePageView page={page} now={Date.now()} />;
}
