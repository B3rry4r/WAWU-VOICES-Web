import { Suspense } from "react";
import { HelpPage } from "@/features/profile/HelpPage";

export const metadata = { title: "Help and contact" };

export default function Page() {
  return <Suspense fallback={null}><HelpPage /></Suspense>;
}
