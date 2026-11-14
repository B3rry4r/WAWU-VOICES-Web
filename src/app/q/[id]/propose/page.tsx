import { Suspense } from "react";
import { OpenGate } from "@/features/talk/OpenGate";
import { ProposePage } from "@/features/vote/ProposePage";

export const metadata = { title: "Propose a next step" };

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <OpenGate questionId={params.id}><ProposePage questionId={params.id} /></OpenGate>
    </Suspense>
  );
}
