import { Suspense } from "react";
import { ProposePage } from "@/features/vote/ProposePage";

export const metadata = { title: "Propose a next step" };

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ProposePage questionId={params.id} />
    </Suspense>
  );
}
