import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_TITLE, SITE_URL } from "@/lib/seo";
import { HomeScreen } from "@/components/feed/HomeScreen";

// SEO-APPS: the root page is the one search engines rank first, so it carries the full write-up and the canonical address.
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: { type: "website", siteName: "VOICES", title: SITE_TITLE, description: SITE_DESCRIPTION, url: SITE_URL, locale: "en_NG", images: [SITE_IMAGE] },
  twitter: { card: "summary", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_IMAGE.url] },
};

export default function HomePage() {
  return <HomeScreen />;
}
