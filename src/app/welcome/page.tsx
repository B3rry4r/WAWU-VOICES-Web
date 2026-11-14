import type { Metadata } from "next";
import { Landing } from "@/features/entry/Landing";
import { LANDING_HEADLINE, LANDING_INTRO } from "@/features/entry/landing-words";
import { SITE_IMAGE, SITE_URL } from "@/lib/seo";

// LCH-01: the page title and the share preview carry the launch headline.
export const metadata: Metadata = {
  title: { absolute: `${LANDING_HEADLINE} | VOICES` },
  description: LANDING_INTRO,
  alternates: { canonical: `${SITE_URL}/welcome` },
  openGraph: { type: "website", siteName: "VOICES", title: LANDING_HEADLINE, description: LANDING_INTRO, url: `${SITE_URL}/welcome`, locale: "en_NG", images: [SITE_IMAGE] },
  twitter: { card: "summary", title: LANDING_HEADLINE, description: LANDING_INTRO, images: [SITE_IMAGE.url] },
};

export default function WelcomePage() {
  return <Landing />;
}
