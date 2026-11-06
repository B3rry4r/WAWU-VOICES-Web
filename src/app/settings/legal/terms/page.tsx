import { LegalPage } from "@/features/legal/LegalPage";

export const dynamic = "force-static";
export const metadata = { title: "Terms of use" };

export default function Page() {
  return <LegalPage tab="terms" />;
}
