import { Suspense } from "react";
import { OpenGate } from "@/features/talk/OpenGate";
import { WriteScreen } from "@/features/talk/WriteScreen";

export const metadata = { title: "Your answer" };

export default function WritePage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <OpenGate questionId={params.id}><WriteScreen qid={params.id} /></OpenGate>
    </Suspense>
  );
}
