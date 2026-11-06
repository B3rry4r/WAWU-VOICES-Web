import { LegalPage } from "@/features/legal/LegalPage";

export const dynamic = "force-static";
export const metadata = { title: "Units, refunds and expiry" };

export default function Page() {
  return <LegalPage tab="refunds" />;
}
