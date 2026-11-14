import type { Metadata } from "next";
import { ShareGone } from "@/features/share/ShareGone";

export const metadata: Metadata = { title: "Link not found", robots: { index: false, follow: false } };

/** A share link that does not exist or is gone. Answers 404. */
export default function ShareNotFound() {
  return <ShareGone />;
}
