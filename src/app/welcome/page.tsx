import type { Metadata } from "next";
import { Landing } from "@/features/entry/Landing";
import { LANDING_HEADLINE, LANDING_INTRO } from "@/features/entry/landing-words";

// LCH-01: the page title and the share preview carry the launch headline.
export const metadata: Metadata = {
  title: { absolute: `${LANDING_HEADLINE} | VOICES` },
  description: LANDING_INTRO,
  openGraph: { type: "website", siteName: "VOICES", title: LANDING_HEADLINE, description: LANDING_INTRO },
  twitter: { card: "summary", title: LANDING_HEADLINE, description: LANDING_INTRO },
};

export default function WelcomePage() {
  return <Landing />;
}
