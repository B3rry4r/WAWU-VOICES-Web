import type { Metadata } from "next";
import { Go } from "@/features/entry/Go";
import { LANDING_HEADLINE, LANDING_INTRO } from "@/features/entry/landing-words";

// LCH-08: the page the broadcast links to (usevoices.com/go). It shares the launch words with /welcome.
export const metadata: Metadata = {
  title: { absolute: `${LANDING_HEADLINE} | VOICES` },
  description: LANDING_INTRO,
  openGraph: { type: "website", siteName: "VOICES", title: LANDING_HEADLINE, description: LANDING_INTRO },
  twitter: { card: "summary", title: LANDING_HEADLINE, description: LANDING_INTRO },
};

export default function GoPage() {
  return <Go />;
}
