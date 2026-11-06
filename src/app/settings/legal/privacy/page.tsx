import { LegalPage } from "@/features/legal/LegalPage";

export const dynamic = "force-static";
export const metadata = { title: "Privacy notice" };

export default function Page() {
  return <LegalPage tab="privacy" />;
}
